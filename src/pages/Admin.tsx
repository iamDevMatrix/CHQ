import { useEffect, useMemo, useState } from 'react';
import { rupees, useMenu } from '../hooks';
import { getAdminRepo } from '../repo';
import { newId, patchById, type Category, type CategoryPatch, type FoodType, type Item, type ItemPatch, type Menu } from '../types';
import { FoodMark } from './GuestMenu';
import { FeedbackInbox, OutletSettings, PartnerInbox } from './AdminExtras';

type Tab = 'menu' | 'feedback' | 'partners' | 'settings';

type Filter = 'all' | 'unavailable' | 'hidden';

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function Login({ onDone, signIn }: { onDone: () => void; signIn: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="login"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        try {
          await signIn(email, pw);
          onDone();
        } catch (x) {
          setErr(x instanceof Error ? x.message : 'Sign-in failed');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1>Menu admin</h1>
      <input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      {err && <p className="error">{err}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

function NameDialog({ title, initial, onSave, onClose }: { title: string; initial: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet editor" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSave(v.trim()); onClose(); } }}>
        <div className="sheet-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        <label>Category name<input autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={60} /></label>
        <div className="sheet-actions"><button className="primary" disabled={!v.trim()}>Save</button></div>
      </form>
    </div>
  );
}

const blankItem = (categoryId: string, sortOrder: number, section = ''): Item => ({
  id: newId(), categoryId, section, name: '', description: '', price: 0, size: '', foodType: 'veg',
  isAvailable: true, isActive: true, isBestseller: false, imageUrl: '', sortOrder,
});

/** Only the fields the person changed, so a save never overwrites someone else's edit to another field. */
function diff(before: Item, after: Item): ItemPatch {
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(after) as (keyof Item)[]) if (k !== 'id' && before[k] !== after[k]) patch[k] = after[k];
  return patch as ItemPatch;
}

const nextSortOrder = (menu: Menu, categoryId: string) =>
  Math.max(0, ...menu.items.filter((i) => i.categoryId === categoryId).map((i) => i.sortOrder)) + 10;

function ItemEditor({ item, menu, isNew, onSave, onDelete, onClose }: {
  item: Item; menu: Menu; isNew: boolean;
  onSave: (i: Item) => Promise<boolean>; onDelete: (i: Item) => Promise<boolean>; onClose: () => void;
}) {
  const [d, setD] = useState<Item>(item);
  const [priceText, setPriceText] = useState(isNew ? '' : String(item.price));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setD((p) => ({ ...p, [k]: v }));
  const sections = useMemo(
    () => [...new Set(menu.items.filter((i) => i.categoryId === d.categoryId).map((i) => i.section))],
    [menu.items, d.categoryId],
  );

  const save = async () => {
    setErr('');
    const price = Number(priceText);
    if (!d.name.trim()) return setErr('Name is required.');
    if (!/^\d{1,5}$/.test(priceText.trim())) return setErr('Price must be a whole number of rupees (0 to 99999).');
    if (d.imageUrl.trim() && !/^https:\/\/\S+$/.test(d.imageUrl.trim())) return setErr('Image URL must start with https://');
    const dup = menu.items.find((i) => i.id !== d.id && i.name.trim().toLowerCase() === d.name.trim().toLowerCase());
    if (dup) return setErr(`An item named "${dup.name}" already exists.`);
    const final: Item = {
      ...d,
      name: d.name.trim(),
      price,
      section: d.section.trim() || menu.categories.find((c) => c.id === d.categoryId)?.name || '',
      // Moving to another category: put it at the end there, so its order never clashes with an existing item.
      sortOrder: d.categoryId !== item.categoryId ? nextSortOrder(menu, d.categoryId) : d.sortOrder,
    };
    setBusy(true);
    const ok = await onSave(final);
    setBusy(false);
    if (ok) onClose();
    else setErr('Not saved. Check your connection and try again; your changes are still here.');
  };

  const del = async () => {
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    const ok = await onDelete(d);
    setBusy(false);
    if (ok) onClose();
    else setErr('Not deleted. Check your connection and try again.');
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={isNew ? 'Add item' : 'Edit item'}>
        <div className="sheet-head">
          <h2>{isNew ? 'Add item' : 'Edit item'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <label>Name<input value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={80} /></label>
        <div className="row2">
          <label>Price (₹)<input inputMode="numeric" value={priceText} onChange={(e) => setPriceText(e.target.value.replace(/[^\d]/g, '').slice(0, 5))} /></label>
          <label>Size / qty<input value={d.size} onChange={(e) => set('size', e.target.value)} placeholder="250 ml, 4 pcs" maxLength={20} /></label>
        </div>
        <div className="row2">
          <label>Category
            <select value={d.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {menu.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Section
            <input value={d.section} onChange={(e) => set('section', e.target.value)} list="sections" placeholder="e.g. Tea" maxLength={40} />
            <datalist id="sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
        </div>
        <label>Description<textarea value={d.description} onChange={(e) => set('description', e.target.value)} rows={2} maxLength={200} /></label>
        <label>Type
          <div className="seg">
            {(['veg', 'egg', 'nonveg'] as FoodType[]).map((t) => (
              <button key={t} type="button" className={d.foodType === t ? 'on' : ''} onClick={() => set('foodType', t)}>
                <FoodMark type={t} /> {t === 'nonveg' ? 'Non-veg' : t === 'egg' ? 'Egg' : 'Veg'}
              </button>
            ))}
          </div>
        </label>
        <label>Image URL (optional)<input value={d.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" /></label>
        <div className="toggles">
          <div><span>In stock</span><Switch on={d.isAvailable} onChange={(v) => set('isAvailable', v)} label="In stock" /></div>
          <div><span>Show on menu</span><Switch on={d.isActive} onChange={(v) => set('isActive', v)} label="Show on menu" /></div>
          <div><span>Bestseller tag</span><Switch on={d.isBestseller} onChange={(v) => set('isBestseller', v)} label="Bestseller" /></div>
        </div>
        {err && <p className="error" role="alert">{err}</p>}
        <div className="sheet-actions">
          {!isNew && (
            <button className="ghost danger" disabled={busy} onClick={del}>{confirmDel ? 'Tap again to delete' : 'Delete'}</button>
          )}
          <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { menu, setMenu, repo, refresh, error, stale } = useMenu(getAdminRepo, { cache: false });
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ item: Item; isNew: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const [naming, setNaming] = useState<{ cat: Category | null } | null>(null);
  const [tab, setTab] = useState<Tab>('menu');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    repo?.currentUser().then(setUser);
  }, [repo]);

  // A signed-in account that is not in outlet_admins can read but every write is blocked by RLS. Say so up front.
  useEffect(() => {
    if (!repo || !user) return;
    setIsAdmin(undefined);
    repo.isOutletAdmin().then(setIsAdmin).catch(() => setIsAdmin(undefined));
  }, [repo, user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!repo || user === undefined) return <div className="center-msg">{error ?? 'Loading…'}</div>;
  if (user === null) return <Login signIn={repo.signIn} onDone={() => { repo.currentUser().then(setUser); refresh(); }} />;
  const signOut = async () => { await repo.signOut(); setUser(null); setIsAdmin(undefined); };
  if (isAdmin === false)
    return (
      <div className="center-msg">
        <p>{user} is signed in but is not set up to edit this café&apos;s menu.</p>
        <p className="muted small">Ask the account owner to add this login as an admin (README, step 4).</p>
        <button className="ghost" onClick={signOut}>Sign out</button>
      </div>
    );
  if (!menu || isAdmin === undefined) return <div className="center-msg">{error ?? 'Loading…'}</div>;

  /**
   * Optimistic write: update the screen now, persist, and on failure refetch the truth.
   * Returns false on failure so editors can stay open instead of losing what was typed.
   */
  const commit = async (apply: (m: Menu) => Menu, persist: () => Promise<unknown>, msg: string): Promise<boolean> => {
    setMenu((m) => (m ? apply(m) : m));
    try {
      await persist();
      setToast(msg);
      return true;
    } catch (e) {
      setToast('Not saved: ' + (e instanceof Error ? e.message : 'error'));
      refresh();
      return false;
    }
  };

  const patchItem = (id: string, patch: ItemPatch, msg: string) =>
    commit((m) => ({ ...m, items: patchById(m.items, id, patch) }), () => repo.updateItem(id, patch), msg);
  const patchCat = (id: string, patch: CategoryPatch, msg: string) =>
    commit((m) => ({ ...m, categories: patchById(m.categories, id, patch) }), () => repo.updateCategory(id, patch), msg);

  const saveFromEditor = (before: Item, after: Item, isNew: boolean): Promise<boolean> => {
    if (isNew) return commit((m) => ({ ...m, items: [...m.items, after] }), () => repo.createItem(after), 'Item added');
    const patch = diff(before, after);
    if (Object.keys(patch).length === 0) return Promise.resolve(true);
    return patchItem(after.id, patch, 'Saved');
  };

  const cats = [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const needle = q.trim().toLowerCase();
  const visibleItems = (catId: string) =>
    menu.items
      .filter((i) => i.categoryId === catId)
      .filter((i) => (filter === 'unavailable' ? !i.isAvailable : filter === 'hidden' ? !i.isActive : true))
      .filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.section.toLowerCase().includes(needle))
      .sort((a, b) => a.sortOrder - b.sortOrder);

  /** Swap two rows' positions. Each row gets only its new sortOrder written. */
  const swap = <T extends { id: string; sortOrder: number }>(list: T[], a: T, b: T): T[] =>
    list.map((x) => (x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x));

  const moveItem = (item: Item, dir: -1 | 1) => {
    const list = menu.items.filter((i) => i.categoryId === item.categoryId).sort((a, b) => a.sortOrder - b.sortOrder);
    const other = list[list.findIndex((i) => i.id === item.id) + dir];
    if (!other) return;
    commit(
      (m) => ({ ...m, items: swap(m.items, item, other) }),
      () => Promise.all([repo.updateItem(item.id, { sortOrder: other.sortOrder }), repo.updateItem(other.id, { sortOrder: item.sortOrder })]),
      'Reordered',
    );
  };
  const moveCat = (c: Category, dir: -1 | 1) => {
    const other = cats[cats.findIndex((x) => x.id === c.id) + dir];
    if (!other) return;
    commit(
      (m) => ({ ...m, categories: swap(m.categories, c, other) }),
      () => Promise.all([repo.updateCategory(c.id, { sortOrder: other.sortOrder }), repo.updateCategory(other.id, { sortOrder: c.sortOrder })]),
      'Reordered',
    );
  };

  const saveName = (cat: Category | null, name: string) => {
    if (menu.categories.some((c) => c.id !== cat?.id && c.name.toLowerCase() === name.toLowerCase())) return setToast('A category with that name exists');
    if (cat) {
      if (name !== cat.name) patchCat(cat.id, { name }, 'Renamed');
    } else {
      const c: Category = { id: newId(), name, sortOrder: Math.max(0, ...menu.categories.map((x) => x.sortOrder)) + 10, isActive: true };
      commit((m) => ({ ...m, categories: [...m.categories, c] }), () => repo.createCategory(c), 'Category added');
    }
  };

  const deleteCat = (c: Category) => {
    if (menu.items.some((i) => i.categoryId === c.id)) return setToast('Move or delete its items first');
    commit((m) => ({ ...m, categories: m.categories.filter((x) => x.id !== c.id) }), () => repo.deleteCategory(c.id), 'Category deleted');
  };

  const markAllInStock = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    setConfirmReset(false);
    let n = 0;
    await commit((m) => ({ ...m, items: m.items.map((i) => ({ ...i, isAvailable: true })) }), async () => { n = await repo.markAllInStock(); }, 'All items in stock');
    if (n) setToast(`${n} item${n === 1 ? '' : 's'} back in stock`);
  };

  const resetDemo = async () => {
    (await import('../repo/demo')).resetDemo();
    setToast('Demo data reset');
  };

  const unavailableCount = menu.items.filter((i) => !i.isAvailable).length;
  const hiddenCount = menu.items.filter((i) => !i.isActive).length;

  return (
    <div className="admin">
      <header className="admin-head">
        <div>
          <h1>{menu.outlet.name} · Menu admin</h1>
          <p className="muted">{menu.items.length} items · {unavailableCount} out of stock · {hiddenCount} hidden</p>
        </div>
        <div className="admin-actions">
          <a className="ghost btn" href="#/">View guest menu</a>
          {repo.mode === 'demo'
            ? <button className="ghost" onClick={resetDemo}>Reset demo</button>
            : <button className="ghost" onClick={signOut}>Sign out</button>}
        </div>
      </header>

      {repo.mode === 'demo' && (
        <p className="demo-banner">Demo mode: edits are stored in this browser only. Connect Supabase (see README) for live, shared menus.</p>
      )}
      {stale && <p className="notice" role="status">Offline: showing the last loaded menu. Changes may not save until the connection is back.</p>}

      <nav className="tabs" aria-label="Admin sections">
        {([['menu', 'Menu'], ['feedback', 'Feedback'], ['partners', 'Partner enquiries'], ['settings', 'Café settings']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
        ))}
      </nav>

      {tab === 'feedback' && <FeedbackInbox repo={repo} />}
      {tab === 'partners' && <PartnerInbox repo={repo} />}
      {tab === 'settings' && (
        <OutletSettings outlet={menu.outlet} onSave={(o) => commit((m) => ({ ...m, outlet: o }), () => repo.saveOutlet(o), 'Settings saved')} />
      )}

      {tab === 'menu' && <>
      <div className="admin-tools">
        <input type="search" placeholder="Find item…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find item" />
        <div className="seg">
          {(['all', 'unavailable', 'hidden'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'unavailable' ? `Out of stock (${unavailableCount})` : `Hidden (${hiddenCount})`}
            </button>
          ))}
        </div>
        {unavailableCount > 0 && (
          <button className={`ghost ${confirmReset ? 'danger' : ''}`} onClick={markAllInStock}>
            {confirmReset ? `Tap again: mark ${unavailableCount} back in stock` : 'Mark all in stock'}
          </button>
        )}
      </div>

      {cats.map((c, ci) => {
        const items = visibleItems(c.id);
        if ((filter !== 'all' || needle) && items.length === 0) return null;
        return (
          <section key={c.id} className={`admin-cat ${c.isActive ? '' : 'cat-off'}`}>
            <div className="admin-cat-head">
              <div className="order-btns">
                <button onClick={() => moveCat(c, -1)} disabled={ci === 0} aria-label={`Move ${c.name} up`}>↑</button>
                <button onClick={() => moveCat(c, 1)} disabled={ci === cats.length - 1} aria-label={`Move ${c.name} down`}>↓</button>
              </div>
              <h2><button className="cat-name" onClick={() => setNaming({ cat: c })} title="Rename category">{c.name}</button></h2>
              <span className="muted small">{c.isActive ? 'Visible' : 'Hidden'}</span>
              <Switch on={c.isActive} onChange={(v) => patchCat(c.id, { isActive: v }, v ? 'Category shown' : 'Category hidden')} label={`Show ${c.name}`} />
            </div>
            <ul>
              {items.map((it, ii) => (
                <li key={it.id} className={`admin-item ${it.isAvailable ? '' : 'item-off'} ${it.isActive ? '' : 'item-hidden'}`}>
                  <div className="order-btns">
                    <button onClick={() => moveItem(it, -1)} disabled={ii === 0 || !!needle || filter !== 'all'} aria-label={`Move ${it.name} up`}>↑</button>
                    <button onClick={() => moveItem(it, 1)} disabled={ii === items.length - 1 || !!needle || filter !== 'all'} aria-label={`Move ${it.name} down`}>↓</button>
                  </div>
                  <button className="admin-item-body" onClick={() => setEditing({ item: it, isNew: false })}>
                    <span className="item-title"><FoodMark type={it.foodType} /> {it.name}</span>
                    <span className="muted small">{it.section} · {rupees(it.price)}{it.size ? ' · ' + it.size : ''}{it.isActive ? '' : ' · hidden'}</span>
                  </button>
                  <Switch on={it.isAvailable} onChange={(v) => patchItem(it.id, { isAvailable: v }, v ? `${it.name} back in stock` : `${it.name} marked out of stock`)} label={`${it.name} in stock`} />
                </li>
              ))}
            </ul>
            <div className="cat-foot">
              <button className="link" onClick={() => {
                const lastSection = menu.items.filter((i) => i.categoryId === c.id).sort((a, b) => b.sortOrder - a.sortOrder)[0]?.section ?? c.name;
                setEditing({ item: blankItem(c.id, nextSortOrder(menu, c.id), lastSection), isNew: true });
              }}>+ Add item</button>
              {menu.items.every((i) => i.categoryId !== c.id) && <button className="link danger" onClick={() => deleteCat(c)}>Delete category</button>}
            </div>
          </section>
        );
      })}

      <button className="ghost wide" onClick={() => setNaming({ cat: null })}>+ Add category</button>
      </>}

      {editing && (
        <ItemEditor
          item={editing.item}
          isNew={editing.isNew}
          menu={menu}
          onClose={() => setEditing(null)}
          onSave={(i) => saveFromEditor(editing.item, i, editing.isNew)}
          onDelete={(i) => commit((m) => ({ ...m, items: m.items.filter((x) => x.id !== i.id) }), () => repo.deleteItem(i.id), 'Deleted')}
        />
      )}

      {naming && (
        <NameDialog title={naming.cat ? 'Rename category' : 'Add category'} initial={naming.cat?.name ?? ''} onClose={() => setNaming(null)} onSave={(v) => saveName(naming.cat, v)} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
