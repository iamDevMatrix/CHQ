#!/usr/bin/env bash
# End-to-end tests against a real local Supabase stack (needs Docker).
# Starts the stack in .supabase-local/, applies schema + seed, creates two logins, builds, runs tests/supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
STACK=.supabase-local
mkdir -p "$STACK"
cd "$STACK"
[ -f supabase/config.toml ] || npx -y supabase@2 init --force >/dev/null
# Mirror production (README "Go live" step 3): no public sign-ups.
python3 - <<'PY'
# Edit only the [auth] table's own enable_signup line; [auth.email] has one too and must stay true. Safe to rerun.
p = 'supabase/config.toml'; out = []; section = None
for line in open(p).read().split('\n'):
    if line.startswith('['):
        section = line.strip()
    elif section == '[auth]' and line.startswith('enable_signup ='):
        line = 'enable_signup = false'
    elif section == '[auth.email]' and line.startswith('enable_signup ='):
        line = 'enable_signup = true'
    out.append(line)
open(p, 'w').write('\n'.join(out))
PY
npx -y supabase@2 stop >/dev/null 2>&1 || true # config changes (sign-up off) apply only on start
npx -y supabase@2 start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
eval "$(npx -y supabase@2 status -o env | grep -E '^(API_URL|DB_URL|PUBLISHABLE_KEY|ANON_KEY|SERVICE_ROLE_KEY)=')"
cd "$ROOT"

# Fresh database: drop app tables and logins, then apply schema + seed exactly as in README "Go live".
psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
drop table if exists public.menu_audit, public.partner_enquiries, public.feedback, public.items, public.categories, public.outlet_admins, public.outlets cascade;
drop function if exists public.audit_menu, public.touch_updated_at, public.is_outlet_admin cascade;
delete from auth.users where email in ('manager@example.com', 'stranger@example.com');
SQL
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -v 'already exists' || true
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f supabase/seed.sql
for email in manager@example.com stranger@example.com; do
  curl -fsS -X POST "$API_URL/auth/v1/admin/users" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$email\",\"password\":\"Test-pass-123\",\"email_confirm\":true}" >/dev/null
done
psql "$DB_URL" -q -v ON_ERROR_STOP=1 -c "insert into outlet_admins (outlet_id, user_id) select o.id, u.id from outlets o, auth.users u where o.slug = 'chq-capital' and u.email = 'manager@example.com';"

# KEY=anon tests the legacy JWT anon key; default is the newer publishable key.
KEY=${KEY:-publishable}
[ "$KEY" = anon ] && APP_KEY=$ANON_KEY || APP_KEY=$PUBLISHABLE_KEY
VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_ANON_KEY=$APP_KEY npx vite build >/dev/null
SB_API_URL=$API_URL SB_KEY=$APP_KEY npx playwright test -c playwright.supabase.config.ts --trace off "$@"
