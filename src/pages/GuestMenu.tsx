import { useEffect, useMemo, useRef, useState } from 'react';
import { rupees, useCart, useMenu } from '../hooks';
import { getGuestRepo } from '../repo';
import { AboutPanel, FeedbackForm, Splash } from './Extras';
import type { Category, FoodType, Item } from '../types';

const MENU_OPTS = { cache: true };
const tableNo = new URLSearchParams(window.location.search).get('t')?.slice(0, 8) ?? '';

export function FoodMark({ type }: { type: FoodType }) {
  const label = type === 'veg' ? 'Veg' : type === 'egg' ? 'Contains egg' : 'Non-veg';
  return <span className={`food food-${type}`} role="img" aria-label={label} title={label} />;
}

function Stepper({ qty, onChange, name }: { qty: number; onChange: (q: number) => void; name: string }) {
  if (qty === 0)
    return (
      <button className="add-btn" onClick={() => onChange(1)} aria-label={`Add ${name}`}>
        ADD
      </button>
    );
  return (
    <div className="stepper" role="group" aria-label={`${name} quantity`}>
      <button onClick={() => onChange(qty - 1)} aria-label="Decrease">−</button>
      <span aria-live="polite">{qty}</span>
      <button onClick={() => onChange(qty + 1)} aria-label="Increase">+</button>
    </div>
  );
}

function ItemRow({ item, qty, setQty }: { item: Item; qty: number; setQty: (q: number) => void }) {
  return (
    <li className={`item ${item.isAvailable ? '' : 'item-off'}`}>
      <div className="item-main">
        <div className="item-title">
          <FoodMark type={item.foodType} />
          <span className="item-name">{item.name}</span>
          {item.isBestseller && <span className="badge">Bestseller</span>}
        </div>
        <div className="item-meta">
          <span className="price">{rupees(item.price)}</span>
          {item.size && <span className="size">· {item.size}</span>}
        </div>
        {item.description && <p className="desc">{item.description}</p>}
      </div>
      <div className="item-side">
        {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" className="thumb" />}
        {item.isAvailable ? <Stepper qty={qty} onChange={setQty} name={item.name} /> : <span className="off-label">Currently unavailable</span>}
      </div>
    </li>
  );
}

export default function GuestMenu() {
  const { menu, error, stale } = useMenu(getGuestRepo, MENU_OPTS);
  const cart = useCart(menu);
  const [query, setQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [activeCat, setActiveCat] = useState<string>('');
  const [sheet, setSheet] = useState<'closed' | 'list' | 'staff' | 'about' | 'feedback'>('closed');
  const chipsRef = useRef<HTMLDivElement>(null);
  const [isDemo, setIsDemo] = useState(false);
  useEffect(() => { getGuestRepo().then((r) => setIsDemo(r.mode === 'demo')); }, []);

  // Guests only ever see active categories/items; available=false items stay visible but greyed.
  const groups = useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLowerCase();
    const cats = menu.categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    return cats
      .map((cat) => {
        const items = menu.items
          .filter((i) => i.categoryId === cat.id && i.isActive)
          .filter((i) => !vegOnly || i.foodType === 'veg')
          .filter((i) => !q || i.name.toLowerCase().includes(q) || i.section.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const sections: { name: string; items: Item[] }[] = [];
        for (const it of items) {
          const last = sections[sections.length - 1];
          if (last && last.name === it.section) last.items.push(it);
          else sections.push({ name: it.section, items: [it] });
        }
        return { cat, sections, count: items.length };
      })
      .filter((g) => g.count > 0);
  }, [menu, query, vegOnly]);

  // Scroll-spy: highlight the chip for the category in view.
  useEffect(() => {
    const els = groups.map((g) => document.getElementById('c-' + g.cat.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveCat(top.target.id.slice(2));
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [groups]);

  useEffect(() => {
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`);
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeCat]);

  // Lock background scroll while the sheet is open (iOS Safari otherwise scrolls the page behind).
  useEffect(() => {
    document.body.style.overflow = sheet === 'closed' ? '' : 'hidden';
  }, [sheet]);

  const jump = (c: Category) => {
    const el = document.getElementById('c-' + c.id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 112, behavior: 'smooth' });
  };

  if (!menu)
    return <div className="center-msg">{error ? <>Menu could not load. Please check your connection and refresh.<br /><small>{error}</small></> : 'Loading menu…'}</div>;

  return (
    <div className="guest">
      <Splash outlet={menu.outlet} />
      <header className="brand">
        <div className="brand-text">
          <h1>{menu.outlet.name}</h1>
          <p className="tagline">{menu.outlet.tagline}</p>
        </div>
        {tableNo && <span className="table-tag">Table {tableNo}</span>}
        <button className="about-btn" onClick={() => setSheet('about')} aria-label="About, feedback and partner with us">
          <span /><span /><span />
        </button>
      </header>

      <div className="sticky-bar">
        <div className="search-row">
          <input
            type="search"
            inputMode="search"
            placeholder="Search chai, shakes, burger…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search menu"
          />
          <label className={`veg-toggle ${vegOnly ? 'on' : ''}`}>
            <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} />
            <FoodMark type="veg" /> Veg only
          </label>
        </div>
        <nav className="chips" ref={chipsRef} aria-label="Menu categories">
          {groups.map((g) => (
            <button key={g.cat.id} data-cat={g.cat.id} className={`chip ${activeCat === g.cat.id ? 'active' : ''}`} onClick={() => jump(g.cat)}>
              {g.cat.name}
            </button>
          ))}
        </nav>
      </div>

      <main>
        {stale && <p className="notice" role="status">Could not refresh the menu. Showing a saved copy: prices and availability may have changed.</p>}
        {groups.length === 0 && <p className="center-msg">No items match “{query}”.</p>}
        {groups.map(({ cat, sections }) => (
          <section key={cat.id} id={'c-' + cat.id} className="category">
            <h2>{cat.name}</h2>
            {sections.map((s) => (
              <div key={s.name} className="section">
                {(sections.length > 1 || s.name !== cat.name) && <h3>{s.name}</h3>}
                <ul>
                  {s.items.map((it) => (
                    <ItemRow key={it.id} item={it} qty={cart.lines[it.id] ?? 0} setQty={(q) => cart.setQty(it.id, q)} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
        <footer className="foot">
          <nav className="foot-links" aria-label="More">
            <button className="link" onClick={() => setSheet('about')}>About us</button>
            <button className="link" onClick={() => setSheet('feedback')}>Feedback</button>
            <button className="link" onClick={() => { setSheet('about'); setTimeout(() => document.getElementById('partner')?.scrollIntoView({ behavior: 'smooth' }), 50); }}>Partner with us</button>
          </nav>
          <p>{menu.outlet.tagline}</p>
          <p>
            <a href={`tel:${menu.outlet.phone}`}>{menu.outlet.phone}</a> · <a href={`mailto:${menu.outlet.email}`}>{menu.outlet.email}</a>
          </p>
          <p className="fine">Prices in INR. Please ask our staff about allergens.</p>
          {isDemo && <p><a href="#/admin" className="demo-admin">Demo: open admin panel →</a></p>}
        </footer>
      </main>

      {cart.count > 0 && sheet === 'closed' && (
        <button className="cart-bar" onClick={() => setSheet('list')}>
          <span>
            {cart.count} item{cart.count > 1 ? 's' : ''} · {rupees(cart.total)}
          </span>
          <span>View my list ›</span>
        </button>
      )}

      {(sheet === 'about' || sheet === 'feedback') && (
        <div className="sheet-backdrop" onClick={() => setSheet('closed')}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={sheet === 'about' ? 'About' : 'Feedback'}>
            <div className="sheet-head">
              {sheet === 'feedback'
                ? <h2><button className="back-btn" onClick={() => setSheet('about')} aria-label="Back to About">‹</button> Feedback</h2>
                : <h2>{menu.outlet.name}</h2>}
              <button className="icon-btn" onClick={() => setSheet('closed')} aria-label="Close">✕</button>
            </div>
            {sheet === 'about'
              ? <AboutPanel outlet={menu.outlet} onFeedback={() => setSheet('feedback')} />
              : <FeedbackForm tableNo={tableNo} email={menu.outlet.email} onDone={() => setSheet('closed')} />}
          </div>
        </div>
      )}

      {(sheet === 'list' || sheet === 'staff') && (
        <div className="sheet-backdrop" onClick={() => setSheet('closed')}>
          <div className={`sheet ${sheet === 'staff' ? 'staff' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="My list">
            <div className="sheet-head">
              <h2>{sheet === 'staff' ? `Order list${tableNo ? ' · Table ' + tableNo : ''}` : 'My list'}</h2>
              <button className="icon-btn" onClick={() => setSheet('closed')} aria-label="Close">✕</button>
            </div>

            {sheet === 'list' && <p className="note">Online ordering isn't available yet. Save your picks here and show this list to our staff to order.</p>}

            <ul className="cart-lines">
              {cart.valid.map(({ item, qty }) => (
                <li key={item.id}>
                  <FoodMark type={item.foodType} />
                  <span className="cl-name">{item.name}</span>
                  {sheet === 'staff' ? <span className="cl-qty">× {qty}</span> : <Stepper qty={qty} onChange={(q) => cart.setQty(item.id, q)} name={item.name} />}
                  <span className="cl-amt">{rupees(item.price * qty)}</span>
                </li>
              ))}
            </ul>

            {cart.unavailable.length > 0 && sheet === 'list' && (
              <div className="unavail">
                <p>No longer available right now:</p>
                {cart.unavailable.map(({ item }) => (
                  <div key={item.id} className="unavail-row">
                    <span>{item.name}</span>
                    <button className="link" onClick={() => cart.setQty(item.id, 0)}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div className="cart-total">
              <span>Estimated total</span>
              <strong>{rupees(cart.total)}</strong>
            </div>
            <p className="fine">Final bill at the counter may include applicable taxes.</p>

            {sheet === 'list' ? (
              <div className="sheet-actions">
                <button className="ghost" onClick={() => { cart.clear(); setSheet('closed'); }}>Clear list</button>
                <button className="primary" onClick={() => setSheet('staff')} disabled={cart.count === 0}>Show to staff</button>
              </div>
            ) : (
              <div className="sheet-actions">
                <button className="ghost" onClick={() => setSheet('list')}>Back to edit</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
