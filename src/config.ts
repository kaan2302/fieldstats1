// Feste Einstellungen der App.

export const SB_URL = "https://mcdjzcisihabimpvmgzg.supabase.co";
/** Öffentlicher Schlüssel (publishable). Schreibrechte regelt die Datenbank (RLS). */
export const SB_KEY = "sb_publishable_J7_VgOZpvgORTbZQG_udNA_EQTeLWnx";
/** Team für alte Links ohne ?team=. Für eine eigene Produkt-Domain auf null setzen. */
export const DEFAULT_TEAM: string | null = "sc-binningen";
/** Stripe Payment Link, z. B. https://buy.stripe.com/... (leer = noch nicht verbunden). */
export const STRIPE_CHECKOUT = "";
/** Stripe Kundenportal zum Kündigen (leer = noch nicht verbunden). */
export const STRIPE_PORTAL = "";
