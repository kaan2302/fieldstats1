// Feste Einstellungen der App.

export const SB_URL = "https://mcdjzcisihabimpvmgzg.supabase.co";
/** Öffentlicher Schlüssel (publishable). Schreibrechte regelt die Datenbank (RLS). */
export const SB_KEY = "sb_publishable_J7_VgOZpvgORTbZQG_udNA_EQTeLWnx";
/** Team für alte Links ohne ?team=. Für eine eigene Produkt-Domain auf null setzen. */
export const DEFAULT_TEAM: string | null = "sc-binningen";
/** Stripe Payment Links, z. B. https://buy.stripe.com/... (leer = noch nicht verbunden). */
export const STRIPE_CHECKOUT_TEAM = ""; // Mannschaft, CHF 129 pro Saison
export const STRIPE_CHECKOUT_CLUB = ""; // Verein, CHF 349 pro Saison
/** Stripe Kundenportal zum Kündigen (leer = noch nicht verbunden). */
export const STRIPE_PORTAL = "";

/** Betreiber für Impressum, Datenschutz und AGB. Leere Felder erscheinen als «[bitte ergänzen]». */
export const OPERATOR = {
  name: "", // Vor- und Nachname bzw. Firmenname
  address: "", // Strasse Nr., PLZ Ort
  email: "", // Kontakt-E-Mail
  court: "", // Gerichtsstand, z. B. «Basel»
  vat: "Nicht mehrwertsteuerpflichtig.", // oder «MWST-Nr. CHE-…»
  trialDays: 30,
  updated: "23.11.2026",
};
