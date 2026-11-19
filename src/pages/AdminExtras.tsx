import { useEffect, useState } from 'react';
import type { AdminRepo, Feedback, Outlet, PartnerEnquiry } from '../types';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const LIMIT = 200; // repos return the latest 200

/** Delete with a second tap to confirm. Used to honour a guest's request to erase their details (NFR-09). */
function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'busy'>('idle');
  return (
    <button
      className="link danger small"
      disabled={state === 'busy'}
      onClick={async () => {
        if (state === 'idle') return setState('confirm');
        setState('busy');
        try {
          await onDelete();
        } catch {
          setState('idle');
        }
      }}
    >
      {state === 'confirm' ? 'Tap again to delete' : 'Delete'}
    </button>
  );
}

function useInbox<T extends { id: string }>(load: () => Promise<T[]>, remove: (id: string) => Promise<void>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    load().then(setRows).catch((e) => setErr(e instanceof Error ? e.message : 'Could not load'));
  }, [load]);
  const del = async (id: string) => {
    try {
      await remove(id);
      setRows((r) => r?.filter((x) => x.id !== id) ?? r);
    } catch (e) {
      setErr('Not deleted: ' + (e instanceof Error ? e.message : 'error'));
      throw e;
    }
  };
  return { rows, err, del };
}

const countLabel = (n: number, one: string, many: string) => (n >= LIMIT ? `Latest ${LIMIT} ${many}` : `${n} ${n === 1 ? one : many}`);

export function FeedbackInbox({ repo }: { repo: AdminRepo }) {
  const { rows, err, del } = useInbox<Feedback>(repo.listFeedback, repo.deleteFeedback);
  if (!rows) return err ? <p className="error">{err}</p> : <p className="muted">Loading…</p>;
  if (!rows.length) return <p className="muted">No feedback yet.</p>;
  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  return (
    <>
      {err && <p className="error">{err}</p>}
      <p className="muted">{countLabel(rows.length, 'response', 'responses')} · average {avg.toFixed(1)} ★</p>
      <ul className="inbox">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="inbox-top">
              <span className="stars-static" aria-label={`${r.rating} of 5 stars`}>{'★'.repeat(r.rating)}<span className="dim">{'★'.repeat(5 - r.rating)}</span></span>
              <span className="muted small">{when(r.createdAt)}{r.tableNo ? ` · Table ${r.tableNo}` : ''}</span>
            </div>
            {r.comment && <p>{r.comment}</p>}
            <div className="inbox-foot">
              <span className="muted small">{[r.name, r.phone].filter(Boolean).join(' · ')}</span>
              <DeleteButton onDelete={() => del(r.id)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PartnerInbox({ repo }: { repo: AdminRepo }) {
  const { rows, err, del } = useInbox<PartnerEnquiry>(repo.listPartners, repo.deletePartner);
  if (!rows) return err ? <p className="error">{err}</p> : <p className="muted">Loading…</p>;
  if (!rows.length) return <p className="muted">No partner enquiries yet.</p>;
  return (
    <>
      {err && <p className="error">{err}</p>}
      <p className="muted">{countLabel(rows.length, 'enquiry', 'enquiries')}</p>
      <ul className="inbox">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="inbox-top">
              <strong>{r.name}</strong>
              <span className="muted small">{when(r.createdAt)}</span>
            </div>
            <p><a href={`tel:+91${r.phone}`}>{r.phone}</a>{r.city ? ` · ${r.city}` : ''}</p>
            {r.message && <p className="muted">{r.message}</p>}
            <div className="inbox-foot"><span /><DeleteButton onDelete={() => del(r.id)} /></div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function OutletSettings({ outlet, onSave }: { outlet: Outlet; onSave: (o: Outlet) => Promise<boolean> }) {
  const [d, setD] = useState<Outlet>(outlet);
  const [err, setErr] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const set = (k: keyof Outlet) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setState('idle');
    setD((p) => ({ ...p, [k]: e.target.value }));
  };
  const save = async () => {
    setErr('');
    if (!d.name.trim()) return setErr('Café name is required.');
    if (d.websiteUrl.trim() && !/^https:\/\/[^\s]+\.[^\s]+$/.test(d.websiteUrl.trim())) return setErr('Website must start with https://');
    setState('saving');
    const ok = await onSave(d);
    setState(ok ? 'saved' : 'idle');
    if (!ok) setErr('Not saved. Check your connection and try again; your changes are still here.');
  };
  return (
    <div className="editor settings">
      <label>Café name<input value={d.name} onChange={set('name')} maxLength={80} /></label>
      <label>Tagline<input value={d.tagline} onChange={set('tagline')} maxLength={80} /></label>
      <label>Splash announcement (leave empty to turn the splash off)
        <textarea rows={2} value={d.announcement} onChange={set('announcement')} maxLength={160} />
      </label>
      <label>About text<textarea rows={3} value={d.about} onChange={set('about')} maxLength={600} /></label>
      <label>Address<input value={d.address} onChange={set('address')} maxLength={160} /></label>
      <div className="row2">
        <label>Phone<input value={d.phone} onChange={set('phone')} maxLength={20} /></label>
        <label>Email<input type="email" value={d.email} onChange={set('email')} maxLength={80} /></label>
      </div>
      <div className="row2">
        <label>Website label<input value={d.websiteLabel} onChange={set('websiteLabel')} maxLength={40} placeholder="Chai City" /></label>
        <label>Website URL (empty hides the link)<input value={d.websiteUrl} onChange={set('websiteUrl')} placeholder="https://…" /></label>
      </div>
      <label>Partner with us text<textarea rows={2} value={d.partnerText} onChange={set('partnerText')} maxLength={400} /></label>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="sheet-actions">
        <button className="primary" disabled={state === 'saving'} onClick={save}>{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save settings'}</button>
      </div>
    </div>
  );
}
