-- Vereine mit mehreren Mannschaften. Einmal im Supabase SQL Editor ausführen.
-- Ein Verein (Vereins-Abo) hat mehrere Mannschaften. Der Vereins-Admin darf alles,
-- Trainer (per E-Mail eingetragen) nur ihre Mannschaft. Einzelne Mannschaften ohne Verein funktionieren wie bisher.

begin;

-- 1) Vereine
create table if not exists public.clubs (
  id          text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  name        text not null,
  owner       uuid not null references auth.users(id) on delete cascade,
  plan        text not null default 'trial',                        -- trial | active | canceled | past_due
  trial_until date not null default (current_date + 30),
  stripe_customer     text,
  stripe_subscription text,
  created_at  timestamptz not null default now()
);
alter table public.clubs enable row level security;
drop policy if exists "clubs lesen" on public.clubs;
create policy "clubs lesen" on public.clubs for select to anon, authenticated using (true);
revoke all on public.clubs from anon, authenticated;
grant select (id, name, created_at) on public.clubs to anon, authenticated;

-- 2) Mannschaften gehören optional einem Verein
alter table public.teams add column if not exists club_id text references public.clubs(id) on delete set null;
alter table public.teams add column if not exists label text;                 -- z. B. «1. Mannschaft», «B-Junioren»
grant select (club_id, label) on public.teams to anon, authenticated;

-- 3) Trainer pro Mannschaft (E-Mail; Zugriff erst mit bestätigtem Konto dieser E-Mail)
create table if not exists public.team_trainers (
  team_id    text not null references public.teams(id) on delete cascade,
  email      text not null check (email = lower(email) and email like '%@%'),
  created_at timestamptz not null default now(),
  primary key (team_id, email)
);
alter table public.team_trainers enable row level security;

-- 4) Rechte
create or replace function public.is_club_admin(c text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clubs where id = c and owner = auth.uid())
$$;

-- Besitzer der Mannschaft oder Vereins-Admin (darf Trainer verwalten)
create or replace function public.is_team_owner(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teams tm left join public.clubs c on c.id = tm.club_id
    where tm.id = t and (tm.owner = auth.uid() or c.owner = auth.uid()))
$$;

create or replace function public.is_team_admin(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_team_owner(t) or exists (
    select 1 from public.team_trainers tt join auth.users u on lower(u.email) = tt.email
    where tt.team_id = t and u.id = auth.uid() and u.email_confirmed_at is not null)
$$;

-- Schreiben: Admin + (Mannschaft hat Abo/Testphase oder ihr Verein hat Abo/Testphase)
create or replace function public.team_can_write(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_team_admin(t) and exists (
    select 1 from public.teams tm left join public.clubs c on c.id = tm.club_id
    where tm.id = t and (tm.plan = 'active' or tm.trial_until >= current_date
                         or c.plan = 'active' or c.trial_until >= current_date))
$$;
grant execute on function public.is_club_admin(text), public.is_team_owner(text),
  public.is_team_admin(text), public.team_can_write(text) to anon, authenticated;

drop policy if exists "trainer verwalten" on public.team_trainers;
create policy "trainer verwalten" on public.team_trainers for all to authenticated
  using (public.is_team_owner(team_id)) with check (public.is_team_owner(team_id));
revoke all on public.team_trainers from anon;
grant select, insert, delete on public.team_trainers to authenticated;

-- 5) Verein anlegen, Mannschaft im Verein anlegen, bestehende Mannschaft einem Verein zuordnen
create or replace function public.create_club(p_id text, p_name text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden'; end if;
  if p_id !~ '^[a-z0-9-]{3,40}$' then raise exception 'Vereins-Link: 3–40 Zeichen, nur a–z, 0–9 und -'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Bitte einen Vereinsnamen angeben'; end if;
  if exists (select 1 from public.clubs where id = p_id) then raise exception 'Dieser Vereins-Link ist schon vergeben'; end if;
  if (select count(*) from public.clubs where owner = auth.uid()) >= 3 then raise exception 'Maximal 3 Vereine pro Konto'; end if;
  insert into public.clubs (id, name, owner) values (p_id, trim(p_name), auth.uid());
  return p_id;
end $$;
grant execute on function public.create_club(text, text) to authenticated;

create or replace function public.create_club_team(p_club text, p_id text, p_label text) returns text
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from public.clubs where id = p_club and owner = auth.uid();
  if not found then raise exception 'Nur der Vereins-Admin kann Mannschaften anlegen'; end if;
  if p_id !~ '^[a-z0-9-]{3,40}$' then raise exception 'Mannschafts-Link: 3–40 Zeichen, nur a–z, 0–9 und -'; end if;
  if length(trim(coalesce(p_label, ''))) < 2 then raise exception 'Bitte die Mannschaft angeben, z. B. «B-Junioren»'; end if;
  if exists (select 1 from public.teams where id = p_id) then raise exception 'Dieser Mannschafts-Link ist schon vergeben'; end if;
  if (select count(*) from public.teams where club_id = p_club) >= 12 then raise exception 'Maximal 12 Mannschaften pro Verein'; end if;
  insert into public.teams (id, name, owner, club_id, label, trial_until)
    values (p_id, c.name || ' ' || trim(p_label), auth.uid(), p_club, trim(p_label), current_date - 1);
  insert into public.docs (team_id, coll, id, data)
    values (p_id, 'team', 'meta', jsonb_build_object('club', c.name, 'team', trim(p_label)));
  return p_id;
end $$;
grant execute on function public.create_club_team(text, text, text) to authenticated;

create or replace function public.attach_team(p_team text, p_club text, p_label text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_club_admin(p_club) then raise exception 'Nur der Vereins-Admin'; end if;
  if not exists (select 1 from public.teams where id = p_team and owner = auth.uid()) then
    raise exception 'Nur eigene Mannschaften können zugeordnet werden'; end if;
  update public.teams set club_id = p_club, label = coalesce(nullif(trim(p_label), ''), label) where id = p_team;
end $$;
grant execute on function public.attach_team(text, text, text) to authenticated;

-- 6) Eigene Mannschaften (als Besitzer, Vereins-Admin oder Trainer)
drop function if exists public.my_teams();
create or replace function public.my_teams()
returns table (id text, name text, plan text, trial_until date, club_id text, label text, role text,
               club_name text, club_plan text, club_trial_until date)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, t.plan, t.trial_until, t.club_id, t.label,
         case when c.owner = auth.uid() then 'club' when t.owner = auth.uid() then 'owner' else 'trainer' end,
         c.name, c.plan, c.trial_until
  from public.teams t left join public.clubs c on c.id = t.club_id
  where public.is_team_admin(t.id)
  order by c.name nulls last, t.created_at
$$;
grant execute on function public.my_teams() to authenticated;

create or replace function public.my_clubs()
returns table (id text, name text, plan text, trial_until date)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.plan, c.trial_until from public.clubs c where c.owner = auth.uid() order by c.created_at
$$;
grant execute on function public.my_clubs() to authenticated;

commit;
