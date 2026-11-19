import raw from './seed.json';
import type { Category, FoodType, Item, Menu } from '../types';

type RawItem = [string, number, FoodType, string?, string?]; // name, price, type, description, size

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Expands the compact seed.json into normalized rows. Used by demo mode and by scripts/gen-seed-sql.mjs. */
export function buildSeedMenu(): Menu {
  const categories: Category[] = [];
  const items: Item[] = [];
  raw.categories.forEach((c, ci) => {
    const categoryId = 'cat-' + slug(c.name);
    categories.push({ id: categoryId, name: c.name, sortOrder: (ci + 1) * 10, isActive: true });
    let order = 0;
    for (const s of c.sections as { name: string; size?: string; items: RawItem[] }[]) {
      for (const [name, price, foodType, description = '', size] of s.items) {
        order += 10;
        items.push({
          id: 'item-' + slug(name),
          categoryId,
          section: s.name,
          name,
          description,
          price,
          size: size ?? s.size ?? '',
          foodType,
          isAvailable: true,
          isActive: true,
          isBestseller: false,
          imageUrl: '',
          sortOrder: order,
        });
      }
    }
  });
  return { outlet: raw.outlet, categories, items };
}
