#!/bin/bash
# Mark migrations 2–22 as reverted so db push will run them and create the rest of the schema.
# Run supabase/backfill-missing-tables.sql in the Supabase SQL Editor ONCE before running this script.
# Run from project root: bash scripts/repair-and-push-migrations.sh

set -e
cd "$(dirname "$0")/.."

VERSIONS="20251208040114 20251208045521 20251214005236 20251220072806 20251224011750 20251230064655 20251230065717 20251230070051 20260101015326 20260111040837 20260112023325 20260113035641 20260113040805 20260113040816 20260216041437 20260216041445 20260216042148 20260216045332 20260223231906 20260224031527 20260224221257 20260224222535"

echo "Marking migrations as reverted so they will run on next push..."
for v in $VERSIONS; do
  echo "  Reverting $v"
  npx supabase migration repair "$v" --status reverted
done

echo ""
echo "Pushing migrations (this will create the missing tables)..."
npx supabase db push --include-all

echo ""
echo "Done. Check Table Editor in Supabase dashboard for all tables."
