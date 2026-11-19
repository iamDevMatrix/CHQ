import { buildSeedMenu } from '../data/seed';
import { newId, patchById, type AdminRepo, type Feedback, type Menu, type PartnerEnquiry } from '../types';
import { storage } from '../storage';

/**
 * Demo repo: the whole menu lives in this browser's localStorage.
 * Lets the client click through guest + admin flows with zero backend.
 * Admin edits are visible only on the same browser. Production builds refuse to ship without Supabase (vite.config.ts).
 */
const KEY = 'chq-menu-demo-v3'; // bump when seed.json changes so open demos pick up the new menu
const EVT = 'chq-menu-demo-change';
const FB_KEY = 'chq-demo-feedback-v1';
const PARTNER_KEY = 'chq-demo-partners-v1';

function read(): Menu {
  const cached = storage.get<Menu>(KEY);
  const seed = buildSeedMenu();
  // Older demo data may predate newer outlet fields: fill gaps from the seed.
  if (cached) return { ...cached, outlet: { ...seed.outlet, ...cached.outlet } };
  storage.set(KEY, seed);
  return seed;
}

function write(m: Menu) {
  storage.set(KEY, m);
  window.dispatchEvent(new Event(EVT));
}

function mutate<T = void>(fn: (m: Menu) => T): T {
  const m = read();
  const out = fn(m);
  write(m);
  return out;
}

const requireRow = (found: boolean) => {
  if (!found) throw new Error('the row was deleted by someone else.');
};

export const demoRepo: AdminRepo = {
  mode: 'demo',
  async load() {
    return read();
  },
  subscribe(onChange) {
    const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
    window.addEventListener('storage', onStorage); // other tabs
    window.addEventListener(EVT, onChange); // same tab
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVT, onChange);
    };
  },
  async createCategory(c) {
    mutate((m) => {
      m.categories.push(c);
    });
  },
  async updateCategory(id, patch) {
    mutate((m) => {
      requireRow(m.categories.some((c) => c.id === id));
      m.categories = patchById(m.categories, id, patch);
    });
  },
  async deleteCategory(id) {
    mutate((m) => {
      if (m.items.some((i) => i.categoryId === id)) throw new Error('Move or delete the items in this category first.');
      m.categories = m.categories.filter((c) => c.id !== id);
    });
  },
  async createItem(i) {
    mutate((m) => {
      m.items.push(i);
    });
  },
  async updateItem(id, patch) {
    mutate((m) => {
      requireRow(m.items.some((i) => i.id === id));
      m.items = patchById(m.items, id, patch);
    });
  },
  async deleteItem(id) {
    mutate((m) => {
      m.items = m.items.filter((i) => i.id !== id);
    });
  },
  async markAllInStock() {
    return mutate((m) => {
      const n = m.items.filter((i) => !i.isAvailable).length;
      m.items = m.items.map((i) => ({ ...i, isAvailable: true }));
      return n;
    });
  },
  async submitFeedback(f) {
    const list = storage.get<Feedback[]>(FB_KEY) ?? [];
    list.unshift({ ...f, id: newId(), createdAt: new Date().toISOString() });
    storage.set(FB_KEY, list.slice(0, 200));
  },
  async submitPartner(p) {
    const list = storage.get<PartnerEnquiry[]>(PARTNER_KEY) ?? [];
    list.unshift({ ...p, id: newId(), createdAt: new Date().toISOString() });
    storage.set(PARTNER_KEY, list.slice(0, 200));
  },
  async saveOutlet(o) {
    mutate((m) => {
      m.outlet = o;
    });
  },
  async listFeedback() {
    return storage.get<Feedback[]>(FB_KEY) ?? [];
  },
  async listPartners() {
    return storage.get<PartnerEnquiry[]>(PARTNER_KEY) ?? [];
  },
  async deleteFeedback(id) {
    storage.set(FB_KEY, (storage.get<Feedback[]>(FB_KEY) ?? []).filter((f) => f.id !== id));
  },
  async deletePartner(id) {
    storage.set(PARTNER_KEY, (storage.get<PartnerEnquiry[]>(PARTNER_KEY) ?? []).filter((p) => p.id !== id));
  },
  async currentUser() {
    return 'demo-admin';
  },
  async isOutletAdmin() {
    return true;
  },
  async signIn() {},
  async signOut() {},
};

export function resetDemo() {
  write(buildSeedMenu());
}
