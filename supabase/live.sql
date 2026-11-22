-- Live-Modus: Spiele erfassen ohne Admin-Login, nur mit dem geheimen Tracker-Link.
-- Einmal im Supabase SQL Editor ausführen (New query → einfügen → Run).

-- Geheimnisse (Tracker-Code). Niemand ausser dem Admin kann diese Tabelle lesen.
create table if not exists public.secrets (k text primary key, v text not null);
alter table public.secrets enable row level security;
drop policy if exists "secrets admin" on public.secrets;
create policy "secrets admin" on public.secrets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.secrets from anon;
grant select, insert, update, delete on public.secrets to authenticated;

-- Schreibt den Live-Stand (coll 'live') und optional das Spiel (coll 'matches'),
-- aber nur mit dem richtigen Tracker-Code oder als Admin.
create or replace function public.live_save(p_token text, p_match text, p_live jsonb, p_match_data jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (p_token is null or p_token <> coalesce((select v from public.secrets where k = 'live_token'), '')) then
    raise exception 'Tracker-Code ungültig' using errcode = '42501';
  end if;
  if p_match is null or length(p_match) > 80 then raise exception 'Spiel-ID ungültig'; end if;
  if p_live is not null then
    insert into public.docs(coll, id, data) values ('live', p_match, p_live)
    on conflict (coll, id) do update set data = excluded.data;
  else
    delete from public.docs where coll = 'live' and id = p_match;
  end if;
  if p_match_data is not null then
    insert into public.docs(coll, id, data) values ('matches', p_match, p_match_data)
    on conflict (coll, id) do update set data = excluded.data;
  end if;
end $$;
revoke all on function public.live_save(text, text, jsonb, jsonb) from public;
grant execute on function public.live_save(text, text, jsonb, jsonb) to anon, authenticated;

-- Prüft einen Tracker-Code (für die Anzeige «Link gültig»).
create or replace function public.live_check(p_token text) returns boolean
language sql security definer set search_path = public as $$
  select p_token is not null and p_token = (select v from public.secrets where k = 'live_token');
$$;
grant execute on function public.live_check(text) to anon, authenticated;
