-- SCB Kader – einmalig im Supabase SQL Editor ausführen.
-- Legt eine Tabelle für alle Daten an und sperrt das Schreiben für alle ausser dem Admin.

create table if not exists public.docs (
  coll       text        not null,           -- players, matches, fixtures, analyses, team, ownernotes
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);

-- Wer ist Admin? Nur diese E-Mail darf schreiben.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'kaanyildiz1402@gmail.com'
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs
  for each row execute function public.touch_updated_at();

alter table public.docs enable row level security;

drop policy if exists "docs lesen"     on public.docs;
drop policy if exists "docs einfuegen" on public.docs;
drop policy if exists "docs aendern"   on public.docs;
drop policy if exists "docs loeschen"  on public.docs;

-- Lesen: alle (auch ohne Login), ausser den privaten Notizen des Admins
create policy "docs lesen" on public.docs for select
  to anon, authenticated
  using (coll <> 'ownernotes' or public.is_admin());

-- Schreiben: nur der Admin
create policy "docs einfuegen" on public.docs for insert to authenticated with check (public.is_admin());
create policy "docs aendern"   on public.docs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "docs loeschen"  on public.docs for delete to authenticated using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.docs to anon, authenticated;
grant insert, update, delete on public.docs to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Live-Aktualisierung für alle offenen Seiten
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; when undefined_object then null;
end $$;
