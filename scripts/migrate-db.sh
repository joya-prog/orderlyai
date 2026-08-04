#!/usr/bin/env bash
#
# Copies the Postgres database off Replit and verifies nothing was lost.
#
#   export SOURCE_DATABASE_URL="postgres://...replit..."
#   export TARGET_DATABASE_URL="postgres://...neon..."
#   ./scripts/migrate-db.sh
#
# Non-destructive to the SOURCE — it is only ever read. Keep Replit's database
# running until the new host has been live for a week.
#
# Requires pg_dump/psql v16+ (brew install postgresql@16).

set -euo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL (Replit)}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL (new host)}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="orderlyai-${STAMP}.dump"

echo "==> Dumping source -> ${DUMP}"
# Custom format: parallel restore, and --no-owner/--no-acl so the new host's
# role names don't have to match Replit's.
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file="${DUMP}" \
  "${SOURCE_DATABASE_URL}" 2> "dump-${STAMP}.log" || {
    echo "Dump failed. See dump-${STAMP}.log"; exit 1;
  }

echo "==> Dump complete: $(du -h "${DUMP}" | cut -f1)"

echo "==> Restoring into target"
# --clean --if-exists makes reruns idempotent. Exit code is ignored because
# pg_restore warns about extensions it cannot recreate (e.g. neon-owned ones);
# the row-count check below is what actually decides success.
pg_restore \
  --dbname="${TARGET_DATABASE_URL}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --jobs=4 \
  --verbose \
  "${DUMP}" 2> "restore-${STAMP}.log" || true

echo "==> Comparing row counts"

# Enumerated from the source rather than hardcoded. A fixed list silently skips
# whatever it does not name — an earlier version checked 10 tables out of 30 and
# would have reported success without ever looking at orders, invoices,
# subscriptions or usage_ledger.
TABLES=$(psql "${SOURCE_DATABASE_URL}" -tAc \
  "SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name")

if [ -z "$TABLES" ]; then
  echo "FAILED: could not list tables on the source. Check SOURCE_DATABASE_URL."
  exit 1
fi

echo "    checking $(echo "$TABLES" | wc -w | tr -d ' ') tables"

printf '\n%-24s %12s %12s   %s\n' "TABLE" "SOURCE" "TARGET" "RESULT"
printf '%s\n' "-------------------------------------------------------------------"

FAILED=0
for t in $TABLES; do
  src=$(psql "${SOURCE_DATABASE_URL}" -tAc \
        "SELECT count(*) FROM \"$t\"" 2>/dev/null || echo "n/a")
  tgt=$(psql "${TARGET_DATABASE_URL}" -tAc \
        "SELECT count(*) FROM \"$t\"" 2>/dev/null || echo "n/a")

  if [ "$tgt" = "n/a" ]; then
    # Present on the source but unreadable on the target — the restore did not
    # create it. Previously this was reported as a harmless skip.
    result="MISSING ON TARGET"
    FAILED=1
  elif [ "$src" = "$tgt" ]; then
    result="ok"
  else
    result="MISMATCH"
    FAILED=1
  fi
  printf '%-24s %12s %12s   %s\n' "$t" "$src" "$tgt" "$result"
done

echo
if [ "$FAILED" -eq 1 ]; then
  echo "FAILED: row counts differ. Do NOT cut over."
  echo "Check restore-${STAMP}.log for the cause."
  exit 1
fi

echo "All row counts match. Dump kept at ${DUMP} — archive it before deleting."
echo
echo "Next: set DATABASE_URL on the new host to TARGET_DATABASE_URL,"
echo "deploy, and work through docs/MIGRATION.md before moving DNS."
