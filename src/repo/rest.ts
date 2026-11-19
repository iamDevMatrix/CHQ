import type { Feedback, GuestRepo, Menu, PartnerEnquiry } from '../types';
import { OUTLET_COLS, toCategory, toItem, toOutlet, type CategoryRow, type ItemRow, type OutletRow } from './rows';

/**
 * Guest repo for production: plain fetch against Supabase's REST API (PostgREST).
 * Guests only read the menu and submit two forms, so they skip the ~60 KB Supabase library.
 * Row Level Security in supabase/schema.sql decides what the anon key can see and insert.
 */
export function createRestRepo(url: string, key: string, outletSlug: string): GuestRepo {
  const base = url.replace(/\/+$/, '') + '/rest/v1/';
  // Legacy anon keys are JWTs and also go in Authorization; new publishable keys (sb_publishable_...) must not.
  const headers: Record<string, string> = key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
  let outletId: string | null = null;

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(base + path, { headers });
    if (!res.ok) throw new Error(`Menu request failed (${res.status})`);
    return (await res.json()) as T;
  }

  async function insert(table: string, body: Record<string, unknown>): Promise<void> {
    const oid = outletId ?? (await loadOutlet()).id;
    const res = await fetch(base + table, {
      method: 'POST',
      // return=minimal: guests may insert but not read these tables back.
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ ...body, outlet_id: oid }),
    });
    if (!res.ok) throw new Error(`Could not send (${res.status})`);
  }

  async function loadOutlet(): Promise<OutletRow> {
    const rows = await get<OutletRow[]>(`outlets?select=${OUTLET_COLS}&slug=eq.${encodeURIComponent(outletSlug)}`);
    if (!rows[0]) throw new Error('Menu not found');
    outletId = rows[0].id;
    return rows[0];
  }

  return {
    mode: 'supabase',
    async load(): Promise<Menu> {
      const outlet = await loadOutlet();
      const [cats, items] = await Promise.all([
        get<CategoryRow[]>(`categories?select=id,outlet_id,name,sort_order,is_active&outlet_id=eq.${outlet.id}&order=sort_order`),
        get<ItemRow[]>(`items?select=*&outlet_id=eq.${outlet.id}&order=sort_order`),
      ]);
      return { outlet: toOutlet(outlet), categories: cats.map(toCategory), items: items.map(toItem) };
    },
    // Freshness for guests is the 60 s poll plus refetch on tab focus (FR-06), see useMenu.
    subscribe: () => () => {},
    async submitFeedback(f: Omit<Feedback, 'id' | 'createdAt'>) {
      await insert('feedback', { rating: f.rating, comment: f.comment.trim(), name: f.name.trim(), phone: f.phone.trim(), table_no: f.tableNo });
    },
    async submitPartner(p: Omit<PartnerEnquiry, 'id' | 'createdAt'>) {
      await insert('partner_enquiries', { name: p.name.trim(), phone: p.phone.trim(), city: p.city.trim(), message: p.message.trim() });
    },
  };
}
