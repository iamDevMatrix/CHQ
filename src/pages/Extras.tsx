import { useEffect, useState } from 'react';
import { getGuestRepo } from '../repo';
import { storage } from '../storage';
import type { Outlet } from '../types';

/* ---------- Splash ---------- */

const SPLASH_KEY = 'chq-splash-seen';

function splashSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SPLASH_KEY) === '1';
  } catch {
    return false;
  }
}

/** Shown once per browser session, auto-dismisses. Text comes from outlet.announcement so admin can change or clear it. */
export function Splash({ outlet }: { outlet: Outlet }) {
  const [state, setState] = useState<'show' | 'leaving' | 'gone'>(() => (splashSeen() || !outlet.announcement ? 'gone' : 'show'));

  const close = () => {
    try {
      window.sessionStorage.setItem(SPLASH_KEY, '1');
    } catch {
      /* ignore */
    }
    setState('leaving');
    setTimeout(() => setState('gone'), 350);
  };

  useEffect(() => {
    if (state !== 'show') return;
    const t = setTimeout(close, 3500);
    return () => clearTimeout(t);
  }, [state]);

  if (state === 'gone') return null;
  return (
    <div className={`splash ${state === 'leaving' ? 'leaving' : ''}`} onClick={close} role="dialog" aria-label="Welcome">
      <div className="splash-inner">
        <p className="splash-kicker">Now open</p>
        <h1 className="splash-title">{outlet.name}</h1>
        <p className="splash-text">{outlet.announcement}</p>
        <p className="splash-tag">{outlet.tagline}</p>
        <button className="primary splash-btn" onClick={close}>View menu</button>
      </div>
    </div>
  );
}

/* ---------- Shared form helpers ---------- */

const THROTTLE_MS = 60_000;
const throttled = (key: string) => {
  const last = storage.get<number>(key);
  return last !== null && Date.now() - last < THROTTLE_MS;
};
const normalisePhone = (s: string) => s.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
const validPhone = (s: string) => /^[6-9]\d{9}$/.test(normalisePhone(s));

/** FR-31 / NFR-09: say what is collected, why, and how to have it deleted, next to the submit button. */
function Consent({ purpose, email }: { purpose: string; email: string }) {
  return (
    <p className="consent">
      {purpose} We do not share them or use them for marketing.
      {email ? <> To have them deleted, email <a href={`mailto:${email}`}>{email}</a>.</> : ' To have them deleted, ask our staff.'}
    </p>
  );
}

/* ---------- Feedback ---------- */

export function FeedbackForm({ tableNo, email, onDone }: { tableNo: string; email: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (rating < 1) return setErr('Please pick a rating.');
    if (phone && !validPhone(phone)) return setErr('Please enter a valid 10-digit mobile number, or leave it blank.');
    if (throttled('chq-fb-last')) return setErr('Thanks, we already have your feedback. Please try again in a minute.');
    setStatus('sending');
    try {
      const repo = await getGuestRepo();
      await repo.submitFeedback({ rating, comment: comment.slice(0, 1000), name: name.slice(0, 60), phone: phone ? normalisePhone(phone) : '', tableNo });
      storage.set('chq-fb-last', Date.now());
      setStatus('sent');
    } catch {
      setStatus('idle');
      setErr('Could not send. Please check your connection and try again.');
    }
  };

  if (status === 'sent')
    return (
      <div className="thanks">
        <p className="thanks-big">Thank you!</p>
        <p>Your feedback goes straight to the CHQ Capital team.</p>
        <button className="primary" onClick={onDone}>Back to menu</button>
      </div>
    );

  return (
    <form className="form" onSubmit={submit}>
      <p className="form-label">How was your visit?</p>
      <div className="stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={n <= rating ? 'on' : ''} onClick={() => { setRating(n); setErr(''); }}>★</button>
        ))}
      </div>
      <label>Tell us more (optional)
        <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you love? What can we do better?" />
      </label>
      <div className="row2">
        <label>Name (optional)<input maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
        <label>Mobile (optional)<input type="tel" inputMode="tel" maxLength={16} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
      </div>
      {(name || phone) && <Consent purpose="We keep your name and mobile with this feedback so the café team can reply to you." email={email} />}
      {err && <p className="error" role="alert">{err}</p>}
      <button className="primary wide" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send feedback'}</button>
    </form>
  );
}

/* ---------- Partner with us ---------- */

function PartnerForm({ email }: { email: string }) {
  const [f, setF] = useState({ name: '', phone: '', city: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!f.name.trim()) return setErr('Please enter your name.');
    if (!validPhone(f.phone)) return setErr('Please enter a valid 10-digit mobile number.');
    if (throttled('chq-partner-last')) return setErr('We already have your details. Please try again in a minute.');
    setStatus('sending');
    try {
      const repo = await getGuestRepo();
      await repo.submitPartner({ name: f.name.slice(0, 60), phone: normalisePhone(f.phone), city: f.city.slice(0, 60), message: f.message.slice(0, 1000) });
      storage.set('chq-partner-last', Date.now());
      setStatus('sent');
    } catch {
      setStatus('idle');
      setErr('Could not send. Please check your connection and try again.');
    }
  };

  if (status === 'sent') return <p className="note">Thanks, {f.name.split(' ')[0]}. Our team will call you soon.</p>;

  return (
    <form className="form" onSubmit={submit}>
      <div className="row2">
        <label>Name<input maxLength={60} value={f.name} onChange={set('name')} autoComplete="name" /></label>
        <label>Mobile<input type="tel" inputMode="tel" maxLength={16} value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
      </div>
      <label>City<input maxLength={60} value={f.city} onChange={set('city')} autoComplete="address-level2" /></label>
      <label>Message (optional)<textarea rows={2} maxLength={1000} value={f.message} onChange={set('message')} placeholder="Franchise, corporate tie-up, events…" /></label>
      <Consent purpose="We keep your name, mobile, city and message only to contact you about this enquiry." email={email} />
      {err && <p className="error" role="alert">{err}</p>}
      <button className="primary wide" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send enquiry'}</button>
    </form>
  );
}

/* ---------- About ---------- */

export function AboutPanel({ outlet, onFeedback }: { outlet: Outlet; onFeedback: () => void }) {
  return (
    <div className="about">
      <section>
        <h3>About {outlet.name}</h3>
        {outlet.about && <p>{outlet.about}</p>}
        {outlet.address && <p className="muted">{outlet.address}</p>}
      </section>

      <section className="link-list">
        <button className="link-row" onClick={onFeedback}><span>Share feedback</span><span>›</span></button>
        {outlet.websiteUrl && (
          <a className="link-row" href={outlet.websiteUrl} target="_blank" rel="noopener noreferrer">
            <span>Visit {outlet.websiteLabel || 'our website'}</span><span>↗</span>
          </a>
        )}
        {outlet.phone && (
          <a className="link-row" href={`tel:${outlet.phone}`}><span>Call us</span><span className="muted">{outlet.phone}</span></a>
        )}
        {outlet.email && (
          <a className="link-row" href={`mailto:${outlet.email}`}><span>Email</span><span className="muted">{outlet.email}</span></a>
        )}
      </section>

      <section id="partner">
        <h3>Partner with us</h3>
        {outlet.partnerText && <p>{outlet.partnerText}</p>}
        <PartnerForm email={outlet.email} />
      </section>
    </div>
  );
}
