import { storage } from "./storage";

/**
 * Square menu context for the AI prompt.
 *
 * This lives at module scope on purpose. The original implementations were
 * nested inside registerRoutes (and duplicated again in voiceCallHandler), so
 * the Retell prompt builders — which are module-level — could not reach them.
 * The result was that Square menu data only ever reached the in-app tester and
 * the legacy pipeline, never a real Retell-routed call.
 */

const SQUARE_API = "https://connect.squareup.com";
const SQUARE_VERSION = "2024-01-18";

interface SquareCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  merchant_id: string;
}

/** Returns a valid access token, refreshing it first if it is close to expiry. */
export async function getSquareAccessToken(
  userId: string,
): Promise<{ accessToken: string; merchantId: string } | null> {
  const integrations = await storage.getIntegrations(userId);
  const square = integrations.find((i) => i.service === "square" && i.status === "active");
  if (!square?.credentials) return null;

  const credentials = square.credentials as SquareCredentials;

  const expiresAt = new Date(credentials.expires_at).getTime();
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() >= FIVE_MINUTES) {
    return { accessToken: credentials.access_token, merchantId: credentials.merchant_id };
  }

  const clientId = process.env.SQUARE_CLIENT_ID;
  const clientSecret = process.env.SQUARE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[Square] OAuth not configured; cannot refresh token");
    return null;
  }

  try {
    const res = await fetch(`${SQUARE_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
      }),
    });

    if (!res.ok) {
      console.error("[Square] Token refresh failed:", await res.text());
      return null;
    }

    const tokens = await res.json();
    const expires =
      tokens.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const merchantId = tokens.merchant_id || credentials.merchant_id;

    await storage.updateIntegration(square.id, userId, {
      credentials: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || credentials.refresh_token,
        expires_at: expires,
        merchant_id: merchantId,
      },
    } as any);

    return { accessToken: tokens.access_token, merchantId };
  } catch (err) {
    console.error("[Square] Token refresh error:", err);
    return null;
  }
}

/**
 * Lists the full catalog. Square caps a page at 100 objects and returns a
 * cursor; the previous implementations ignored it, so any menu larger than
 * ~100 objects was silently truncated — and because the page mixes types, a
 * big catalog could come back with almost no actual items.
 */
async function listCatalog(accessToken: string): Promise<any[]> {
  const objects: any[] = [];
  let cursor: string | undefined;
  // Bounded so a pathological catalog can't spin forever.
  for (let page = 0; page < 25; page++) {
    const url = new URL(`${SQUARE_API}/v2/catalog/list`);
    url.searchParams.set("types", "ITEM,CATEGORY,MODIFIER_LIST");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_VERSION,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.error(`[Square] Catalog fetch unauthorized (${res.status}) — merchant should reconnect`);
      } else {
        console.error(`[Square] Catalog fetch failed with status ${res.status}`);
      }
      break;
    }

    const data = await res.json();
    objects.push(...(data.objects || []));
    cursor = data.cursor;
    if (!cursor) break;
  }
  return objects;
}

function formatPrice(amountCents: unknown): string | null {
  if (typeof amountCents !== "number") return null;
  return `$${(amountCents / 100).toFixed(2)}`;
}

/**
 * Builds a plain-text menu block for the agent prompt. Returns '' when Square
 * is not connected or the catalog is empty, so callers can append blindly.
 */
export async function getSquareMenuContext(userId: string): Promise<string> {
  try {
    const token = await getSquareAccessToken(userId);
    if (!token) return "";

    const objects = await listCatalog(token.accessToken);
    if (objects.length === 0) return "";

    const categories = new Map<string, string>();
    const modifierLists = new Map<string, string[]>();

    for (const obj of objects) {
      if (obj.type === "CATEGORY" && obj.category_data?.name) {
        categories.set(obj.id, obj.category_data.name);
      }
      if (obj.type === "MODIFIER_LIST") {
        const names = (obj.modifier_list_data?.modifiers || [])
          .map((m: any) => m.modifier_data?.name)
          .filter(Boolean);
        if (names.length) modifierLists.set(obj.id, names);
      }
    }

    const byCategory: Record<string, string[]> = {};

    for (const obj of objects) {
      if (obj.type !== "ITEM" || !obj.item_data?.name) continue;
      const item = obj.item_data;

      // category_id is deprecated; newer catalogs populate categories[] /
      // reporting_category instead, so check those first.
      const categoryId =
        item.reporting_category?.id ||
        item.categories?.[0]?.id ||
        item.category_id;
      const categoryName = (categoryId && categories.get(categoryId)) || "Menu";

      const variations = item.variations || [];
      let priceText = "";
      if (variations.length === 1) {
        const v = variations[0]?.item_variation_data;
        // Square's enum is VARIABLE_PRICING; the old code compared against
        // 'VARIABLE', so this branch never fired and such items showed no price.
        if (v?.pricing_type === "VARIABLE_PRICING") {
          priceText = " — price varies";
        } else {
          const p = formatPrice(v?.price_money?.amount);
          if (p) priceText = ` — ${p}`;
        }
      } else if (variations.length > 1) {
        const parts = variations
          .map((v: any) => {
            const d = v.item_variation_data;
            if (d?.pricing_type === "VARIABLE_PRICING") return `${d?.name}: varies`;
            const p = formatPrice(d?.price_money?.amount);
            return p && d?.name ? `${d.name}: ${p}` : null;
          })
          .filter(Boolean);
        if (parts.length) priceText = ` — ${parts.join(", ")}`;
      }

      let line = `- ${item.name}${priceText}`;
      if (item.description) line += `\n  ${item.description}`;

      const modifierNames = (item.modifier_list_info || [])
        .flatMap((info: any) => modifierLists.get(info.modifier_list_id) || []);
      if (modifierNames.length) {
        line += `\n  Options: ${modifierNames.join(", ")}`;
      }

      (byCategory[categoryName] ||= []).push(line);
    }

    const sections = Object.entries(byCategory)
      .filter(([, items]) => items.length > 0)
      .map(([name, items]) => `### ${name}\n${items.join("\n")}`);

    return sections.length ? sections.join("\n\n") : "";
  } catch (err) {
    console.error("[Square] Failed to build menu context:", err);
    return "";
  }
}

/** Appends (or replaces) the menu section in an agent prompt. */
export function appendSquareMenuBlock(prompt: string, menu: string): string {
  if (!menu) return prompt;
  const section = `\n\n## Live Menu (Square)\n\n${menu}`;
  if (prompt.includes("## Live Menu (Square)")) {
    return prompt.replace(/\n\n## Live Menu \(Square\)[\s\S]*?(?=\n\n## |$)/, section);
  }
  return prompt + section;
}
