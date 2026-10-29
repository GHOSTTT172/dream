create extension if not exists pgcrypto with schema extensions;

-- Admin allowlist (max 2 rows). RLS on, NO policies: only is_admin() (security definer) can read it.
create table public.admin_allowlist (email text primary key check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'));
alter table public.admin_allowlist enable row level security;
revoke all on public.admin_allowlist from anon, authenticated;
create function public.enforce_two_admins() returns trigger language plpgsql as $$
begin if (select count(*) from public.admin_allowlist) >= 2 then raise exception 'Only two administrators are allowed'; end if; return new; end $$;
create trigger admin_allowlist_max before insert on public.admin_allowlist for each row execute function public.enforce_two_admins();

-- Trusted claim: top-level "email" in the Supabase-signed JWT (not user_metadata, which users can edit).
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_allowlist where email = lower(auth.jwt() ->> 'email'));
$$;
grant execute on function public.is_admin() to authenticated;

create sequence public.application_number_seq;  -- never reset: numbers are never reused

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique,
  application_code text not null unique,
  submission_key uuid not null unique,
  contact_email text not null check (length(contact_email) <= 254),
  roblox_username text not null check (length(roblox_username) between 3 and 20),
  roblox_user_id text not null check (roblox_user_id ~ '^[0-9]{1,15}$'),
  discord_username text not null check (length(discord_username) between 2 and 40),
  discord_user_id text not null check (discord_user_id ~ '^[0-9]{15,22}$'),  -- self-reported, NOT verified
  discord_display_name text check (length(discord_display_name) <= 60),
  age_range text not null check (age_range in ('13-15','16-17','18-24','25+')),
  country text not null check (length(country) <= 80),
  timezone text not null check (length(timezone) <= 60),
  preferred_language text not null check (length(preferred_language) <= 40),
  staff_position text not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  status text not null default 'pending' check (status in ('pending','under_review','accepted','rejected')),
  assigned_reviewer text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decision_at timestamptz,
  decision_reason text,
  archived_at timestamptz
);
create index on public.applications (status);
create index on public.applications (staff_position);
create index on public.applications (submitted_at desc);
create index on public.applications (discord_user_id);
create index on public.applications (lower(roblox_username));

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  author_email text not null,
  content text not null check (length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.application_notes (application_id);

create table public.application_audit_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  admin_email text not null,
  action text not null,
  previous_status text,
  new_status text,
  reason text,
  created_at timestamptz not null default now()
);
create index on public.application_audit_logs (application_id);

alter table public.applications enable row level security;
alter table public.application_notes enable row level security;
alter table public.application_audit_logs enable row level security;
revoke all on public.applications, public.application_notes, public.application_audit_logs from anon, authenticated;
grant select on public.applications, public.application_notes, public.application_audit_logs to authenticated;
grant update (status, decision_at, decision_reason, archived_at, assigned_reviewer, updated_at) on public.applications to authenticated;
grant insert on public.application_notes, public.application_audit_logs to authenticated;
-- No DELETE or anon grants anywhere. Audit logs are append-only (no update/delete grant).

create policy apps_select on public.applications for select to authenticated using (public.is_admin());
create policy apps_update on public.applications for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notes_select on public.application_notes for select to authenticated using (public.is_admin());
create policy notes_insert on public.application_notes for insert to authenticated
  with check (public.is_admin() and author_email = lower(auth.jwt() ->> 'email'));
create policy audit_select on public.application_audit_logs for select to authenticated using (public.is_admin());
create policy audit_insert on public.application_audit_logs for insert to authenticated
  with check (public.is_admin() and admin_email = lower(auth.jwt() ->> 'email'));

-- Secure random code (unambiguous 32-char alphabet, no modulo bias)
create function public.random_code(len int) returns text language plpgsql volatile set search_path = public, extensions as $$
declare a constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := gen_random_bytes(len); r text := ''; i int;
begin for i in 0..len-1 loop r := r || substr(a, (get_byte(b, i) % 32) + 1, 1); end loop; return r; end $$;

-- Called ONLY by the server with the service-role key. Atomic: identifiers + row in one statement/transaction.
create function public.submit_application(p jsonb, p_key uuid, p_block_duplicates boolean default true)
returns table (application_number text, application_code text) language plpgsql security definer set search_path = public, extensions as $$
declare n text; c text; tries int := 0; ex record;
begin
  select a.application_number, a.application_code into ex from applications a where a.submission_key = p_key;
  if found then application_number := ex.application_number; application_code := ex.application_code; return next; return; end if;
  if p_block_duplicates and exists (select 1 from applications a where a.discord_user_id = p->>'discord_user_id'
      and a.staff_position = p->>'staff_position' and a.status in ('pending','under_review') and a.archived_at is null) then
    raise exception 'DUPLICATE_APPLICATION';
  end if;
  loop
    tries := tries + 1;
    n := 'BRP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('application_number_seq')::text, 6, '0');
    c := 'BRP-' || random_code(4) || '-' || random_code(4);
    begin
      insert into applications (application_number, application_code, submission_key, contact_email, roblox_username, roblox_user_id,
        discord_username, discord_user_id, discord_display_name, age_range, country, timezone, preferred_language, staff_position, answers)
      values (n, c, p_key, p->>'contact_email', p->>'roblox_username', p->>'roblox_user_id', p->>'discord_username', p->>'discord_user_id',
        nullif(p->>'discord_display_name',''), p->>'age_range', p->>'country', p->>'timezone', p->>'preferred_language', p->>'staff_position', p->'answers');
      application_number := n; application_code := c; return next; return;
    exception when unique_violation then
      select a.application_number, a.application_code into ex from applications a where a.submission_key = p_key;
      if found then application_number := ex.application_number; application_code := ex.application_code; return next; return; end if;
      if tries >= 5 then raise exception 'IDENTIFIER_COLLISION'; end if;  -- sequence value is simply skipped, never reused
    end;
  end loop;
end $$;
revoke execute on function public.submit_application(jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.submit_application(jsonb, uuid, boolean) to service_role;

-- Status change + audit entry in ONE transaction, as the calling admin (SECURITY INVOKER => RLS applies too)
create function public.change_status(p_number text, p_action text, p_reason text default null) returns void
language plpgsql security invoker set search_path = public as $$
declare a record; nxt text; who text := lower(auth.jwt() ->> 'email');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select id, status into a from applications where application_number = p_number for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_action = 'archive' then update applications set archived_at = now(), updated_at = now() where id = a.id; nxt := a.status;
  elsif p_action = 'unarchive' then update applications set archived_at = null, updated_at = now() where id = a.id; nxt := a.status;
  elsif p_action in ('pending','under_review','accepted','rejected') then
    nxt := p_action;
    if nxt in ('accepted','rejected') and length(trim(coalesce(p_reason,''))) < 5 then raise exception 'REASON_REQUIRED'; end if;
    update applications set status = nxt, updated_at = now(),
      decision_at = case when nxt in ('accepted','rejected') then now() end,
      decision_reason = case when nxt in ('accepted','rejected') then trim(p_reason) end where id = a.id;
  else raise exception 'INVALID_ACTION'; end if;
  insert into application_audit_logs (application_id, admin_email, action, previous_status, new_status, reason)
  values (a.id, who, p_action, a.status, nxt, nullif(trim(coalesce(p_reason,'')), ''));
end $$;
grant execute on function public.change_status(text, text, text) to authenticated;

-- After creating your two admins' emails, seed the allowlist (SQL editor, lowercase):
-- insert into public.admin_allowlist (email) values ('admin1@gmail.com'), ('admin2@gmail.com');
