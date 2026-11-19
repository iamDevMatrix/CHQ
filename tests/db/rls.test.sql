-- Fails (non-zero exit with ON_ERROR_STOP) if any security rule breaks.
-- Uses only the grants in supabase/schema.sql, so missing or extra privileges are caught too.
grant usage on schema auth to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
insert into outlet_admins select id, '11111111-1111-1111-1111-111111111111' from outlets;

create function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAIL: %', msg; end if; raise notice 'ok: %', msg; end $$;

-- True if the statement is refused, either by a missing privilege or by RLS changing 0 rows.
create function pg_temp.blocked(stmt text) returns boolean language plpgsql as $$
declare n int;
begin
  execute stmt; get diagnostics n = row_count; return n = 0;
exception when insufficient_privilege then return true;
end $$;

-- admin hides Milo and Desserts, marks Malai Chai and Rusk out of stock
set role authenticated; set test.uid = '11111111-1111-1111-1111-111111111111';
update items set is_active = false where name = 'Milo';
update categories set is_active = false where name = 'Desserts';
update items set is_available = false where name in ('Malai Chai', 'Rusk');
reset role;

set role anon; reset test.uid;
select pg_temp.assert((select count(*) from items) = 109, 'guest sees 113 - Milo - 3 desserts');
select pg_temp.assert((select count(*) from items where name = 'Malai Chai' and not is_available) = 1, 'out-of-stock item still visible');
insert into feedback(outlet_id, rating) select id, 5 from outlets;
insert into partner_enquiries(outlet_id, name, phone) select id, 'Ravi', '9876543210' from outlets;
select pg_temp.assert(pg_temp.blocked('select 1 from feedback'), 'guest cannot read feedback');
select pg_temp.assert(pg_temp.blocked('select 1 from partner_enquiries'), 'guest cannot read leads');
select pg_temp.assert(pg_temp.blocked('update items set price = 1'), 'guest cannot change prices');
select pg_temp.assert(pg_temp.blocked('update outlets set announcement = ''x'''), 'guest cannot change outlet');
select pg_temp.assert(pg_temp.blocked('delete from feedback'), 'guest cannot delete feedback');
select pg_temp.assert(pg_temp.blocked('select 1 from menu_audit'), 'guest cannot read change history');
reset role;
select pg_temp.assert((select count(*) from items where price = 1) = 0, 'prices unchanged after guest attempt');
select pg_temp.assert((select announcement from outlets) <> 'x', 'outlet unchanged after guest attempt');
select pg_temp.assert((select count(*) from feedback) = 1, 'feedback survived guest delete attempt');

set role authenticated; set test.uid = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert(pg_temp.blocked('update items set price = 1'), 'signed-in non-admin cannot change prices');
select pg_temp.assert(pg_temp.blocked('update outlets set announcement = ''x'''), 'signed-in non-admin cannot change outlet');
select pg_temp.assert(pg_temp.blocked('delete from items where name = ''Samosa'''), 'signed-in non-admin cannot delete items');
select pg_temp.assert(pg_temp.blocked('delete from feedback'), 'signed-in non-admin cannot delete feedback');
select pg_temp.assert((select count(*) from outlet_admins) = 0, 'non-admin is told they are not an admin');
select pg_temp.assert((select count(*) from menu_audit) = 0, 'non-admin cannot read change history');
reset role;

set role authenticated; set test.uid = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert((select count(*) from outlet_admins) = 1, 'admin sees own admin row');
select pg_temp.assert((select count(*) from feedback) = 1, 'admin reads feedback');
-- per-field update leaves other columns alone (what the admin app sends)
update items set description = 'Fresh' where name = 'Malai Chai';
select pg_temp.assert((select not is_available from items where name = 'Malai Chai'), 'description edit kept out-of-stock flag');
-- FR-25: mark all in stock
with u as (update items set is_available = true where outlet_id = (select id from outlets) and not is_available returning 1)
select pg_temp.assert((select count(*) from u) = 2, 'mark all in stock changed exactly the 2 out-of-stock items');
select pg_temp.assert((select count(*) from items where not is_available) = 0, 'no item left out of stock');
delete from partner_enquiries;
select pg_temp.assert((select count(*) from partner_enquiries) = 0, 'admin deletes a lead on request');
select pg_temp.assert((select count(*) from menu_audit) >= 4, 'admin reads own outlet history');
do $$ begin
  begin update items set price = -5 where name = 'Samosa'; raise exception 'FAIL: negative price accepted';
  exception when check_violation then raise notice 'ok: negative price rejected'; end;
  begin delete from categories where name = 'Shakes'; raise exception 'FAIL: category with items deleted';
  exception when foreign_key_violation then raise notice 'ok: category with items protected'; end;
end $$;
reset role;
select pg_temp.assert((select count(*) from menu_audit where changed_by is not null) >= 4, 'changes are audited with user');
