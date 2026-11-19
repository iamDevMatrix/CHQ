-- CHQ Digital Menu: Postgres schema for Supabase
-- Run once in Supabase SQL editor, then run seed.sql.
-- Authorization lives here (Row Level Security), not in the browser.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table public.outlets (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (length(name) between 1 and 80),
  tagline     text not null default '',
  phone       text not null default '',
  email       text not null default '',
  announcement  text not null default '' check (length(announcement) <= 160), -- splash text; '' = no splash
  address       text not null default '' check (length(address) <= 160),
  about         text not null default '' check (length(about) <= 600),
  partner_text  text not null default '' check (length(partner_text) <= 400),
  website_url   text not null default '' check (website_url = '' or website_url ~ '^https://'),
  website_label text not null default '' check (length(website_label) <= 40),
  created_at  timestamptz not null default now()
);

-- Who may edit which outlet's menu. Add a row per manager after they sign up.
create table public.outlet_admins (
  outlet_id   uuid not null references public.outlets(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (outlet_id, user_id)
);
create index outlet_admins_user_idx on public.outlet_admins(user_id);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  outlet_id   uuid not null references public.outlets(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (outlet_id, name),
  unique (id, outlet_id) -- target for the composite FK below
);
create index categories_outlet_sort_idx on public.categories(outlet_id, sort_order);

create table public.items (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null,
  category_id   uuid not null,
  section       text not null default '' check (length(section) <= 40),
  name          text not null check (length(trim(name)) between 1 and 80),
  description   text not null default '' check (length(description) <= 200),
  price         integer not null check (price between 0 and 99999), -- whole rupees
  size          text not null default '' check (length(size) <= 20),
  food_type     text not null default 'veg' check (food_type in ('veg', 'egg', 'nonveg')),
  is_available  boolean not null default true,  -- false: shown greyed out, "Currently unavailable"
  is_active     boolean not null default true,  -- false: hidden from guests
  is_bestseller boolean not null default false,
  image_url     text not null default '' check (image_url = '' or image_url ~ '^https://'),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (outlet_id, name),
  -- An item can never point at another outlet's category.
  -- RESTRICT: deleting a category with items fails instead of silently wiping the menu.
  foreign key (category_id, outlet_id) references public.categories(id, outlet_id) on delete restrict
);
create index items_outlet_cat_sort_idx on public.items(outlet_id, category_id, sort_order);

-- Guest feedback. Guests can insert, never read.
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  outlet_id   uuid not null references public.outlets(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text not null default '' check (length(comment) <= 1000),
  name        text not null default '' check (length(name) <= 60),
  phone       text not null default '' check (phone = '' or phone ~ '^[6-9][0-9]{9}$'),
  table_no    text not null default '' check (length(table_no) <= 8),
  created_at  timestamptz not null default now()
);
create index feedback_outlet_created_idx on public.feedback(outlet_id, created_at desc);

-- "Partner with us" leads. Guests can insert, never read.
create table public.partner_enquiries (
  id          uuid primary key default gen_random_uuid(),
  outlet_id   uuid not null references public.outlets(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),
  city        text not null default '' check (length(city) <= 60),
  message     text not null default '' check (length(message) <= 1000),
  created_at  timestamptz not null default now()
);
create index partner_enquiries_outlet_created_idx on public.partner_enquiries(outlet_id, created_at desc);

-- Who changed what, when. Answers "who switched off Malai Chai at 4pm?" without app code.
create table public.menu_audit (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  row_id      uuid not null,
  action      text not null,
  changed_by  uuid,
  old_row     jsonb,
  new_row     jsonb,
  changed_at  timestamptz not null default now()
);
create index menu_audit_row_idx on public.menu_audit(row_id, changed_at desc);

-- ---------- Triggers ----------

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger items_touch      before update on public.items      for each row execute function public.touch_updated_at();

create or replace function public.audit_menu() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.menu_audit(table_name, row_id, action, changed_by, old_row, new_row)
  values (tg_table_name, coalesce(new.id, old.id), tg_op, auth.uid(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit_menu();
create trigger items_audit      after insert or update or delete on public.items      for each row execute function public.audit_menu();

-- ---------- Row Level Security ----------

create or replace function public.is_outlet_admin(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.outlet_admins where outlet_id = oid and user_id = auth.uid());
$$;

alter table public.outlets       enable row level security;
alter table public.outlet_admins enable row level security;
alter table public.categories    enable row level security;
alter table public.items         enable row level security;
alter table public.menu_audit    enable row level security;
alter table public.feedback          enable row level security;
alter table public.partner_enquiries enable row level security;

-- Guests (anon key) read the public menu.
create policy outlets_read on public.outlets for select using (true);

create policy categories_read on public.categories for select
  using (is_active or public.is_outlet_admin(outlet_id));

create policy items_read on public.items for select
  using (
    public.is_outlet_admin(outlet_id)
    or (is_active and exists (select 1 from public.categories c where c.id = category_id and c.is_active))
  );

-- Only that outlet's admins write.
create policy categories_write on public.categories for all
  using (public.is_outlet_admin(outlet_id)) with check (public.is_outlet_admin(outlet_id));

create policy items_write on public.items for all
  using (public.is_outlet_admin(outlet_id)) with check (public.is_outlet_admin(outlet_id));

create policy outlets_admin_update on public.outlets for update
  using (public.is_outlet_admin(id)) with check (public.is_outlet_admin(id));

-- Submissions: anyone may insert; only that outlet's admins may read or delete. No updates via API.
create policy feedback_insert on public.feedback for insert with check (true);
create policy feedback_read   on public.feedback for select using (public.is_outlet_admin(outlet_id));
create policy partner_insert  on public.partner_enquiries for insert with check (true);
create policy partner_read    on public.partner_enquiries for select using (public.is_outlet_admin(outlet_id));
-- Admins may delete a submission, e.g. when a guest asks for their details to be erased (NFR-09).
create policy feedback_delete on public.feedback          for delete using (public.is_outlet_admin(outlet_id));
create policy partner_delete  on public.partner_enquiries for delete using (public.is_outlet_admin(outlet_id));

create policy outlet_admins_self on public.outlet_admins for select using (user_id = auth.uid());

-- An admin sees the change history of their own outlet only.
create policy audit_read on public.menu_audit for select
  using (public.is_outlet_admin(coalesce((new_row->>'outlet_id')::uuid, (old_row->>'outlet_id')::uuid)));
-- No insert/delete policies on outlets, outlet_admins, menu_audit: managed from the Supabase dashboard only.
-- Spam: DB checks cap sizes and require valid Indian mobiles; the client throttles to 1 submission/min.
-- If bots appear, add Cloudflare Turnstile in front of the inserts (via an Edge Function).

-- ---------- Table privileges ----------
-- Supabase grants anon/authenticated every privilege on new tables (including TRUNCATE, which RLS does not cover).
-- Revoke that and grant only what the app uses. RLS above still filters every row.
revoke all on public.outlets, public.outlet_admins, public.categories, public.items, public.menu_audit,
  public.feedback, public.partner_enquiries from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.outlets, public.categories, public.items to anon, authenticated;
grant insert on public.feedback, public.partner_enquiries to anon, authenticated;
grant update on public.outlets to authenticated;
grant insert, update, delete on public.categories, public.items to authenticated;
grant select, delete on public.feedback, public.partner_enquiries to authenticated;
grant select on public.outlet_admins, public.menu_audit to authenticated;

-- No Realtime: guests and admins refresh on tab focus and every 60 s (FR-06), and admin writes are per-field.
