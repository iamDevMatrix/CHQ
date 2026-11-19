import { useCallback, useEffect, useMemo, useState } from 'react';
import { OUTLET_SLUG } from './repo';
import { storage } from './storage';
import type { GuestRepo, Item, Menu } from './types';

const MENU_CACHE = `chq-menu-cache-v1:${OUTLET_SLUG}`;
const POLL_MS = 60_000;

/** Used by the crash screen: a bad saved copy should never keep the menu broken after a reload. */
export const clearMenuCache = () => storage.remove(MENU_CACHE);

const readCache = (): Menu | null => {
  const m = storage.get<Menu>(MENU_CACHE);
  // A cache from an older app version must never crash the page.
  return m && Array.isArray(m.items) && Array.isArray(m.categories) && m.outlet ? m : null;
};

/**
 * Stale-while-revalidate: paint the last known menu instantly (café Wi-Fi is often poor),
 * then refresh from the backend. Refreshes again when the tab regains focus and every 60 s (FR-06).
 * `stale` is true when the screen shows a saved copy because the latest refresh failed.
 */
export function useMenu<R extends GuestRepo>(getRepo: () => Promise<R>, opts: { cache: boolean }) {
  const [menu, setMenu] = useState<Menu | null>(() => (opts.cache ? readCache() : null));
  const [error, setError] = useState<string | null>(null);
  const [repo, setRepo] = useState<R | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await getRepo();
      setRepo(r);
      const m = await r.load();
      setMenu(m);
      setError(null);
      if (opts.cache) storage.set(MENU_CACHE, m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load menu');
    }
  }, [getRepo, opts.cache]);

  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    refresh();
    getRepo().then((r) => {
      if (!cancelled) unsub = r.subscribe(refresh);
    });
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    const poll = setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS);
    return () => {
      cancelled = true;
      unsub();
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(poll);
    };
  }, [getRepo, refresh]);

  return { menu, setMenu, error, stale: Boolean(menu && error), repo, refresh };
}

/* ---------------- Cart ("My list") ---------------- */

const CART_KEY = `chq-cart-v1:${OUTLET_SLUG}`;
const CART_TTL_MS = 6 * 60 * 60 * 1000; // a list from yesterday's visit should not greet today's guest

interface StoredCart {
  savedAt: number;
  lines: Record<string, number>; // itemId -> qty
}

export interface CartLine {
  item: Item;
  qty: number;
}

export function useCart(menu: Menu | null) {
  const [lines, setLines] = useState<Record<string, number>>(() => {
    const c = storage.get<StoredCart>(CART_KEY);
    return c && Date.now() - c.savedAt < CART_TTL_MS ? c.lines : {};
  });

  useEffect(() => {
    if (Object.keys(lines).length === 0) storage.remove(CART_KEY);
    else storage.set(CART_KEY, { savedAt: Date.now(), lines } satisfies StoredCart);
  }, [lines]);

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, 50);
      return next;
    });
  }, []);

  const clear = useCallback(() => setLines({}), []);

  // Reconcile against the live menu: prices always come from the menu, never from the stored cart;
  // deleted or hidden items drop out; unavailable ones stay but are flagged and excluded from the total.
  const view = useMemo(() => {
    const byId = new Map(menu?.items.map((i) => [i.id, i]) ?? []);
    const activeCats = new Set(menu?.categories.filter((c) => c.isActive).map((c) => c.id) ?? []);
    const valid: CartLine[] = [];
    const unavailable: CartLine[] = [];
    for (const [id, qty] of Object.entries(lines)) {
      const item = byId.get(id);
      if (!item || !item.isActive || !activeCats.has(item.categoryId)) continue;
      (item.isAvailable ? valid : unavailable).push({ item, qty });
    }
    const count = valid.reduce((s, l) => s + l.qty, 0);
    const total = valid.reduce((s, l) => s + l.qty * l.item.price, 0);
    return { valid, unavailable, count, total };
  }, [lines, menu]);

  return { lines, setQty, clear, ...view };
}

export const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');
