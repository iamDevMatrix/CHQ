import { createClient } from '@supabase/supabase-js';
import type { AdminRepo, Feedback, Menu, PartnerEnquiry } from '../types';
import {
  OUTLET_COLS, categoryPatchRow, itemPatchRow, itemRow, toCategory, toItem, toOutlet,
  type CategoryRow, type ItemRow, type OutletRow,
} from './rows';

/**
 * Admin repo. Loaded only on #/admin, so guests never download supabase-js.
 * Row Level Security (supabase/schema.sql) does the authorization. RLS turns a blocked
 * update or delete into "0 rows changed" with no error, so every write checks the row count.
 */
const NOT_SAVED = 'this account cannot edit this café, or the row was deleted by someone else.';

export function createSupabaseRepo(url: string, anonKey: string, outletSlug: string): AdminRepo {
  const sb = createClient(url, anonKey, { auth: { persistSession: true } });
  let outletId: string | null = null;

  const check = <T>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };
  /** For update/delete with .select('id'): throws if RLS or a concurrent delete left nothing to change. */
  const changed = (res: { data: { id: string }[] | null; error: { message: string } | null }): number => {
    const rows = check(res) ?? [];
    if (rows.length === 0) throw new Error(NOT_SAVED);
    return rows.length;
  };

  async function getOutletId(): Promise<string> {
    if (outletId) return outletId;
    const row = check(await sb.from('outlets').select('id').eq('slug', outletSlug).single()) as { id: string };
    outletId = row.id;
    return outletId;
  }

  return {
    mode: 'supabase',
    async load(): Promise<Menu> {
      // RLS returns everything to this outlet's admins, including hidden rows.
      const outlet = check(await sb.from('outlets').select(OUTLET_COLS).eq('slug', outletSlug).single()) as OutletRow;
      outletId = outlet.id;
      const [cats, items] = await Promise.all([
        sb.from('categories').select('*').eq('outlet_id', outlet.id).order('sort_order'),
        sb.from('items').select('*').eq('outlet_id', outlet.id).order('sort_order'),
      ]);
      return {
        outlet: toOutlet(outlet),
        categories: (check(cats) as CategoryRow[]).map(toCategory),
        items: (check(items) as ItemRow[]).map(toItem),
      };
    },
    // Admin freshness: refetch on tab focus and every 60 s (useMenu). Writes are per-field, so a stale screen cannot undo others' edits.
    subscribe: () => () => {},
    async createCategory(c) {
      const oid = await getOutletId();
      check(await sb.from('categories').insert({ id: c.id, outlet_id: oid, name: c.name.trim(), sort_order: c.sortOrder, is_active: c.isActive }));
    },
    async updateCategory(id, patch) {
      changed(await sb.from('categories').update(categoryPatchRow(patch)).eq('id', id).select('id'));
    },
    async deleteCategory(id) {
      changed(await sb.from('categories').delete().eq('id', id).select('id')); // FK is RESTRICT: fails if items remain
    },
    async createItem(i) {
      check(await sb.from('items').insert(itemRow(i, await getOutletId())));
    },
    async updateItem(id, patch) {
      changed(await sb.from('items').update(itemPatchRow(patch)).eq('id', id).select('id'));
    },
    async deleteItem(id) {
      changed(await sb.from('items').delete().eq('id', id).select('id'));
    },
    async markAllInStock() {
      const oid = await getOutletId();
      const rows = check(await sb.from('items').update({ is_available: true }).eq('outlet_id', oid).eq('is_available', false).select('id'));
      return rows?.length ?? 0;
    },
    async submitFeedback(f) {
      const oid = await getOutletId();
      check(await sb.from('feedback').insert({ outlet_id: oid, rating: f.rating, comment: f.comment.trim(), name: f.name.trim(), phone: f.phone.trim(), table_no: f.tableNo }));
    },
    async submitPartner(p) {
      const oid = await getOutletId();
      check(await sb.from('partner_enquiries').insert({ outlet_id: oid, name: p.name.trim(), phone: p.phone.trim(), city: p.city.trim(), message: p.message.trim() }));
    },
    async saveOutlet(o) {
      const oid = await getOutletId();
      changed(await sb.from('outlets').update({
        name: o.name.trim(), tagline: o.tagline.trim(), phone: o.phone.trim(), email: o.email.trim(), announcement: o.announcement.trim(),
        address: o.address.trim(), about: o.about.trim(), partner_text: o.partnerText.trim(), website_url: o.websiteUrl.trim(), website_label: o.websiteLabel.trim(),
      }).eq('id', oid).select('id'));
    },
    async listFeedback() {
      const oid = await getOutletId();
      const rows = check(await sb.from('feedback').select('*').eq('outlet_id', oid).order('created_at', { ascending: false }).limit(200)) as
        { id: string; rating: number; comment: string; name: string; phone: string; table_no: string; created_at: string }[];
      return rows.map((r): Feedback => ({ id: r.id, rating: r.rating, comment: r.comment, name: r.name, phone: r.phone, tableNo: r.table_no, createdAt: r.created_at }));
    },
    async listPartners() {
      const oid = await getOutletId();
      const rows = check(await sb.from('partner_enquiries').select('*').eq('outlet_id', oid).order('created_at', { ascending: false }).limit(200)) as
        { id: string; name: string; phone: string; city: string; message: string; created_at: string }[];
      return rows.map((r): PartnerEnquiry => ({ id: r.id, name: r.name, phone: r.phone, city: r.city, message: r.message, createdAt: r.created_at }));
    },
    async deleteFeedback(id) {
      changed(await sb.from('feedback').delete().eq('id', id).select('id'));
    },
    async deletePartner(id) {
      changed(await sb.from('partner_enquiries').delete().eq('id', id).select('id'));
    },
    async currentUser() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.email ?? null;
    },
    async isOutletAdmin() {
      // RLS (outlet_admins_self) only returns the signed-in user's own rows.
      const oid = await getOutletId();
      const rows = check(await sb.from('outlet_admins').select('user_id').eq('outlet_id', oid).limit(1));
      return (rows?.length ?? 0) > 0;
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      await sb.auth.signOut();
    },
  };
}
