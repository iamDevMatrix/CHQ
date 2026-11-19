import type { Category, CategoryPatch, FoodType, Item, ItemPatch, Outlet } from '../types';

/** Database row shapes and mappers, shared by the guest (fetch) and admin (supabase-js) repos. */

export interface CategoryRow { id: string; outlet_id: string; name: string; sort_order: number; is_active: boolean }
export interface ItemRow {
  id: string; outlet_id: string; category_id: string; section: string; name: string; description: string;
  price: number; size: string; food_type: FoodType; is_available: boolean; is_active: boolean;
  is_bestseller: boolean; image_url: string; sort_order: number;
}
export interface OutletRow {
  id: string; slug: string; name: string; tagline: string; phone: string; email: string; announcement: string;
  address: string; about: string; partner_text: string; website_url: string; website_label: string;
}

export const OUTLET_COLS = 'id,slug,name,tagline,phone,email,announcement,address,about,partner_text,website_url,website_label';

export const toCategory = (r: CategoryRow): Category => ({ id: r.id, name: r.name, sortOrder: r.sort_order, isActive: r.is_active });
export const toItem = (r: ItemRow): Item => ({
  id: r.id, categoryId: r.category_id, section: r.section, name: r.name, description: r.description,
  price: r.price, size: r.size, foodType: r.food_type, isAvailable: r.is_available, isActive: r.is_active,
  isBestseller: r.is_bestseller, imageUrl: r.image_url, sortOrder: r.sort_order,
});
export const toOutlet = (r: OutletRow): Outlet => ({
  slug: r.slug, name: r.name, tagline: r.tagline, phone: r.phone, email: r.email, announcement: r.announcement,
  address: r.address, about: r.about, partnerText: r.partner_text, websiteUrl: r.website_url, websiteLabel: r.website_label,
});

const ITEM_COLS: Record<keyof ItemPatch, keyof ItemRow> = {
  categoryId: 'category_id', section: 'section', name: 'name', description: 'description', price: 'price', size: 'size',
  foodType: 'food_type', isAvailable: 'is_available', isActive: 'is_active', isBestseller: 'is_bestseller',
  imageUrl: 'image_url', sortOrder: 'sort_order',
};
const CATEGORY_COLS: Record<keyof CategoryPatch, keyof CategoryRow> = { name: 'name', sortOrder: 'sort_order', isActive: 'is_active' };

const toCols = (patch: object, map: Record<string, string>) =>
  Object.fromEntries(Object.entries(patch).map(([k, v]) => [map[k], typeof v === 'string' ? v.trim() : v]));

export const itemPatchRow = (p: ItemPatch) => toCols(p, ITEM_COLS);
export const categoryPatchRow = (p: CategoryPatch) => toCols(p, CATEGORY_COLS);
export const itemRow = (i: Item, outletId: string): ItemRow => ({
  id: i.id, outlet_id: outletId, category_id: i.categoryId, section: i.section.trim(), name: i.name.trim(),
  description: i.description.trim(), price: i.price, size: i.size.trim(), food_type: i.foodType,
  is_available: i.isAvailable, is_active: i.isActive, is_bestseller: i.isBestseller,
  image_url: i.imageUrl.trim(), sort_order: i.sortOrder,
});
