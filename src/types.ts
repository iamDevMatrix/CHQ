export type FoodType = 'veg' | 'egg' | 'nonveg';

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean; // false = whole category hidden from guests
}

export interface Item {
  id: string;
  categoryId: string;
  section: string; // sub-heading inside a category, e.g. "Tea", "Coffee"
  name: string;
  description: string;
  price: number; // whole rupees
  size: string; // "110 ml", "4 pcs"
  foodType: FoodType;
  isAvailable: boolean; // false = shown greyed out, "Currently unavailable" (Zomato/Swiggy style)
  isActive: boolean; // false = hidden from guests entirely
  isBestseller: boolean;
  imageUrl: string;
  sortOrder: number;
}

export interface Outlet {
  slug: string;
  name: string;
  tagline: string;
  phone: string;
  email: string;
  announcement: string; // splash screen text; empty = no splash
  address: string;
  about: string;
  partnerText: string;
  websiteUrl: string; // e.g. Chai City site; empty = link hidden
  websiteLabel: string;
}

export interface Feedback {
  id: string;
  rating: number; // 1-5
  comment: string;
  name: string;
  phone: string;
  tableNo: string;
  createdAt: string;
}

export interface PartnerEnquiry {
  id: string;
  name: string;
  phone: string;
  city: string;
  message: string;
  createdAt: string;
}

export interface Menu {
  outlet: Outlet;
  categories: Category[];
  items: Item[];
}

export type ItemPatch = Partial<Omit<Item, 'id'>>;
export type CategoryPatch = Partial<Omit<Category, 'id'>>;

/** What the guest page needs. In production this is plain fetch, no Supabase library (keeps the guest download small). */
export interface GuestRepo {
  readonly mode: 'demo' | 'supabase';
  load(): Promise<Menu>;
  /** Fires when menu data changes in another tab (demo only). Returns unsubscribe. */
  subscribe(onChange: () => void): () => void;
  submitFeedback(f: Omit<Feedback, 'id' | 'createdAt'>): Promise<void>;
  submitPartner(p: Omit<PartnerEnquiry, 'id' | 'createdAt'>): Promise<void>;
}

/**
 * Admin writes send only the fields that changed, so two staff editing at once
 * never overwrite each other's changes with a stale copy of the row.
 */
export interface AdminRepo extends GuestRepo {
  createCategory(c: Category): Promise<void>;
  updateCategory(id: string, patch: CategoryPatch): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  createItem(i: Item): Promise<void>;
  updateItem(id: string, patch: ItemPatch): Promise<void>;
  deleteItem(id: string): Promise<void>;
  /** FR-25: start-of-day reset. Returns how many items changed. */
  markAllInStock(): Promise<number>;
  saveOutlet(o: Outlet): Promise<void>;
  listFeedback(): Promise<Feedback[]>;
  listPartners(): Promise<PartnerEnquiry[]>;
  deleteFeedback(id: string): Promise<void>;
  deletePartner(id: string): Promise<void>;
  currentUser(): Promise<string | null>;
  /** True only if the signed-in user is listed in outlet_admins for this outlet. */
  isOutletAdmin(): Promise<boolean>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

/** UUID v4. crypto.randomUUID is missing before iOS 15.4; getRandomValues works back to iOS 11. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Applies a patch to a list row by id. Shared by the demo repo and the admin's optimistic updates. */
export const patchById = <T extends { id: string }>(list: T[], id: string, patch: Partial<NoInfer<T>>): T[] =>
  list.map((x) => (x.id === id ? { ...x, ...patch } : x));
