-- Mehrere Teams auf einer Plattform. Einmal im Supabase SQL Editor ausführen.
-- Bestehende Daten werden dem Team «sc-binningen» (Admin kaanyildiz1402@gmail.com) zugeordnet.

-- 1) Teams
create table if not exists public.teams (
  id          text primary key check (id ~ '^[a-z0-9-]{3,40}$'),   -- Team-Link, z. B. sc-binningen
  name        text not null,
  owner       uuid not null references auth.users(id) on delete cascade,
  plan        text not null default 'trial',                        -- trial | active | canceled | past_due
  trial_until date not null default (current_date + 30),
  stripe_customer     text,
  stripe_subscription text,
  created_at  timestamptz not null default now()
);
alter table public.teams enable row level security;
drop policy if exists "teams lesen" on public.teams;
create policy "teams lesen" on public.teams for select to anon, authenticated using (true);
revoke all on public.teams from anon, authenticated;
grant select (id, name, plan, trial_until, created_at) on public.teams to anon, authenticated;

insert into public.teams (id, name, owner, plan)
  select 'sc-binningen', 'SC Binningen', u.id, 'active' from auth.users u where lower(u.email) = 'kaanyildiz1402@gmail.com'
  on conflict (id) do nothing;

-- 2) Daten gehören einem Team
alter table public.docs add column if not exists team_id text;
update public.docs set team_id = 'sc-binningen' where team_id is null;
alter table public.docs alter column team_id set not null;
alter table public.docs drop constraint if exists docs_pkey;
alter table public.docs add primary key (team_id, coll, id);
alter table public.docs drop constraint if exists docs_team_fk;
alter table public.docs add constraint docs_team_fk foreign key (team_id) references public.teams(id) on delete cascade;

-- 3) Rechte: lesen alle, schreiben nur der Admin des Teams (und nur mit aktivem Abo oder in der Testphase)
create or replace function public.is_team_admin(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teams where id = t and owner = auth.uid())
$$;
create or replace function public.team_can_write(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teams where id = t and owner = auth.uid()
                 and (plan = 'active' or trial_until >= current_date))
$$;
grant execute on function public.is_team_admin(text), public.team_can_write(text) to anon, authenticated;

drop policy if exists "docs lesen"     on public.docs;
drop policy if exists "docs einfuegen" on public.docs;
drop policy if exists "docs aendern"   on public.docs;
drop policy if exists "docs loeschen"  on public.docs;
create policy "docs lesen" on public.docs for select to anon, authenticated
  using (coll <> 'ownernotes' or public.is_team_admin(team_id));
create policy "docs einfuegen" on public.docs for insert to authenticated with check (public.team_can_write(team_id));
create policy "docs aendern"   on public.docs for update to authenticated using (public.team_can_write(team_id)) with check (public.team_can_write(team_id));
create policy "docs loeschen"  on public.docs for delete to authenticated using (public.team_can_write(team_id));

-- 4) Team anlegen (nach der Registrierung) und eigene Teams abfragen
create or replace function public.create_team(p_id text, p_name text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Bitte zuerst anmelden'; end if;
  if p_id !~ '^[a-z0-9-]{3,40}$' then raise exception 'Team-Link: 3–40 Zeichen, nur a–z, 0–9 und -'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Bitte einen Teamnamen angeben'; end if;
  if exists (select 1 from public.teams where id = p_id) then raise exception 'Dieser Team-Link ist schon vergeben'; end if;
  if (select count(*) from public.teams where owner = auth.uid()) >= 5 then raise exception 'Maximal 5 Teams pro Konto'; end if;
  insert into public.teams (id, name, owner) values (p_id, trim(p_name), auth.uid());
  insert into public.docs (team_id, coll, id, data) values (p_id, 'team', 'meta', jsonb_build_object('club', trim(p_name)));
  return p_id;
end $$;
grant execute on function public.create_team(text, text) to authenticated;

create or replace function public.my_teams() returns table (id text, name text, plan text, trial_until date)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, t.plan, t.trial_until from public.teams t where t.owner = auth.uid() order by t.created_at
$$;
grant execute on function public.my_teams() to authenticated;

-- 5) Live-Link pro Spiel: wer den Link hat, darf nur dieses eine Spiel erfassen
create table if not exists public.live_links (
  token      text primary key,
  team_id    text not null references public.teams(id) on delete cascade,
  match_id   text not null,
  created_at timestamptz not null default now()
);
alter table public.live_links enable row level security;
drop policy if exists "live_links admin" on public.live_links;
create policy "live_links admin" on public.live_links for all to authenticated
  using (public.is_team_admin(team_id)) with check (public.is_team_admin(team_id));
revoke all on public.live_links from anon;
grant select, insert, delete on public.live_links to authenticated;

create or replace function public.live_info(p_token text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('team_id', team_id, 'match_id', match_id) from public.live_links where token = p_token
$$;
grant execute on function public.live_info(text) to anon, authenticated;

drop function if exists public.live_save(text, text, jsonb, jsonb);
drop function if exists public.live_check(text);
create or replace function public.live_save(p_token text, p_live jsonb, p_match_data jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare l record;
begin
  select * into l from public.live_links where token = p_token;
  if not found then raise exception 'Live-Link ungültig oder abgelaufen' using errcode = '42501'; end if;
  if p_live is not null then
    insert into public.docs (team_id, coll, id, data) values (l.team_id, 'live', l.match_id, p_live)
    on conflict (team_id, coll, id) do update set data = excluded.data;
  else
    delete from public.docs where team_id = l.team_id and coll = 'live' and id = l.match_id;
  end if;
  if p_match_data is not null then
    insert into public.docs (team_id, coll, id, data) values (l.team_id, 'matches', l.match_id, p_match_data)
    on conflict (team_id, coll, id) do update set data = excluded.data;
  end if;
end $$;
revoke all on function public.live_save(text, jsonb, jsonb) from public;
grant execute on function public.live_save(text, jsonb, jsonb) to anon, authenticated;

-- alte Einzel-Team-Teile entfernen
drop table if exists public.secrets;
