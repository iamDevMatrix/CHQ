#!/usr/bin/env bash
# Runs schema + seed + security tests in a throwaway database.
# Uses standard libpq env vars (PGHOST, PGPORT, PGUSER). Example: PGHOST=localhost PGUSER=postgres tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="menu_test_$$"
psql -d postgres -qc "create database $DB"
trap 'psql -d postgres -qc "drop database $DB"' EXIT
for f in tests/db/stubs.sql supabase/schema.sql supabase/seed.sql tests/db/rls.test.sql; do
  if ! out=$(psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f" 2>&1); then
    echo "$out" | grep -v -e wal_level -e HINT; echo "FAILED in $f"; exit 1
  fi
  echo "$out" | grep -e 'ok:' -e FAIL | sed 's/^.*NOTICE:  /  /' || true
done
echo "DB tests passed"
