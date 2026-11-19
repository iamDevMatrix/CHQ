import type { AdminRepo, GuestRepo } from '../types';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// A path such as "/sb" means "this site, under /sb" (for a same-origin reverse proxy); a full URL is used as is.
const url = rawUrl ? new URL(rawUrl, window.location.href).href.replace(/\/+$/, '') : undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const outlet = (import.meta.env.VITE_OUTLET_SLUG as string | undefined) || 'chq-capital';
const live = Boolean(url && key);

let guest: Promise<GuestRepo> | null = null;
let admin: Promise<AdminRepo> | null = null;

/** Guest page: fetch-only repo in production, localStorage demo otherwise. */
export function getGuestRepo(): Promise<GuestRepo> {
  guest ??= live ? import('./rest').then((m) => m.createRestRepo(url!, key!, outlet)) : import('./demo').then((m) => m.demoRepo);
  return guest;
}

/** Admin page: supabase-js (auth + writes), loaded only when someone opens #/admin. */
export function getAdminRepo(): Promise<AdminRepo> {
  admin ??= live ? import('./supabase').then((m) => m.createSupabaseRepo(url!, key!, outlet)) : import('./demo').then((m) => m.demoRepo);
  return admin;
}

export const OUTLET_SLUG = outlet;
