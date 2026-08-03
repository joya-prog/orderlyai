import type { User } from "@shared/schema";

/**
 * Fields that must never reach the client. `passwordHash` is the bcrypt digest
 * (offline-crackable if leaked); `googleId` is an account-linking identifier.
 */
const SENSITIVE_USER_FIELDS = ["passwordHash", "googleId"] as const;

export type PublicUser = Omit<User, (typeof SENSITIVE_USER_FIELDS)[number]>;

/**
 * Strips sensitive columns from a user row. Apply to every user object that
 * crosses the HTTP boundary — including admin and support responses, which
 * would otherwise hand one tenant's credentials to another.
 */
export function toPublicUser<T extends Partial<User>>(
  user: T,
): Omit<T, (typeof SENSITIVE_USER_FIELDS)[number]>;
export function toPublicUser(user: null | undefined): undefined;
export function toPublicUser(user: any): any {
  if (!user) return undefined;
  const clean = { ...user };
  for (const field of SENSITIVE_USER_FIELDS) {
    delete clean[field];
  }
  return clean;
}

export function toPublicUsers<T extends Partial<User>>(users: T[]) {
  return users.map((u) => toPublicUser(u));
}
