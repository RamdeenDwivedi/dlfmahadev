'use strict';

/* =========================================================================
   Temple Fund Drive — single-page app (no build, no server required)
   Data: localStorage (records) + IndexedDB (receipt images, photos, video)
   ========================================================================= */

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = a => a.reduce((s, x) => s + (+x || 0), 0);
const inr = n => '₹' + Math.round(+n || 0).toLocaleString('en-IN');
const lakh = n => '₹' + ((+n || 0) / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
const short = v => v >= 1e5 ? (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(Math.round(v));
const pctOf = (a, b) => b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0;
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const fmtD = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const fmtLong = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtWD = s => s ? parseD(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const mondayOf = s => { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MODES = ['UPI', 'Cash', 'Cheque', 'Bank Transfer'];
const ROLES = ['Coordinator', 'Team Lead', 'Volunteer', 'Accounts / Receipts', 'Presenter'];
const normPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '0') d = d.slice(1); if (d.length === 10) d = '91' + d; return d; };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function openWA(phone, msg) {
  const p = normPhone(phone);
  // api.whatsapp.com keeps emoji intact; the wa.me redirect can turn them into "�" on WhatsApp Desktop / some phones
  const url = 'https://api.whatsapp.com/send?' + (p ? `phone=${p}&` : '') + 'text=' + encodeURIComponent(msg);
  window.open(url, '_blank', 'noopener');
}
function siteLink() {
  return /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? location.origin + location.pathname : '';
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied to clipboard'); }
  catch { window.prompt('Copy this text:', t); }
}
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- default content ---------- */
const DEFAULT_SCRIPT_EN = `Om Namah Shivaya / Har Har Mahadev 🙏
We are from the {temple} seva team of {society} — your neighbours here in the society.

Why we are here: {temple} is coming up inside our own society, beside Towers L–T. The sacred Narmadeshwar Shivling has already arrived on site, the foundation is 100% complete, and the hand-carved pink sandstone pillars and Shikhara are ready in Rajasthan. Prana Pratishtha is planned for {deadline}. We are meeting Hindu families of our society who wish to be part of this seva.

Progress so far: {achieved} of our {target} goal has been received ({pct}%). We need {remaining} more through this door-to-door seva drive — {daysLeft} days to go.

Our request: family seva starts from {min} (₹5,101 • ₹11,001 • ₹21,001 • ₹51,001 • ₹1,00,001+), and families can also sponsor a part of the temple, such as a stone pillar or the main temple door. It is completely voluntary — there is no pressure at all. Tan, Man or Dhan: every offering given with devotion is welcome. You may also pledge now and pay by 30 Nov / salary day.

Payment: HDFC UPI {upi} (GPay, PhonePe, Paytm, cards or netbanking) or cash. Every rupee is receipted and shared on a weekly ledger, and contributors are honoured on the black-stone donor plaque.

If you can spare 10 minutes, we would love to show you photos of the site, the seva options and a video of the temple.

Thank you for your time. Har Har Mahadev 🙏`;

const DEFAULT_SCRIPT_HI = `ॐ नमः शिवाय / हर हर महादेव 🙏
हम {society} की {temple} सेवा टीम से हैं — आपके ही पड़ोसी।

हमारे आने का उद्देश्य: हमारी अपनी सोसाइटी में, टावर L–T के पास, {temple} बन रहा है। पवित्र नर्मदेश्वर शिवलिंग स्थल पर आ चुका है, नींव 100% पूरी हो चुकी है, और राजस्थान में गुलाबी बलुआ पत्थर के नक्काशीदार स्तंभ व शिखर तैयार हैं। प्राण प्रतिष्ठा {deadline} को प्रस्तावित है। हम उन हिन्दू परिवारों से मिल रहे हैं जो इस सेवा में योगदान देना चाहते हैं।

अब तक की प्रगति: कुल लक्ष्य {target} में से {achieved} ({pct}%) प्राप्त हो चुके हैं। इस घर-घर सेवा अभियान से हमें {remaining} और चाहिए — {daysLeft} दिन शेष।

हमारा निवेदन: पारिवारिक सेवा {min} से आरम्भ (₹5,101 • ₹11,001 • ₹21,001 • ₹51,001 • ₹1,00,001+); आप मंदिर का कोई भाग, जैसे पत्थर का स्तंभ या मुख्य द्वार, भी समर्पित कर सकते हैं। यह पूरी तरह स्वैच्छिक है — किसी भी प्रकार का दबाव नहीं। तन, मन या धन — श्रद्धा से दी गई हर सेवा का स्वागत है। आप अभी संकल्प करके 30 नवंबर / वेतन दिवस तक भी दे सकते हैं।

भुगतान: HDFC UPI {upi} (GPay, PhonePe, Paytm, कार्ड, नेटबैंकिंग) या नकद। हर रुपये की रसीद दी जाती है और साप्ताहिक हिसाब साझा किया जाता है; योगदानकर्ताओं के नाम काले पत्थर की दानदाता पट्टिका पर अंकित होंगे।

यदि आपके पास 10 मिनट हों, तो हम आपको स्थल की तस्वीरें, सेवा विकल्प और मंदिर का वीडियो दिखाना चाहेंगे।

आपके समय के लिए धन्यवाद। हर हर महादेव 🙏`;

const DEFAULT_REMINDER = `Har Har Mahadev 🙏 {name} ji,
A gentle reminder about your seva pledge of {amount} for the {temple}.
Progress so far: {achieved} of {target} ({pct}%). Prana Pratishtha: {deadline}.
You can pay by HDFC UPI {upi} (GPay / PhonePe / Paytm) or cash to your tower volunteer — a receipt will be shared.
Thank you for your support! — {coord}`;

const DEFAULT_THANKS = `Har Har Mahadev 🙏 {name} ji, thank you for your seva of {amount} towards the {temple}. Together we have now reached {achieved} ({pct}%) of our {target} goal. Your name will be honoured on the donor plaque. 🔱 — {coord}`;

const AGENDA = [
  { s: 0, e: 120, t: '0:00 – 2:00', label: 'Introduction & purpose of the visit (2-min script)' },
  { s: 120, e: 240, t: '2:00 – 4:00', label: 'Site progress: Shivling arrived, foundation 100%, bhoomi pujan photos' },
  { s: 240, e: 360, t: '4:00 – 6:00', label: 'Seva options: family tiers, temple-part sponsorship, idols, donor plaque & Yajman' },
  { s: 360, e: 420, t: '6:00 – 7:00', label: 'Temple location beside Towers L–T, road to 15 December' },
  { s: 420, e: 570, t: '7:00 – 9:30', label: 'Video of the expected temple' },
  { s: 570, e: 600, t: '9:30 – 10:00', label: 'Questions → contribute or pledge → give receipt' },
];
const TIERS = [5101, 11001, 15001, 21001, 51001, 100001, 110001, 121001, 131001, 141001, 151001, 200001];
const ROADMAP = [
  ['Release advances', 'Lock Rajasthan stone dispatch'], ['Site readiness', 'Book crane for the Shilpi team'],
  ['Stone erection', 'Sanctum & Shikhara assembly'], ['Prana Pratishtha', 'Consecration on 15 December 2026'],
];
const EV = 'assets/evidence/';
const EVIDENCE = [
  ['Site progress', [['site-foundation-front.jpg', 'Foundation 100% complete — temple site beside Towers L–T'], ['site-foundation-side.jpg', 'Central temple site, ready for stone erection']]],
  ['Bhoomi Pujan · 3 July 2026', [['bhoomi-pujan-1.jpg', 'Bhoomi pujan on the temple site'], ['bhoomi-pujan-3.jpg', 'Foundation offerings — 3 Jul 2026'], ['bhoomi-pujan-4.jpg', 'Residents offering at the foundation pit'], ['bhoomi-pujan-2.jpg', 'Vedic rituals for the temple foundation'], ['bhoomi-pujan-6.jpg', 'Marking the sanctum'], ['bhoomi-pujan-5.jpg', 'Elders join the sankalp']]],
  ['Door-to-door seva drive', [['drive-visit-1.jpg', 'Seva team on a family visit'], ['drive-visit-3.jpg', 'First contributions received'], ['drive-visit-2.jpg', 'Every visit counts']]],
  ['Our community, every festival', [['fest-ratha-yatra.jpg', 'Ratha Yatra 2026'], ['fest-bhajan.jpg', 'Bhajan sandhya'], ['fest-ganesh-2.jpg', 'Ganesh Chaturthi'], ['fest-ganesh-1.jpg', 'Ganesh puja'], ['fest-onam-1.jpg', 'Onam celebrations'], ['fest-onam-2.jpg', 'Onam'], ['fest-chhath.jpg', 'Chhath Puja'], ['fest-rajyotsava.jpg', 'Kannada Rajyotsava']]],
  ['Drive updates & recognition', [['brief-all-in-one.png', 'All-in-one seva & progress brief'], ['drive-poster.jpg', 'Day 1–3 drive update poster'], ['donor-plaque-reference.jpg', 'Reference: black-stone donor plaque']]],
];
const DEFAULT_SEVAS = [
  ['seva0', 'Garbhagriha (sanctum)', 500000, 1], ['seva1', 'Electricity, water & ground works', 500000, 1], ['seva2', 'Shikhara & Kalash', 250000, 1],
  ['seva3', 'Stone pillar', 125000, 4], ['seva5', 'Mandap floor & Pradakshina', 100000, 1], ['seva7', 'Main temple door', 100000, 1],
  ['seva6', 'Dwarapalaka (door guardians)', 50000, 1], ['seva8', 'Temple bells (Ghanta)', 51000, 1], ['seva9', 'Dhwaja & Trishul', 51000, 1],
].map(([id, name, amount, slots]) => ({ id, name, amount, slots, bookings: [] }));
const DEFAULT_IDOLS = [
  ['Narmadeshwar Shivling', 'Shri Murali ji', 0, ''], ['Ganesh Ji', 'Shri Deepak ji', 0, ''], ['Hanuman Ji', 'Gupt Daan 🙏', 0, 'Red stone murti'],
  ['Nandi Ji', 'Gupt Daan 🙏', 100000, 'Black stone murti & Pratishtha'], ['Kartik Ji', '', 100000, 'Marble murti'], ['Mata Parvati', '', 100000, 'Marble murti'],
].map(([name, sponsor, amount, note], i) => ({ id: 'idol' + i, name, sponsor, amount, note }));
const FILMS = {
  short: { label: '1-minute film', en: 'film-1min-en.mp4', hi: 'film-1min-hi.mp4', poster: 'poster-1min.jpg',
    chapters: [[0, 'Om Namah Shivaya'], [5, 'DLF Woodland Heights'], [10, 'Our festivals'], [15, 'Bhoomi pujan'], [20, 'Foundation 100% complete'], [25, 'Rajasthan pink sandstone'], [30, 'Prana Pratishtha · 15 Dec'], [35, 'Where we stand'], [40, 'Families coming forward'], [45, 'Choose your offering'], [50, 'Sponsor a seva'], [55, 'Scan & give']] },
  full: { label: 'Full film (~7 min)', en: 'film-full-en.mp4', hi: 'film-full-hi.mp4', poster: 'poster-full.jpg', hiScale: 443.2 / 433.5,
    chapters: [[0, '3,000+ residents. One heart.'], [30, 'Where there is no temple, there is no dharma'], [60, 'The divine vision'], [90, 'Every festival, one family'], [150, 'Standing proud, together'], [180, 'Cultural nights'], [210, 'Our vision'], [240, 'What we are building'], [270, 'Road to 15 December'], [300, 'Every contribution is a seva'], [330, 'Our volunteers'], [360, 'How we honour donors'], [390, 'Tan · Man · Dhan — join the Temple Committee']] },
};
const VID = 'assets/video/';
// First 3 days of the door-to-door drive (from the drive update). Dates assumed; replace with per-flat entries when available.
const SEED_DONATIONS = [
  ['seed-d1', '2026-11-22', 'Day 1 drive — consolidated', 10000, ''], ['seed-d2', '2026-11-23', 'Day 2 drive — consolidated', 8100, ''],
  ['seed-d3', '2026-11-24', 'Day 3 drive — consolidated', 24206, '9 flats'],
  ['seed-d5', '2026-11-25', 'Cash collected 21–25 Nov — consolidated', 10100, '', 'Various towers', 'Cash', 'Mr. Ram', '2026-11-21'],
].map(([id, date, donor, amount, n, tower = 'Tower A & B', mode = 'UPI', cashWith = '', dateFrom = '']) => ({ id, created: 1, ...(dateFrom ? { dateFrom } : {}), households: parseInt(n) || 0, date, donor, phone: '', tower, cashWith, flat: n || '—', amount, status: 'Full', mode, ref: '', collectedBy: 'Seva team', notes: 'Consolidated day total from the drive update — replace with per-flat entries', receiptIds: [], consolidated: true }));
const SEED_PLEDGES = [{ id: 'seed-p1', created: 1, donor: 'Drive pledges — consolidated', phone: '', tower: 'Tower A & B', flat: '—', amount: 115001, paid: 0, mode: 'UPI', dueDate: '2026-11-30', reminderDate: '2026-11-29', status: 'Pending', notes: '≈ ₹1,15,001 committed in Day 1–3 to pay by 30 Nov / salary day — split into individual pledges', consolidated: true }];
const LETTER_TOWERS = [...'ABCDEFGHJKLMNOPQRSTUV'].map(c => `Tower ${c}`); // 21 towers, there is no Tower I

function defaultPolls() {
  const mk = (question, audience, opts, reminderTpl) => ({
    id: uid(), question, audience, created: Date.now(), closed: false, reminderTpl,
    options: opts.map(text => ({ id: uid(), text })), votes: [],
  });
  return [
    mk('When is the best time for our team to visit you?', 'Residents',
      ['Saturday morning', 'Saturday evening', 'Sunday morning', 'Sunday evening', 'Weekday evening (7–9 PM)'],
      'Jai Shri Ram 🙏 {name} ji, thank you for choosing "{option}". Our temple seva team will visit you then to share the progress of the {temple}. 🛕'),
    mk('Would you like to contribute to the temple fund?', 'Residents',
      ['Yes – will pay now', 'Yes – pledge for later', 'Need more information', 'Not now'],
      'Jai Shri Ram 🙏 {name} ji, following up on your response "{option}" for the {temple}. Progress so far: {achieved} of {target} ({pct}%). Deadline: {deadline}. UPI: {upi}. Thank you!'),
    mk('Which drive slot can you join this week?', 'Volunteers',
      ['Weekday evening', 'Saturday', 'Sunday', 'All of these'],
      '🙏 {name} ji, reminder: you chose "{option}" to join the temple collection drive. Please check today\'s drive plan in the group. Thank you for your seva!'),
  ];
}

function defaults() {
  return {
    settings: { ...REAL_SETTINGS, minVols: 3, coordName: '', coordPhone: '', videoUrl: '', scriptEn: '', scriptHi: '' },
    donations: SEED_DONATIONS.map(d => ({ ...d })), pledges: SEED_PLEDGES.map(p => ({ ...p })), volunteers: [], drives: [], polls: defaultPolls(),
    weekPlans: {}, dayProofs: [], presentation: { photos: [], videoFileId: null },
    sevas: DEFAULT_SEVAS.map(s => ({ ...s, bookings: [] })), idols: DEFAULT_IDOLS.map(x => ({ ...x })),
    coverage: { 'Tower A': 50, 'Tower B': 90 }, meta: { version: 10 },
  };
}
// Real figures from the fundraising deck / all-in-one brief: ₹10.50 L achieved incl. the first 3 days (₹42,306).
const REAL_SETTINGS = {
  society: 'DLF Woodland Heights', temple: 'Narmadeshwar Mahadev Temple', target: 3000000, opening: 1050000 - 42306,
  deadline: '2026-12-15', minDonation: 5101, homes: 984, foundationPct: 100, builtPct: 28, towers: LETTER_TOWERS,
  upi: 'Vyapar.169022715523@hdfcbank', upiQr: 'upi://pay?pa=Vyapar.169022715523@hdfcbank&pn=Default&mc=8999&tr=STQU169022715523&cu=INR',
  auditName: 'Mr. Ram', auditPhone: '9008225906', address: 'Temple site beside Towers L–T, DLF Woodland Heights, Bommasandra–Jigani Link Rd, Bengaluru',
  mapQuery: 'DLF Woodland Heights, Jigani, Bengaluru', reminderTpl: DEFAULT_REMINDER, thanksTpl: DEFAULT_THANKS,
};
/* One-time upgrade of data saved by the first version of the app. */
function migrate(s) {
  if ((s.meta?.version || 1) >= 2) return s;
  const oldTowers = Array.from({ length: 19 }, (_, i) => `Tower ${i + 1}`);
  const usedOld = (s.settings.towers || oldTowers).join() === oldTowers.join();
  const keep = { minVols: s.settings.minVols, coordName: s.settings.coordName, coordPhone: s.settings.coordPhone, videoUrl: s.settings.videoUrl };
  s.settings = { ...s.settings, ...REAL_SETTINGS, ...keep, scriptEn: '', scriptHi: '' };
  if (usedOld) {
    const map = t => { const i = oldTowers.indexOf(t); return i >= 0 ? LETTER_TOWERS[i] : t; };
    [...s.donations, ...s.pledges, ...s.volunteers].forEach(r => { if (r.tower) r.tower = map(r.tower); if (r.towers) r.towers = r.towers.map(map); });
    s.drives.forEach(d => d.towers = (d.towers || []).map(map));
    Object.values(s.weekPlans || {}).forEach(w => { if (w.towers) w.towers = w.towers.map(map); });
  }
  SEED_DONATIONS.forEach(d => { if (!s.donations.some(x => x.id === d.id)) s.donations.push({ ...d }); });
  SEED_PLEDGES.forEach(p => { if (!s.pledges.some(x => x.id === p.id)) s.pledges.push({ ...p }); });
  s.sevas ||= DEFAULT_SEVAS.map(x => ({ ...x, bookings: [] }));
  s.idols ||= DEFAULT_IDOLS.map(x => ({ ...x }));
  s.coverage ||= { 'Tower A': 50, 'Tower B': 90 };
  s.meta = { version: 2 };
  return s;
}
/* v3: seva list, tiers and deity sevas as shown in the 22 Nov film. Keeps any bookings already made. */
function migrate3(s) {
  if ((s.meta?.version || 1) >= 3) return s;
  const old = s.sevas || [];
  const nandiOld = old.find(x => x.id === 'seva4');
  s.sevas = DEFAULT_SEVAS.map(d => { const o = old.find(x => x.id === d.id); return o ? { ...d, bookings: o.bookings || [], slots: Math.max(d.slots, (o.bookings || []).length) } : { ...d, bookings: [] }; });
  old.filter(o => !DEFAULT_SEVAS.some(d => d.id === o.id) && o.id !== 'seva4').forEach(o => s.sevas.push(o));
  if (nandiOld?.bookings?.length) s.sevas.push(nandiOld);
  const oi = s.idols || [];
  s.idols = DEFAULT_IDOLS.map(d => { const o = oi.find(x => x.name === d.name || (d.name === 'Kartik Ji' && x.name === 'Kartikeya Ji')); return { ...d, sponsor: o?.sponsor || d.sponsor }; });
  s.meta = { version: 3 };
  return s;
}
function migrate4(s) {
  if ((s.meta?.version || 1) >= 4) return s;
  const h = (s.idols || []).find(x => x.name === 'Hanuman Ji');
  if (h && h.sponsor) h.sponsor = 'Gupt Daan 🙏';
  s.meta = { version: 4 };
  return s;
}
function migrate5(s) {
  if ((s.meta?.version || 1) >= 5) return s;
  const n = (s.idols || []).find(x => x.name === 'Nandi Ji');
  if (n && !n.sponsor) n.sponsor = 'Gupt Daan 🙏';
  s.meta = { version: 5 };
  return s;
}
/* v6: real tower list A–V without I (was A–S). Keeps custom towers and any tower already used in records. */
function migrate6(s) {
  if ((s.meta?.version || 1) >= 6) return s;
  const st = s.settings ||= {}, old = st.towers || [];
  const used = new Set([...(s.donations || []), ...(s.pledges || []), ...(s.volunteers || [])].map(x => x.tower));
  const extra = old.filter(t => !LETTER_TOWERS.includes(t) && (t !== 'Tower I' || used.has(t)));
  if (old.length) st.towers = [...LETTER_TOWERS, ...extra];
  s.meta = { version: 6 };
  return s;
}
/* v7: temple UPI moved to the HDFC SmartHub QR account. */
function migrate7(s) {
  if ((s.meta?.version || 1) >= 7) return s;
  const st = s.settings ||= {};
  if (!st.upi || st.upi === 'Vyapar.168003185609@hdfcbank') { st.upi = REAL_SETTINGS.upi; st.upiQr = REAL_SETTINGS.upiQr; }
  s.meta = { version: 7 };
  return s;
}
/* v8+: add any new published day totals (seed-d*) that this phone doesn't have yet. */
const SEED_VERSION = 10;
function migrateSeeds(s) {
  if ((s.meta?.version || 1) >= SEED_VERSION) return s;
  // v9: drive Day 1–3 were 22–24 Nov; the separate 24 Nov ₹1,100 is already inside Day 3.
  s.donations = (s.donations || []).filter(d => d.id !== 'seed-d4');
  s.donations.forEach(d => { const sd = SEED_DONATIONS.find(x => x.id === d.id && /^seed-d[123]$/.test(x.id)); if (sd) d.date = sd.date; });
  const c5 = s.donations.find(d => d.id === 'seed-d5'); if (c5) c5.dateFrom = '2026-11-21';
  const have = new Set((s.donations || []).map(d => d.id));
  SEED_DONATIONS.filter(d => !have.has(d.id)).forEach(d => (s.donations ||= []).push({ ...d }));
  s.meta = { version: SEED_VERSION };
  return s;
}

/* ---------- persistence ---------- */
const KEY = 'templeFundDrive.v1';
function merge(o) {
  const d = defaults();
  const o2 = migrateSeeds(migrate7(migrate6(migrate5(migrate4(migrate3(migrate({ ...o, settings: { ...(o.settings || {}) }, donations: o.donations || [], pledges: o.pledges || [], volunteers: o.volunteers || [], drives: o.drives || [] })))))));
  return { ...d, ...o2, settings: { ...d.settings, ...o2.settings }, presentation: { ...d.presentation, ...(o2.presentation || {}) } };
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = merge(JSON.parse(raw)); localStorage.setItem(KEY, JSON.stringify(s)); return s; } } catch (e) { console.warn(e); }
  return defaults();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('⚠ Could not save — browser storage is full or blocked.'); }
}
let S = load();

/* IndexedDB for files (receipts, photos, video) */
const FileDB = (() => {
  let dbp;
  const db = () => dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('templeFundDriveFiles', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('files', mode); const req = fn(t.objectStore('files'));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error);
    });
  };
  return {
    put: rec => tx('readwrite', s => s.put(rec)),
    get: id => tx('readonly', s => s.get(id)),
    del: id => tx('readwrite', s => s.delete(id)),
    all: () => tx('readonly', s => s.getAll()),
    clear: () => tx('readwrite', s => s.clear()),
  };
})();
const fileCache = new Map();
async function getFile(id) {
  if (fileCache.has(id)) return fileCache.get(id);
  let rec = null;
  try { rec = await FileDB.get(id); } catch (e) { console.warn(e); }
  const out = rec ? { id, name: rec.name, type: rec.type || '', url: URL.createObjectURL(rec.blob) } : null;
  fileCache.set(id, out); return out;
}
function delFiles(ids) { (ids || []).forEach(id => { FileDB.del(id).catch(() => {}); const c = fileCache.get(id); if (c) URL.revokeObjectURL(c.url); fileCache.delete(id); }); }

async function compressImage(file, max = 1600, q = 0.75) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    return blob && blob.size < file.size ? blob : file;
  } catch { return file; }
}
async function storeFiles(files) {
  const ids = [];
  for (const f of files) {
    const blob = await compressImage(f);
    const id = uid();
    await FileDB.put({ id, name: f.name || 'file', type: blob.type || f.type, blob, created: Date.now() });
    ids.push(id);
  }
  return ids;
}
async function hydrate(root = document) {
  for (const el of $$('[data-file]:not([data-loaded])', root)) {
    el.dataset.loaded = '1';
    const f = await getFile(el.dataset.file);
    if (!f) { el.textContent = 'missing'; continue; }
    if (el.tagName === 'VIDEO') { el.src = f.url; continue; }
    el.innerHTML = f.type.startsWith('image/') ? `<img src="${f.url}" alt="${esc(f.name)}">` : `<span class="filechip">📄 ${esc(f.name)}</span>`;
  }
}

/* ---------- computations ---------- */
function totals() {
  const st = S.settings, t = today();
  const collected = sum(S.donations.map(d => d.amount));
  const achieved = (+st.opening || 0) + collected;
  const remaining = Math.max(0, (+st.target || 0) - achieved);
  const daysLeft = Math.max(0, diffDays(t, st.deadline) + 1);
  const perDay = daysLeft ? remaining / daysLeft : remaining;
  const todays = dated().filter(d => d.date === t);
  const pend = S.pledges.filter(p => p.status === 'Pending');
  return {
    collected, achieved, remaining, daysLeft, perDay, pct: pctOf(achieved, st.target),
    todayAmt: sum(todays.map(d => d.amount)), todayCount: todays.length,
    pledgedPending: sum(pend.map(p => p.amount - (p.paid || 0))), pendingCount: pend.length,
  };
}
// Entries with dateFrom cover several days (e.g. cash 21–25 Nov) and are not shown as one day's collection.
const spanLabel = d => `${fmtD(d.dateFrom)} – ${fmtD(d.date)}`;
const dated = () => S.donations.filter(d => !d.dateFrom);
function dayTotals() { const m = {}; dated().forEach(d => { m[d.date] = (m[d.date] || 0) + (+d.amount || 0); }); return m; }
function sumRange(a, b) { return sum(S.donations.filter(d => (d.dateFrom || d.date) >= a && d.date <= b).map(d => d.amount)); }
function spanNote() {
  const sp = S.donations.filter(d => d.dateFrom);
  return sp.length ? `<p class="small muted" style="margin:8px 0 0">Not shown as bars: ${sp.map(d => `<b>${inr(d.amount)}</b> ${esc(d.mode.toLowerCase())} collected ${spanLabel(d)} (not split by day)`).join(' · ')}. It is included in the total.</p>` : '';
}
function towerStats() {
  const m = {}; S.settings.towers.forEach(t => m[t] = { amount: 0, count: 0 });
  S.donations.forEach(d => { (m[d.tower] ||= { amount: 0, count: 0 }); m[d.tower].amount += +d.amount || 0; m[d.tower].count++; });
  return m;
}
function duePledges() {
  const t = today();
  return S.pledges.filter(p => p.status === 'Pending' && p.reminderDate && p.reminderDate <= t)
    .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate));
}
function households() {
  const keys = new Set(S.donations.filter(d => !d.consolidated).map(d => `${d.tower}|${String(d.flat).trim().toLowerCase()}`));
  return keys.size + sum(S.donations.filter(d => d.consolidated).map(d => d.households || 0));
}
function topContributors(n = 5) {
  const m = {};
  const add = (r, amt, kind) => {
    if (r.consolidated) return;
    const k = `${r.donor.trim().toLowerCase()}|${r.tower}|${String(r.flat).trim().toLowerCase()}`;
    const e = m[k] ||= { donor: r.donor, tower: r.tower, flat: r.flat, paid: 0, pledged: 0 };
    e[kind] += amt;
  };
  S.donations.forEach(d => add(d, +d.amount || 0, 'paid'));
  S.pledges.filter(p => p.status === 'Pending').forEach(p => add(p, p.amount - (p.paid || 0), 'pledged'));
  return Object.values(m).sort((a, b) => (b.paid + b.pledged) - (a.paid + a.pledged)).slice(0, n);
}
function bookingPaid(b) { return b.paid || S.pledges.find(p => p.id === b.pledgeId)?.status === 'Fulfilled'; }
function evidenceItems() {
  return [...EVIDENCE.flatMap(([, list]) => list.map(([f, cap]) => ({ src: EV + f, cap }))), ...S.presentation.photos.map(p => ({ id: p.id, cap: p.caption || '' }))];
}
function sevaStats() {
  const sv = S.sevas || [];
  const slots = sum(sv.map(x => x.slots)), booked = sum(sv.map(x => x.bookings.length));
  const value = sum(sv.map(x => x.amount * x.slots)), bookedValue = sum(sv.map(x => x.amount * x.bookings.length));
  return { slots, booked, value, bookedValue };
}
function tplVars(extra = {}) {
  const T = totals(), st = S.settings;
  return {
    society: st.society, temple: st.temple, target: lakh(st.target), achieved: lakh(T.achieved), remaining: lakh(T.remaining),
    pct: T.pct.toFixed(1), deadline: fmtLong(st.deadline), daysLeft: T.daysLeft, min: inr(st.minDonation),
    upi: st.upi || 'society UPI', coord: st.coordName || 'Temple Seva Team', homes: st.homes || '', builtPct: st.builtPct ?? '', ...extra,
  };
}
const fillTpl = (tpl, extra) => { const v = tplVars(extra); return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m); };
const volName = id => S.volunteers.find(v => v.id === id)?.name || '';
function driveCollected(d) {
  return sum(S.donations.filter(x => x.date === d.date && (!d.towers?.length || d.towers.includes(x.tower))).map(x => x.amount));
}
function weeksData() {
  const st = S.settings, t = today(), planStart = mondayOf(t);
  if (st.deadline < planStart) return [];
  const before = sum(S.donations.filter(d => d.date < planStart).map(d => d.amount));
  const pool = Math.max(0, st.target - st.opening - before);
  const totalDays = diffDays(planStart, st.deadline) + 1;
  const res = [];
  for (let ws = planStart; ws <= st.deadline; ws = addDays(ws, 7)) {
    const we = addDays(ws, 6), end = we < st.deadline ? we : st.deadline;
    const days = diffDays(ws, end) + 1;
    const plan = S.weekPlans[ws] || {};
    const suggested = Math.round(pool * days / totalDays / 1000) * 1000;
    const target = plan.target != null && plan.target !== '' ? +plan.target : suggested;
    res.push({
      start: ws, end, days, suggested, target, custom: plan.target != null && plan.target !== '',
      towers: plan.towers || [], notes: plan.notes || '', achieved: sumRange(ws, end),
      drives: S.drives.filter(d => d.date >= ws && d.date <= end), current: t >= ws && t <= end,
    });
  }
  return res;
}

/* ---------- UI state ---------- */
const UI = {
  col: { q: '', date: '', tower: '', mode: '', status: '' },
  pledgeStatus: 'Pending', lang: 'en', lb: null, film: 'short', filmLang: 'en',
};
const pending = { files: [], keep: [], urls: [] };
function resetPending(keep = []) { pending.urls.forEach(u => URL.revokeObjectURL(u)); pending.files = []; pending.keep = [...keep]; pending.urls = []; }

/* ---------- shared fragments ---------- */
const towerOpts = (sel, placeholder = true) =>
  (placeholder ? '<option value="">Select tower…</option>' : '') +
  S.settings.towers.map(t => `<option ${t === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
const kpi = (label, val, sub = '', cls = '') => `<div class="kpi ${cls}"><div class="k-label">${label}</div><div class="k-val">${val}</div><div class="k-sub">${sub}</div></div>`;
const thumbs = (ids, cls = '') => ids?.length
  ? `<div class="thumbs">${ids.map((id, i) => `<button type="button" class="thumb ${cls}" data-act="viewFile" data-ids="${ids.join(',')}" data-i="${i}" title="View"><span data-file="${id}"></span></button>`).join('')}</div>`
  : '<span class="muted small">—</span>';
const dropzone = label => `<label class="dropzone" data-drop>
  📎 <strong>${label}</strong><br><span class="small">Tap to choose from gallery / camera · drag & drop · or paste (Ctrl/⌘+V) a WhatsApp screenshot</span>
  <input type="file" accept="image/*,application/pdf" multiple hidden data-pick>
</label><div class="thumbs" id="pending"></div>`;
const statusBadge = s => `<span class="badge ${s === 'Full' || s === 'Fulfilled' ? 'good' : s === 'Part' || s === 'Pending' ? 'warn' : ''}">${esc(s)}</span>`;
const modeBadge = m => `<span class="badge ${m === 'UPI' ? 'upi' : m === 'Cash' ? 'good' : ''}">${esc(m)}</span>`;
const empty = msg => `<div class="empty">${msg}</div>`;

/* =========================================================================
   RENDERERS
   ========================================================================= */
const TABS = [
  ['dashboard', '📊 Dashboard'], ['film', '🎬 Temple Film'], ['collections', '🧾 Collections'], ['ledger', '📒 Ledger'], ['pledges', '🔔 Pledges & Reminders'],
  ['seva', '🪔 Seva & Sponsors'], ['volunteers', '🙋 Volunteers & Drives'], ['polls', '🗳️ Polls'], ['plan', '🗓️ Weekly Plan'],
  ['script', '🛕 Visit Script & Presentation'], ['settings', '⚙️ Settings'],
];
const RENDER = {};

/* ---------- Two views: Public (residents) and Admin (temple committee) ----------
   Public is the default. Admin unlocks with the committee PIN and is remembered on that phone.
   Static site: this hides admin screens, it is not a vault — never put phones or private notes in public files. */
const ADMIN_KEY = 'templeFundDrive.admin';
const ADMIN_HASH = 'e712ac105137800ee3a4fed3d1aa3b6a231fe11f0d8f1d42ce73fd4695295346'; // sha256('dlfmahadev:' + PIN)
const PUBLIC_TABS = ['dashboard', 'film', 'ledger', 'seva'];
const PUBLIC_ACTS = new Set(['goto', 'closeModal', 'copyUpi', 'shareFilm', 'setAmt', 'selfDonate', 'shareAudit', 'sendAudit', 'shareReceiptFile',
  'rmPending', 'seek', 'shareSevas', 'adminLogin', 'adminLogout']);
let ADMIN = (() => { try { return localStorage.getItem(ADMIN_KEY) === ADMIN_HASH; } catch { return false; } })();
const isAdmin = () => ADMIN;
const visibleTabs = () => ADMIN ? TABS : TABS.filter(t => PUBLIC_TABS.includes(t[0]));
const tabOk = k => visibleTabs().some(t => t[0] === k);
async function sha256(txt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function stripAdmin(root) {
  if (ADMIN) return;
  root.querySelectorAll('[data-act]').forEach(el => { const a = el.dataset.act; if (!PUBLIC_ACTS.has(a) || (a === 'goto' && !PUBLIC_TABS.includes(el.dataset.tab))) el.remove(); });
  root.querySelectorAll('.admin-only, [data-join], [data-vstower]').forEach(el => el.remove());
}
function adminLoginForm() {
  openModal(`<form class="form" data-form="adminLogin">
    <h3>🔒 Temple committee login</h3>
    <p class="hint">For committee members and volunteers who enter collections, pledges and drives. Residents don't need to log in.</p>
    <label>Committee PIN<input name="pin" type="password" inputmode="numeric" autocomplete="off" required autofocus></label>
    <div class="actions"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary">Log in</button></div></form>`);
}
let tab = tabOk(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';

function renderHeader() {
  const st = S.settings, T = totals();
  $('#brand-title').textContent = `${st.temple} — Seva Drive`;
  $('#brand-sub').textContent = `ॐ नमः शिवाय · ${st.society}${st.homes ? ` · ${st.homes} homes` : ''} · Prana Pratishtha ${fmtLong(st.deadline)}`;
  $('#top-progress').innerHTML = `<div><b>${lakh(T.achieved)}</b> of ${lakh(st.target)} · ${T.pct.toFixed(1)}% · <b>${T.daysLeft}</b> days left</div>
    <div class="pbar"><span class="seg-open" style="width:${pctOf(st.opening, st.target)}%"></span><span class="seg-col" style="width:${pctOf(T.collected, st.target)}%"></span></div>`;
  const due = duePledges().length;
  $('#tabs').innerHTML = visibleTabs().map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${l}${k === 'pledges' && due ? ` <span class="badge warn">${due}</span>` : ''}</button>`).join('')
    + (ADMIN ? `<button class="view-tag admin" data-act="adminLogout" title="Switch to the public view">🔓 Admin · Exit</button>` : '');
  $('#vol-list').innerHTML = S.volunteers.map(v => `<option value="${esc(v.name)}">`).join('');
  document.title = `${st.temple} Seva Drive`;
}
function render() {
  if (!tabOk(tab)) tab = 'dashboard';
  renderHeader();
  const main = $('#main');
  main.innerHTML = RENDER[tab]() + viewFooter();
  stripAdmin(main);
  hydrate(main);
  tickTimers();
  const cs = $('.chart-scroll'), svg = cs && cs.querySelector('svg');
  if (svg) cs.scrollLeft = Math.max(0, +svg.dataset.todayX - cs.clientWidth * 0.6);
}
function viewFooter() {
  return `<footer class="view-foot">${ADMIN ? `You are in the <b>admin view</b> on this phone. <button class="btn sm" data-act="adminLogout">Switch to public view</button>`
    : `Har Har Mahadev 🙏 · Questions? WhatsApp ${esc(S.settings.auditName)} · ${esc(fmtPhone(S.settings.auditPhone))} · <button class="link small" data-act="adminLogin">Committee login</button>`}</footer>`;
}
function go(t) { if (!tabOk(t)) t = 'dashboard'; tab = t; history.replaceState(null, '', '#' + t); render(); window.scrollTo({ top: 0 }); }

/* ---------- Dashboard ---------- */
RENDER.dashboard = () => {
  const st = S.settings, T = totals(), t = today();
  const last7 = sumRange(addDays(t, -6), t), avg7 = last7 / 7;
  const projected = T.achieved + avg7 * Math.max(0, T.daysLeft - 1);
  const weekAmt = sumRange(mondayOf(t), t);
  const due = duePledges();
  const avg = S.donations.length ? T.collected / S.donations.length : 0;
  let callout;
  if (T.remaining <= 0) callout = `<div class="callout good">🎉 Target achieved! Thank you to every family and volunteer.</div>`;
  else if (!S.donations.length) callout = `<div class="callout info">Add collections in the <b>Collections</b> tab to see day-wise progress and a projection.</div>`;
  else if (projected >= st.target) callout = `<div class="callout good">✅ At the last-7-day pace (${inr(avg7)}/day) we would reach <b>${lakh(projected)}</b> by ${fmtD(st.deadline)} — on track.</div>`;
  else callout = `<div class="callout warn">⚠ At the last-7-day pace (${inr(avg7)}/day) we would reach <b>${lakh(projected)}</b> by ${fmtD(st.deadline)} — short by <b>${lakh(st.target - projected)}</b>. We need <b>${inr(T.perDay)}/day</b> from now.</div>`;

  return `
  ${driveAlert()}
  ${donateCard()}
  <section class="card">
    <div class="hero-top">
      <div><div class="eyebrow">Achieved so far</div><div class="big">${lakh(T.achieved)} <span class="of">of ${lakh(st.target)}</span></div></div>
      <div class="hero-pct">${T.pct.toFixed(1)}%</div>
    </div>
    <div class="pbar big-bar" role="img" aria-label="${T.pct.toFixed(1)} percent of target achieved">
      <span class="seg-open" style="width:${pctOf(st.opening, st.target)}%"></span><span class="seg-col" style="width:${pctOf(T.collected, st.target)}%"></span>
    </div>
    <div class="legend">
      <span><i class="dot open"></i>Before this drive ${lakh(st.opening)}</span>
      <span><i class="dot col"></i>This drive ${lakh(T.collected)}</span>
      <span><i class="dot left"></i>Remaining ${lakh(T.remaining)}</span>
    </div>
    <div class="hero-stats">
      <div><b>${T.daysLeft}</b><span>days left · deadline ${fmtD(st.deadline)}</span></div>
      <div><b>${inr(T.perDay)}</b><span>needed per day</span></div>
      <div><b>${inr(T.remaining / Math.max(1, st.towers.length))}</b><span>remaining per tower (avg of ${st.towers.length})</span></div>
      <div><b>${Math.ceil(T.remaining / Math.max(1, st.minDonation))}</b><span>families at ${inr(st.minDonation)} to close the gap</span></div>
    </div>
    ${callout}
  </section>

  <section class="kpis">
    ${kpi('Today', inr(T.todayAmt), `${T.todayCount} donor${T.todayCount === 1 ? '' : 's'}`)}
    ${kpi('This week', inr(weekAmt), `since ${fmtD(mondayOf(t))}`)}
    ${kpi('Homes contributed', `${households()}${st.homes ? `<span class="muted" style="font-size:.9rem"> / ${st.homes}</span>` : ''}`, st.homes ? `${pctOf(households(), st.homes).toFixed(1)}% of homes · avg ${inr(avg)}` : `avg ${inr(avg)}`)}
    ${kpi('Pledged, still due', inr(T.pledgedPending), `${T.pendingCount} pledge${T.pendingCount === 1 ? '' : 's'}`)}
    ${ADMIN ? (c => kpi('Cash collected', inr(c.total), c.inHand ? `${inr(c.inHand)} still in hand` : 'all deposited', c.inHand ? 'warn' : ''))(cashStats()) : ''}
    ${ADMIN ? kpi('Reminders due', due.length, 'today or overdue', due.length ? 'warn' : '') : ''}
  </section>

  <section class="card">
    <div class="card-h"><h2>Day-wise collections</h2><span class="muted small">Dashed line = amount needed per day to hit the target</span></div>
    <div class="chart-scroll">${dailyChart()}</div>${spanNote()}
  </section>

  <div class="grid-2">
    <section class="card"><div class="card-h"><h2>🏆 Top 5 contributors — Prana Pratishtha Yajmans</h2><span class="muted small">Highest = Day 1 Mukhya Yajman</span></div>${yajmanList()}</section>
    <section class="card"><div class="card-h"><h2>🪔 Temple seva slots</h2><button class="btn sm" data-act="goto" data-tab="seva">Open →</button></div>${sevaMini()}</section>
  </div>

  <div class="grid-2">
    <section class="card">
      <div class="card-h"><h2>Tower-wise progress</h2><span class="muted small">Bar vs. per-tower share ${inr((st.target - st.opening) / Math.max(1, st.towers.length))}</span></div>
      ${towerList()}
    </section>
    <div class="stack">
      <section class="card"><h2>Payment mix</h2>${paymentMix()}</section>
      <section class="card admin-only"><div class="card-h"><h2>Today's drive</h2><button class="btn sm" data-act="goto" data-tab="volunteers">All drives →</button></div>${todaysDrive()}</section>
      <section class="card admin-only"><div class="card-h"><h2>Reminders due</h2><button class="btn sm" data-act="goto" data-tab="pledges">Open →</button></div>
        ${due.length ? `<div class="rem-list compact">${due.slice(0, 5).map(remCard).join('')}</div>` : empty('No reminders due today 🙏')}
      </section>
    </div>
  </div>`;
};

function dailyChart() {
  const st = S.settings, t = today(), T = totals();
  const dates = dated().map(d => d.date).filter(Boolean).sort();
  let start = dates[0] && dates[0] < t ? dates[0] : t;
  if (diffDays(start, t) > 30) start = addDays(t, -30);
  if (diffDays(start, t) < 6) start = addDays(t, -6);
  const end = st.deadline > t ? st.deadline : t;
  const n = diffDays(start, end) + 1, by = dayTotals(), req = T.perDay;
  const vals = Array.from({ length: n }, (_, i) => { const d = addDays(start, i); return { d, v: by[d] || 0 }; });
  const rawMax = Math.max(req, ...vals.map(x => x.v), 10000);
  const p10 = 10 ** Math.floor(Math.log10(rawMax / 4)), f = rawMax / 4 / p10;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p10, maxV = step * 4 * (rawMax > step * 3.7 ? 1.25 : 1);
  const slot = 32, padL = 46, padB = 38, padT = 22, H = 250, W = padL + n * slot + 12;
  const y = v => padT + (H - padT - padB) * (1 - v / maxV);
  let g = '';
  for (let v = 0; v <= maxV + 1; v += step) g += `<line class="c-grid" x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="c-axis" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`;
  vals.forEach(({ d, v }, i) => {
    const x = padL + i * slot + 5, w = slot - 10, dd = parseD(d), future = d > t;
    if (future) g += `<rect class="c-future" x="${x}" y="${padT}" width="${w}" height="${H - padT - padB}" rx="3"><title>${fmtWD(d)} — upcoming</title></rect>`;
    if (v > 0) {
      g += `<rect class="c-bar ${d === t ? 'today' : v >= req ? 'met' : ''}" x="${x}" y="${y(v)}" width="${w}" height="${Math.max(1, y(0) - y(v))}" rx="3"><title>${fmtWD(d)}: ${inr(v)}</title></rect>`;
      g += `<text class="c-val" x="${x + w / 2}" y="${y(v) - 4}" text-anchor="middle">${short(v)}</text>`;
    }
    const lbl = (i === 0 || dd.getDate() === 1) ? `${dd.getDate()} ${dd.toLocaleDateString('en-IN', { month: 'short' })}` : dd.getDate();
    g += `<text class="c-axis" x="${x + w / 2}" y="${H - padB + 14}" text-anchor="middle">${lbl}</text>`;
    if (d === t) g += `<text class="c-mark" x="${x + w / 2}" y="${H - padB + 28}" text-anchor="middle">TODAY</text>`;
    if (d === st.deadline) g += `<text class="c-req-t" x="${x + w / 2}" y="${H - padB + 28}" text-anchor="middle">DEADLINE</text>`;
  });
  if (req > 0) g += `<line class="c-req" x1="${padL}" x2="${W}" y1="${y(req)}" y2="${y(req)}"/><text class="c-req-t" x="${W - 8}" y="${y(req) - 6}" text-anchor="end">Need ${inr(req)}/day</text>`;
  const todayX = padL + Math.max(0, diffDays(start, t)) * slot;
  return `<svg data-today-x="${todayX}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily collections bar chart">${g}</svg>`;
}

function towerList() {
  const st = S.settings, m = towerStats(), cov = S.coverage || {};
  const share = (st.target - st.opening) / Math.max(1, st.towers.length);
  const extra = Object.keys(m).filter(t => !st.towers.includes(t) && m[t].amount);
  return `<div class="towers">${st.towers.map(t => {
    const s = m[t] || { amount: 0, count: 0 }, c = +cov[t] || 0;
    return `<div class="tower-row">
      <button class="tn link" data-act="gotoTower" data-tower="${esc(t)}" title="Show ${esc(t)} collections">${esc(t)}</button>
      <span class="pbar ${s.amount >= share ? 'good' : ''}"><span style="width:${pctOf(s.amount, share)}%"></span></span>
      <span class="ta">${s.amount ? inr(s.amount) : '<span class="badge">No entries</span>'}<small>${s.count} donor${s.count === 1 ? '' : 's'}</small></span>
      <button class="badge ${c >= 100 ? 'good' : c ? 'accent' : ''} cov" data-act="setCoverage" data-tower="${esc(t)}" title="Set % of flats visited">${c ? c + '% visited' : 'Set visited %'}</button>
    </div>`;
  }).join('')}</div>${extra.length ? `<p class="hint" style="margin-top:8px">Also: ${extra.map(t => `${esc(t)} ${inr(m[t].amount)}`).join(' · ')} (consolidated entries not tied to one tower)</p>` : ''}`;
}
function yajmanList() {
  const top = topContributors(5);
  if (!top.length) return empty('Add individual collections or pledges to see the top contributors.');
  return `<ol class="yaj">${top.map((x, i) => `<li><span class="rank">${i + 1}</span><span><b>${esc(x.donor)}</b><small>${esc(x.tower)} · ${esc(x.flat)}</small></span>
    <span class="r"><b>${inr(x.paid + x.pledged)}</b><small>${x.pledged ? `${inr(x.paid)} paid + ${inr(x.pledged)} pledged` : 'paid'}</small></span></li>`).join('')}</ol>`;
}
function sevaMini() {
  const k = sevaStats();
  const idols = S.idols || [], open = idols.filter(x => !x.sponsor);
  return `<div class="week-nums"><div><b>${k.booked} / ${k.slots}</b><span>slots booked</span></div><div><b>${lakh(k.bookedValue)}</b><span>committed</span></div><div><b>${lakh(k.value - k.bookedValue)}</b><span>still open</span></div></div>
    <p class="small" style="margin:10px 0 0">${open.length ? `Idols open for sponsorship: <b>${open.map(x => esc(x.name)).join(', ')}</b>` : 'All idols sponsored 🙏'}</p>`;
}
function paymentMix() {
  const by = {}; S.donations.forEach(d => by[d.mode] = (by[d.mode] || 0) + (+d.amount || 0));
  const tot = sum(Object.values(by));
  if (!tot) return empty('No collections yet');
  const cls = m => m === 'UPI' ? 'upi' : m === 'Cash' ? 'cash' : 'other';
  const full = S.donations.filter(d => d.status === 'Full').length, part = S.donations.length - full;
  return `<div class="pbar" style="height:14px">${Object.entries(by).map(([m, v]) => `<span style="width:${pctOf(v, tot)}%;background:var(--${cls(m)})" title="${esc(m)} ${inr(v)}"></span>`).join('')}</div>
   <div class="legend" style="margin-top:8px">${Object.entries(by).map(([m, v]) => `<span><i class="dot ${cls(m)}"></i>${esc(m)} ${inr(v)} (${pctOf(v, tot).toFixed(0)}%)</span>`).join('')}</div>
   <p class="small muted" style="margin:8px 0 0">Paid in full: <b>${full}</b> · Part payments: <b>${part}</b></p>`;
}
function todaysDrive() {
  const ds = S.drives.filter(d => d.date === today());
  if (!ds.length) return empty(`No drive planned for today. <button class="btn sm primary" data-act="addDrive">+ Plan one</button>`);
  return ds.map(d => `<div style="display:grid;gap:6px">
    <b>${esc(d.time || '')} ${d.meet ? '· ' + esc(d.meet) : ''}</b>
    <div class="chips">${(d.towers || []).map(t => `<span class="chip">${esc(t)}</span>`).join('') || '<span class="muted small">Towers not set</span>'}</div>
    <div class="small">Volunteers: ${(d.volunteerIds || []).map(volName).filter(Boolean).map(esc).join(', ') || '<span class="muted">none yet</span>'}</div>
    <div class="small muted">Target ${inr(d.target)} · Collected so far ${inr(driveCollected(d))}</div></div>`).join('<hr style="border:0;border-top:1px solid var(--border)">');
}

/* Reload when a newer version is published (checked on open and when the tab comes back). */
(function watchUpdates() {
  if (!/^https?:$/.test(location.protocol)) return;
  const mine = (document.querySelector('script[src*="app.js"]')?.getAttribute('src') || '').split('v=')[1];
  if (!mine) return;
  const check = async () => {
    try {
      const html = await (await fetch(location.pathname + '?check=' + Date.now(), { cache: 'no-store' })).text();
      const live = (html.match(/app\.js\?v=(\w+)/) || [])[1];
      if (live && live !== mine) location.reload();
    } catch {}
  };
  setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
})();

/* ---------- Public ledger (assets/ledger.json, no phone numbers) ---------- */
const LG = { data: null, loading: false, q: '', sec: 'receipts', st: '' };
function loadLedger() {
  if (LG.data || LG.loading) return; LG.loading = true;
  fetch('assets/ledger.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => { LG.data = d; if (tab === 'ledger' || tab === 'volunteers') render(); })
    .catch(() => { LG.data = { error: true }; if (tab === 'ledger') render(); });
}
const ST_CLS = s => /^Paid$|Paid earlier/.test(s) ? 'good' : /Part|Pledged|Promised/.test(s) ? 'warn' : '';
RENDER.ledger = () => {
  loadLedger();
  const d = LG.data;
  if (!d) return `<section class="card">${empty('Loading the ledger…')}</section>`;
  if (d.error) return `<section class="card">${empty('Could not load the ledger. Check your connection and refresh.')}</section>`;
  const R = d.receipts, paid = sum(R.map(x => x.paid)), beforeT = sum(d.before.map(x => x.amount));
  const cnt = st => R.filter(x => x.status === st).length;
  const pend = R.filter(x => /Pledged|Promised|Part/.test(x.status));
  const statuses = [...new Set(R.map(x => x.status))];
  return `
  <section class="card"><div class="card-h"><h2>📒 Temple collection ledger</h2><span class="muted small">Updated ${fmtD(d.updated)} · mobile numbers are never shown here</span></div>
    <p class="hint">Every receipt, UPI payment and earlier donation, so every family can see where we stand. Receipts that say "already paid" are listed for reference only and not counted twice. If anything about your family is wrong, message ${esc(S.settings.auditName)} on WhatsApp.</p>
    <section class="kpis" style="margin-top:12px">
      ${kpi('Before the drive', inr(beforeT), `${d.before.length} families`)}
      ${kpi('Receipt book: paid', inr(paid), `${cnt('Paid') + cnt('Part paid')} receipts`, 'good')}
      ${kpi('Promised / pledged', pend.length, 'families to follow up after 30 Nov', 'warn')}
      ${kpi('Paid earlier (reference)', cnt('Paid earlier (receipt for reference)'), 'already counted before')}
      ${kpi('UPI screenshots', inr(sum(d.upi.map(x => x.amount))), `${d.upi.length} payments`)}
    </section></section>
  <section class="card">
    <div class="filters" style="grid-template-columns:2fr 1fr 1fr">
      <input type="search" placeholder="Search name or flat (e.g. L-121)" data-lg="q" value="${esc(LG.q)}" aria-label="Search ledger">
      <select data-lg="sec" aria-label="Section">${[['receipts', 'Receipt book (drive)'], ['upi', 'UPI payments'], ['before', 'Before the drive']].map(([v, l]) => `<option value="${v}" ${LG.sec === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select data-lg="st" aria-label="Status" ${LG.sec === 'receipts' ? '' : 'disabled'}><option value="">All statuses</option>${statuses.map(x => `<option ${LG.st === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
    </div>
    <div id="lg-list">${ledgerList()}</div>
  </section>`;
};
function ledgerList() {
  const d = LG.data, q = LG.q.trim().toLowerCase().replace(/\s+/g, '');
  const hit = x => !q || (x.name + x.flat).toLowerCase().replace(/[\s-]+/g, '').includes(q.replace(/-/g, ''));
  const tbl = (head, rows, total) => rows.length ? `<p class="small muted" style="margin:0 0 8px">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}${total != null ? ` · <b>${inr(total)}</b>` : ''}</p>
    <div class="table-wrap"><table class="rtable"><thead><tr>${head.map(h => `<th${h.r ? ' class="r"' : ''}>${h.t}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : empty('No entries match.');
  if (LG.sec === 'before') {
    const L = d.before.filter(hit);
    return tbl([{ t: 'Donor' }, { t: 'Flat' }, { t: 'Amount', r: 1 }], L.map(x => `<tr><td data-label="Donor"><b>${esc(x.name)}</b></td><td data-label="Flat">${esc(x.flat)}</td><td class="r" data-label="Amount">${inr(x.amount)}${x.note ? ` <span class="badge">${esc(x.note)}</span>` : ''}</td></tr>`), sum(L.map(x => x.amount)));
  }
  if (LG.sec === 'upi') {
    const L = d.upi.filter(hit);
    return tbl([{ t: 'Date' }, { t: 'Paid by' }, { t: 'Flat' }, { t: 'Amount', r: 1 }], L.map(x => `<tr><td data-label="Date">${fmtD(x.date)} ${esc(x.time || '')}</td><td data-label="Paid by">${esc(x.name)}</td><td data-label="Flat">${esc(x.flat || '—')}</td><td class="r" data-label="Amount"><b>${inr(x.amount)}</b></td></tr>`), sum(L.map(x => x.amount)));
  }
  const L = d.receipts.filter(x => hit(x) && (!LG.st || x.status === LG.st));
  return tbl([{ t: 'Receipt' }, { t: 'Date' }, { t: 'Name' }, { t: 'Flat' }, { t: 'Amount', r: 1 }, { t: 'Status' }, { t: 'Mode' }],
    L.map(x => `<tr><td data-label="Receipt">${esc(x.no)}</td><td data-label="Date">${x.date ? fmtD(x.date) : '—'}</td>
      <td data-label="Name"><b>${esc(x.name)}</b>${x.occ ? `<div class="small muted">${esc(x.occ)}</div>` : ''}</td><td data-label="Flat">${esc(x.flat || '—')}</td>
      <td class="r" data-label="Amount">${x.amount ? inr(x.amount) : '—'}${x.verify ? '<div class="small muted">to verify</div>' : ''}</td>
      <td data-label="Status"><span class="badge ${ST_CLS(x.status)}">${esc(x.status)}</span></td><td data-label="Mode">${esc(x.mode || '—')}</td></tr>`), sum(L.map(x => x.paid)));
}

/* ---------- Volunteer reminders: 30 minutes before each drive ---------- */
const REMIND_MIN = 30;
function driveStart(d) {
  // "7:00 PM – 9:00 PM", "7 PM", "19:00", "6.30pm" → Date of the start time (default 7 PM)
  const m = String(d.time || '').match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
  let h = 19, mi = 0;
  if (m) { h = +m[1]; mi = +(m[2] || 0); const ap = (m[3] || '').toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; if (!ap && h < 9) h += 12; }
  const dt = parseD(d.date); dt.setHours(h, mi, 0, 0); return dt;
}
const hm = dt => dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
function remindMsg(d) {
  const st = S.settings, start = driveStart(d), vols = (d.volunteerIds || []).map(volName).filter(Boolean);
  const left = Math.round((start - new Date()) / 60000), inTxt = left > 0 && left <= 90 ? `in ${left} minutes` : d.date === today() ? 'today' : 'on ' + fmtWD(d.date);
  return [`🔔 *Reminder: Temple seva drive ${inTxt}* 🙏`, ``,
    `⏰ Starts *${hm(start)}*${d.date === today() ? ' today' : ', ' + fmtWD(d.date)}${d.meet ? ` · 📍 Meet at *${d.meet}*` : ''}`,
    `🏢 ${(d.towers || []).join(' & ') || 'Towers to be decided'}`,
    vols.length ? `🙋 Team: ${vols.join(', ')}` : null,
    ``, `Please bring: receipt book & pen · temple QR card · phone charged (film & photos ready)`,
    `Running late or can't come? Reply here so we can adjust. Har Har Mahadev 🔱`].filter(l => l !== null).join('\n');
}
function driveAlert() {
  if (!ADMIN) return '';
  const now = new Date();
  const soon = S.drives.filter(d => d.status !== 'Done' && d.date === today()).map(d => ({ d, start: driveStart(d) }))
    .filter(x => x.start - now <= 90 * 60000 && x.start - now > -60 * 60000).sort((a, b) => a.start - b.start)[0];
  if (!soon) return '';
  const mins = Math.round((soon.start - now) / 60000);
  const when = mins > 0 ? `starts in <b>${mins} min</b> (${hm(soon.start)})` : 'has started';
  return `<div class="callout ${mins <= REMIND_MIN ? 'warn' : 'info'}" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <span>🔔 Today's drive ${when}${soon.d.meet ? ` · meet at <b>${esc(soon.d.meet)}</b>` : ''}. ${mins > REMIND_MIN ? `Remind the team at ${hm(new Date(soon.start - REMIND_MIN * 60000))}.` : 'Send the team reminder now.'}</span>
    <button class="btn sm wa" data-act="remindDrive" data-id="${soon.d.id}">💬 Send reminder</button>
    ${'Notification' in window && Notification.permission === 'default' ? '<button class="btn sm" data-act="enableAlerts">Turn on phone alerts</button>' : ''}</div>`;
}
function icsFor(list) {
  const pad = n => String(n).padStart(2, '0'), f = dt => `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
  const escI = t => String(t).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ev = list.map(d => { const a = driveStart(d), b = new Date(a.getTime() + 2 * 3600000);
    return ['BEGIN:VEVENT', `UID:${d.id}@mahadev-seva-drive`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(a)}`, `DTEND:${f(b)}`,
      `SUMMARY:${escI('🔱 Temple seva drive' + (d.towers?.length ? ' · ' + d.towers.join(' & ') : ''))}`,
      `LOCATION:${escI((d.meet ? d.meet + ', ' : '') + S.settings.society)}`,
      `DESCRIPTION:${escI('Bring receipt book, QR card and charged phone. ' + (siteLink() || ''))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escI('Temple drive in 30 minutes' + (d.meet ? ' · meet at ' + d.meet : ''))}`, `TRIGGER:-PT${REMIND_MIN}M`, 'END:VALARM', 'END:VEVENT'].join('\r\n'); });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mahadev Seva Drive//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...ev, 'END:VCALENDAR'].join('\r\n');
}
// Phone notification 30 min before, while the site is open on this phone
const notified = new Set(); let lastAlert = null;
setInterval(() => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  S.drives.filter(d => d.status !== 'Done' && d.date === today()).forEach(d => {
    const lead = driveStart(d) - now;
    if (lead <= REMIND_MIN * 60000 && lead > 0 && !notified.has(d.id)) {
      notified.add(d.id);
      try { new Notification('🔔 Temple drive in ' + Math.round(lead / 60000) + ' min', { body: (d.meet ? 'Meet at ' + d.meet + '. ' : '') + 'Tap to send the team reminder.', tag: 'drive-' + d.id }).onclick = () => { window.focus(); ACTIONS.remindDrive({ id: d.id }); }; } catch {}
    }
  });
  if ((tab === 'dashboard' || tab === 'volunteers') && !document.querySelector('dialog[open]') && !document.activeElement?.matches('input,textarea,select')) {
    const html = driveAlert(); if (html !== lastAlert) { lastAlert = html; render(); }
  }
}, 60000);

/* ---------- Door-to-door status per flat (assets/visits.json + receipt book) ---------- */
const VS = { data: null, loading: false, tower: 'L' };
function loadVisits() {
  if (VS.data || VS.loading) return; VS.loading = true;
  fetch('assets/visits.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => { VS.data = d; if (tab === 'volunteers') render(); }).catch(() => {});
}
const DOOR = [
  ['given', 'Contributed', 'good'], ['promised', 'Promised / pledged', 'warn'], ['revisit', 'Revisit', 'accent'], ['locked', 'Locked / evening', 'accent'],
  ['vacant', 'Vacant', ''], ['na', 'Not applicable / not available', ''], ['todo', 'Not visited yet', 'todo'],
];
function doorMap(tw) {
  const v = VS.data.towers[tw], L = LG.data || { receipts: [], before: [] }, m = {};
  const set = (f, k, label) => { const rank = DOOR.findIndex(x => x[0] === k), cur = m[f]; if (!cur || rank < DOOR.findIndex(x => x[0] === cur.k)) m[f] = { k, label }; };
  Object.entries(v.notes).forEach(([f, n]) => set(f, /vacant/i.test(n) ? 'vacant' : /not appl|not avail|do not/i.test(n) ? 'na' : /lock|evening/i.test(n) ? 'locked' : 'revisit', n));
  L.receipts.filter(x => x.flat.startsWith(tw + '-')).forEach(x => {
    const f = x.flat.slice(2);
    if (/^Paid|Part/.test(x.status)) set(f, 'given', x.status + (x.amount ? ' · ' + inr(x.amount) : ''));
    else if (/Pledged|Promised/.test(x.status)) set(f, 'promised', x.status);
  });
  L.before.forEach(x => String(x.flat).split(/[,&]/).forEach(p => { const mm = p.trim().match(/^([A-Z])\s*-?\s*0*(\d+)/); if (mm && mm[1] === tw) set(mm[2].padStart(3, '0'), 'given', 'Contributed before the drive · ' + inr(x.amount)); }));
  (v.flats || Object.keys(m).sort()).forEach(f => { if (!m[f]) m[f] = { k: 'todo', label: 'Not visited yet' }; });
  return m;
}
function doorStatus() {
  loadVisits(); loadLedger();
  if (!VS.data) return '';
  const tw = VS.tower, m = doorMap(tw), flats = VS.data.towers[tw].flats || Object.keys(m).sort();
  const c = k => flats.filter(f => m[f] && m[f].k === k).length;
  const floors = {}; flats.forEach(f => (floors[f.slice(0, 2)] ||= []).push(f));
  return `<section class="card"><div class="card-h"><h2>🚪 Door-to-door status</h2>
    <div class="seg">${Object.keys(VS.data.towers).map(t => `<label><input type="radio" name="vstower" value="${t}" data-vstower ${t === tw ? 'checked' : ''}> Tower ${t}</label>`).join('')}</div></div>
    <div class="legend" style="margin-bottom:10px">${DOOR.map(([k, l, cl]) => `<span><i class="door-dot ${k}"></i>${l} <b>${c(k)}</b></span>`).join('')}</div>
    ${VS.data.towers[tw].flats ? '' : '<p class="hint" style="margin-bottom:8px">Only flats with a note or a receipt are shown for this tower; send the tower\'s flat list to show every door.</p>'}
    <div class="door-grid">${Object.keys(floors).sort().reverse().map(fl => `<div class="door-floor"><span class="door-fl">${+fl}F</span>${floors[fl].map(f => `<span class="door ${m[f].k}" title="${tw}-${f}: ${esc(m[f].label)}">${f}</span>`).join('')}</div>`).join('')}</div>
    <p class="small muted" style="margin:8px 0 0">Tap and hold (or hover) a flat for details. Based on the visit sheets of ${fmtD(VS.data.updated)} and the receipt book.</p></section>`;
}

/* ---------- Donate (residents) ---------- */
const fmtPhone = p => { const d = String(p || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p; };
function upiLink() { const st = S.settings; return st.upiQr || (st.upi ? `upi://pay?pa=${encodeURIComponent(st.upi)}&pn=${encodeURIComponent(st.temple)}&cu=INR` : ''); }
function donateCard() {
  const st = S.settings, qrOk = st.upi === REAL_SETTINGS.upi;
  return `<section class="card donate" id="donate">
    <div class="donate-grid">
      <div class="qr-box">
        ${qrOk ? `<img src="assets/upi-qr.png" alt="UPI QR code for ${esc(st.upi)}" width="200" height="200">` : ''}
        <div class="upi-id"><span>${esc(st.upi)}</span> <button class="btn sm" data-act="copyUpi">Copy</button></div>
        <div class="small muted">HDFC Bank · GPay · PhonePe · Paytm · Cards</div>
      </div>
      <div class="donate-body">
        <div class="eyebrow">Donate to ${esc(st.temple)}</div>
        <h2>Scan · Pay · Send us your receipt 🙏</h2>
        <ol class="steps">
          <li>Scan the QR with any UPI app and give from <b>${inr(st.minDonation)}</b>, or any amount your heart feels. Every offering is a seva.</li>
          <li>Take a <b>screenshot</b> of the successful payment.</li>
          <li>Tap <b>Submit my donation</b>. Enter your name, flat, owner or tenant, and upload the screenshot.</li>
          <li>Send the receipt on WhatsApp to <b>${esc(st.auditName)} · ${esc(fmtPhone(st.auditPhone))}</b> for audit. Your thank-you receipt follows.</li>
        </ol>
        <div class="row-actions">
          <a class="btn mobile-only" href="${esc(upiLink())}">📱 Pay with UPI app</a>
          <button class="btn primary" data-act="selfDonate">🧾 Submit my donation</button>
          <button class="btn wa" data-act="shareAudit">💬 WhatsApp ${esc(st.auditName)}</button>
        </div>
      </div>
    </div>
  </section>`;
}
function selfDonateForm() {
  resetPending([]);
  const st = S.settings;
  openModal(`<form class="form" data-form="selfDonate">
    <h3>🧾 Submit my donation</h3>
    <p class="hint">Paid by UPI? Fill this in and attach the payment screenshot. Your details go only to the temple committee, for receipts and audit.</p>
    <div class="grid2">
      <label class="span2">Your name<input name="donor" required autocomplete="name" placeholder="e.g. Ishita Das"></label>
      <label>Tower<select name="tower" required><option value="">Choose…</option>${towerOpts('', false)}</select></label>
      <label>Flat no.<input name="flat" required inputmode="numeric" placeholder="e.g. 082"></label>
      <fieldset class="span2"><legend>I am the</legend>${radios('occupancy', ['Owner', 'Tenant'], '')}</fieldset>
      <label>Mobile (WhatsApp)<input name="phone" type="tel" inputmode="tel" required autocomplete="tel" placeholder="10-digit number"></label>
      <label>Amount paid (₹)<input name="amount" type="number" min="1" step="1" required inputmode="numeric" placeholder="${st.minDonation}"></label>
    </div>
    <div class="chips">${TIERS.slice(0, 8).map(t => `<button type="button" class="chip" data-act="setAmt" data-v="${t}">${inr(t)}</button>`).join('')}</div>
    <fieldset><legend>Paid by</legend>${radios('mode', ['UPI', 'Bank Transfer', 'Cash to volunteer'], 'UPI')}
      <label>UPI transaction / UTR no. <span class="muted small">(optional, from the screenshot)</span><input name="ref" inputmode="numeric" autocomplete="off"></label></fieldset>
    ${dropzone('Upload payment screenshot')}
    <div class="actions"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary">Submit 🙏</button></div></form>`);
}
function auditMsg(r) {
  const st = S.settings;
  return [`🧾 *Temple donation — receipt for audit*`, `${st.temple}`, ``,
    `Name: *${r.donor}*`, `Flat: ${r.tower} · ${r.flat} (${r.occupancy})`, `Mobile: ${r.phone}`,
    `Amount: *${inr(r.amount)}* · ${r.mode}`, r.ref ? `UPI / UTR ref: ${r.ref}` : null, `Date: ${fmtD(r.date)}`, ``,
    r.mode === 'Cash to volunteer' ? `Cash handed to a temple volunteer.` : `📎 Payment screenshot attached.`, `Har Har Mahadev 🙏`].filter(l => l !== null).join('\n');
}
function thanksScreen(r) {
  const st = S.settings, canFile = !!(UI.lastShare && navigator.canShare && navigator.canShare({ files: UI.lastShare }));
  openModal(`<div class="form thanks">
    <div class="thanks-om">🔱</div>
    <h3>Thank you, ${esc(r.donor)} ji! 🙏</h3>
    <p>Your offering of <b>${inr(r.amount)}</b> is a seva towards bringing <b>Narmadeshwar Mahadev</b> home to ${esc(st.society)}. May Mahadev bless your family.</p>
    <div class="callout info"><b>One last step, for audit:</b> send this receipt to <b>${esc(st.auditName)} (${esc(fmtPhone(st.auditPhone))})</b> on WhatsApp.
      ${canFile ? 'Tap <b>Share receipt</b>, choose <b>WhatsApp</b>, then pick ' + esc(st.auditName) + '.' : 'WhatsApp opens with your details filled in. Tap 📎 and attach your payment screenshot before sending.'}</div>
    <div class="row-actions" style="justify-content:center;flex-wrap:wrap">
      ${canFile ? `<button class="btn primary" data-act="shareReceiptFile">📤 Share receipt + screenshot</button>` : ''}
      <button class="btn ${canFile ? '' : 'primary'} wa" data-act="sendAudit">💬 WhatsApp ${esc(st.auditName)}</button>
      <button class="btn" data-act="shareFilm">🎬 Share temple film with neighbours</button>
    </div>
    <p class="small muted" style="margin-top:12px">Saved on this phone · ${fmtD(r.date)} · ${esc(r.tower)} ${esc(r.flat)}</p>
    <div class="actions"><button type="button" class="btn ghost" data-act="closeModal">Done</button></div></div>`);
}

/* ---------- Collections ---------- */
RENDER.collections = () => {
  const f = UI.col;
  return `
  <div class="toolbar">
    <button class="btn primary" data-act="addDonation">+ Add collection</button>
    <button class="btn" data-act="addProof">📎 Upload day's receipts</button>
    <span class="spacer"></span>
    <button class="btn ghost" data-act="exportCSV">⬇ Export CSV</button>
  </div>
  <section class="card"><div class="card-h"><h2>Day-wise summary</h2><span class="muted small">Tap a day to filter the list</span></div>${daySummary()}</section>
  ${subsSection()}
  <section class="card" id="cash"><div class="card-h"><h2>💵 Cash collection</h2><span class="muted small">Kept separate from UPI until it reaches the temple account</span></div>${cashSection()}</section>
  <section class="card">
    <div class="card-h"><h2>All collections</h2></div>
    <div class="filters">
      <input type="search" placeholder="Search donor, flat, phone, ref…" data-filter="q" value="${esc(f.q)}" aria-label="Search">
      <input type="date" data-filter="date" value="${esc(f.date)}" aria-label="Date">
      <select data-filter="tower" aria-label="Tower"><option value="">All towers</option>${towerOpts(f.tower, false)}</select>
      <select data-filter="mode" aria-label="Mode"><option value="">All modes</option>${MODES.map(m => `<option ${m === f.mode ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <select data-filter="status" aria-label="Paid"><option value="">Full & part</option>${['Full', 'Part'].map(m => `<option ${m === f.status ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <button class="btn ghost sm" data-act="clearFilters">Clear</button>
    </div>
    <div id="col-list">${colList()}</div>
  </section>
  <section class="card"><div class="card-h"><h2>Daily receipt uploads</h2><button class="btn sm" data-act="addProof">+ Upload</button></div>
    <p class="hint" style="margin-bottom:10px">Upload the day's WhatsApp UPI screenshots, cash tally sheet or receipt-book photos here — kept day-wise as proof.</p>
    ${proofGallery()}
  </section>`;
};
function subsSection() {
  const list = (S.submissions || []).filter(x => !x.addedId);
  if (!list.length) return '';
  return `<section class="card"><div class="card-h"><h2>📲 Resident submissions on this phone</h2><span class="muted small">Check against the bank statement, then add to collections</span></div>
  <div class="rem-list">${list.map(x => `<div class="rem"><div><div class="who">${esc(x.donor)} · ${inr(x.amount)}</div>
    <div class="meta">${fmtD(x.date)} · ${esc(x.tower)} ${esc(x.flat)} (${esc(x.occupancy || '—')}) · ${esc(x.mode)}${x.ref ? ' · ref ' + esc(x.ref) : ''} · ${esc(x.phone)}</div>${thumbs(x.receiptIds)}</div>
    <div class="row-actions"><button class="btn sm primary" data-act="acceptSub" data-id="${x.id}">✅ Add to collections</button><button class="btn sm icon danger" data-act="delSub" data-id="${x.id}" title="Delete">🗑</button></div></div>`).join('')}</div></section>`;
}
function cashStats() {
  const cash = S.donations.filter(d => d.mode === 'Cash');
  const held = cash.filter(d => !d.depositedOn);
  const byHolder = {}; held.forEach(d => { const k = d.cashWith || d.collectedBy || 'Not recorded'; (byHolder[k] ||= []).push(d); });
  return { cash, held, byHolder, total: sum(cash.map(d => d.amount)), inHand: sum(held.map(d => d.amount)), deposited: sum(cash.filter(d => d.depositedOn).map(d => d.amount)) };
}
function cashSection() {
  const c = cashStats();
  if (!c.cash.length) return empty('No cash collections yet. When you add a collection with mode <b>Cash</b>, note who is holding it — it shows here until it is deposited.');
  const online = sum(S.donations.filter(d => d.mode !== 'Cash').map(d => d.amount));
  return `<div class="week-nums"><div><b>${inr(c.total)}</b><span>cash collected · ${c.cash.length} entries</span></div><div><b>${inr(c.deposited)}</b><span>deposited to temple account</span></div><div><b${c.inHand ? ' style="color:var(--warn)"' : ''}>${inr(c.inHand)}</b><span>still in hand</span></div><div><b>${inr(online)}</b><span>online (UPI / bank / cheque)</span></div></div>
  ${c.held.length ? `<h3 style="margin:14px 0 6px">Cash in hand — by volunteer</h3><div class="rem-list">${Object.entries(c.byHolder).sort((a, b) => sum(b[1].map(d => d.amount)) - sum(a[1].map(d => d.amount))).map(([who, list]) => `<div class="rem overdue"><div><div class="who">${esc(who)} · ${inr(sum(list.map(d => d.amount)))}</div>
    <div class="meta">${list.map(d => `${esc(d.donor)} (${esc(d.flat)}) ${inr(d.amount)} · ${d.dateFrom ? spanLabel(d) : fmtD(d.date)}`).join(' · ')}</div></div>
    <div class="row-actions"><button class="btn sm" data-act="depositCash" data-who="${esc(who)}">✅ Mark deposited today</button></div></div>`).join('')}</div>` : '<p class="small" style="margin:10px 0 0">✅ All cash has been deposited.</p>'}`;
}
function daySummary() {
  const g = {};
  S.donations.forEach(d => {
    const r = g[d.dateFrom ? d.dateFrom + '~' + d.date : d.date] ||= { n: 0, upi: 0, cash: 0, other: 0, tot: 0, rc: 0 };
    r.n++; r.tot += +d.amount || 0; r.rc += (d.receiptIds || []).length;
    if (d.mode === 'UPI') r.upi += +d.amount || 0; else if (d.mode === 'Cash') r.cash += +d.amount || 0; else r.other += +d.amount || 0;
  });
  const days = Object.keys(g).sort().reverse();
  if (!days.length) return empty('No collections yet. Tap <b>+ Add collection</b> after each visit.');
  const proofs = d => d.includes('~') ? 0 : S.dayProofs.filter(p => p.date === d).reduce((s, p) => s + p.fileIds.length, 0);
  const tot = k => sum(days.map(d => g[d][k]));
  return `<div class="table-wrap"><table style="min-width:560px"><thead><tr><th>Date</th><th class="r">Donors</th><th class="r">UPI</th><th class="r">Cash</th><th class="r">Other</th><th class="r">Total</th><th class="r">Receipts</th></tr></thead><tbody>
  ${days.map(d => { const r = g[d], sp = d.includes('~') ? d.split('~') : null; return `<tr class="click" data-act="filterDate" data-date="${sp ? sp[1] : d}">
    <td data-label="Date"><b>${sp ? `${fmtD(sp[0])} – ${fmtD(sp[1])}` : fmtWD(d)}</b>${sp ? ' <span class="muted small">not split by day</span>' : d === today() ? ' <span class="badge accent">Today</span>' : ''}</td>
    <td class="r" data-label="Donors">${r.n}</td><td class="r" data-label="UPI">${inr(r.upi)}</td><td class="r" data-label="Cash">${inr(r.cash)}</td>
    <td class="r" data-label="Other">${inr(r.other)}</td><td class="r" data-label="Total"><b>${inr(r.tot)}</b></td>
    <td class="r" data-label="Receipts">${r.rc + proofs(d)}</td></tr>`; }).join('')}
  </tbody><tfoot><tr><td data-label="">Total</td><td class="r" data-label="Donors">${tot('n')}</td><td class="r" data-label="UPI">${inr(tot('upi'))}</td><td class="r" data-label="Cash">${inr(tot('cash'))}</td><td class="r" data-label="Other">${inr(tot('other'))}</td><td class="r" data-label="Total">${inr(tot('tot'))}</td><td data-label=""></td></tr></tfoot></table></div>`;
}
function colList() {
  const f = UI.col, q = f.q.trim().toLowerCase();
  const list = S.donations.filter(d =>
    (!f.date || d.date === f.date) && (!f.tower || d.tower === f.tower) && (!f.mode || d.mode === f.mode) && (!f.status || d.status === f.status) &&
    (!q || [d.donor, d.flat, d.phone, d.ref, d.collectedBy, d.notes, d.tower].join(' ').toLowerCase().includes(q))
  ).sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  if (!list.length) return empty(S.donations.length ? 'No collections match these filters.' : 'No collections yet.');
  return `<p class="small muted" style="margin:0 0 8px">${list.length} entr${list.length === 1 ? 'y' : 'ies'} · <b>${inr(sum(list.map(d => d.amount)))}</b></p>
  <div class="table-wrap"><table class="rtable"><thead><tr><th>Date</th><th>Donor</th><th>Tower / Flat</th><th class="r">Amount</th><th>Paid</th><th>Mode</th><th>Collected by</th><th>Receipts</th><th></th></tr></thead><tbody>
  ${list.map(d => `<tr>
    <td data-label="Date">${d.dateFrom ? spanLabel(d) : fmtD(d.date)}</td>
    <td data-label="Donor"><b>${esc(d.donor)}</b>${d.phone ? `<div class="small muted">${esc(d.phone)}</div>` : ''}</td>
    <td data-label="Tower / Flat">${esc(d.tower)} · ${esc(d.flat)}</td>
    <td class="r" data-label="Amount"><b>${inr(d.amount)}</b>${d.status === 'Part' && d.committed ? `<div class="small muted">of ${inr(d.committed)}</div>` : ''}</td>
    <td data-label="Paid">${statusBadge(d.status)}</td>
    <td data-label="Mode">${modeBadge(d.mode)}${d.ref ? `<div class="small muted">${esc(d.ref)}</div>` : ''}</td>
    <td data-label="Collected by">${esc(d.collectedBy || '—')}</td>
    <td data-label="Receipts">${thumbs(d.receiptIds)}</td>
    <td data-label=""><div class="row-actions">
      <button class="btn sm wa" data-act="thank" data-id="${d.id}" title="Send thank-you on WhatsApp">🙏 Thank</button>
      <button class="btn sm icon" data-act="editDonation" data-id="${d.id}" title="Edit">✏️</button>
      <button class="btn sm icon danger" data-act="delDonation" data-id="${d.id}" title="Delete">🗑</button>
    </div></td></tr>`).join('')}
  </tbody></table></div>`;
}
function updateColList() { const el = $('#col-list'); if (el) { el.innerHTML = colList(); hydrate(el); } }
function proofGallery() {
  if (!S.dayProofs.length) return empty('No day-wise uploads yet.');
  const byDate = {}; S.dayProofs.forEach(p => (byDate[p.date] ||= []).push(p));
  return Object.keys(byDate).sort().reverse().map(d => `<div style="margin-bottom:14px">
    <h3 style="margin-bottom:6px">${fmtWD(d)} <span class="muted small">· ${inr(sumRange(d, d))} collected</span></h3>
    ${byDate[d].map(p => `<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:6px">
      ${thumbs(p.fileIds, 'lg')}<div style="flex:1;min-width:160px" class="small">${esc(p.note || '')}</div>
      <button class="btn sm icon danger" data-act="delProof" data-id="${p.id}" title="Delete upload">🗑</button></div>`).join('')}
  </div>`).join('');
}

/* ---------- Pledges ---------- */
function remCard(p) {
  const t = today(), bal = p.amount - (p.paid || 0), late = p.reminderDate < t;
  return `<div class="rem ${late ? 'overdue' : ''}">
    <div><div class="who">${esc(p.donor)} <span class="muted small">· ${esc(p.tower)} ${esc(p.flat)}</span></div>
      <div class="meta">${inr(bal)} due${p.paid ? ` (paid ${inr(p.paid)} of ${inr(p.amount)})` : ''} · reminder ${late ? `<b>overdue since ${fmtD(p.reminderDate)}</b>` : 'today'}${p.lastReminded ? ` · last reminded ${fmtD(p.lastReminded)} (${p.remindCount || 1}×)` : ''}</div></div>
    <div class="row-actions">
      <button class="btn sm wa" data-act="remind" data-id="${p.id}">💬 Remind</button>
      <button class="btn sm" data-act="payPledge" data-id="${p.id}">₹ Record payment</button>
      <button class="btn sm ghost" data-act="snooze" data-id="${p.id}">+3 days</button>
    </div></div>`;
}
RENDER.pledges = () => {
  const t = today(), pend = S.pledges.filter(p => p.status === 'Pending'), due = duePledges();
  const next7 = pend.filter(p => p.reminderDate > t && p.reminderDate <= addDays(t, 7));
  const fulfilled = S.pledges.filter(p => p.status === 'Fulfilled');
  const list = S.pledges.filter(p => !UI.pledgeStatus || p.status === UI.pledgeStatus)
    .sort((a, b) => (a.reminderDate || '9').localeCompare(b.reminderDate || '9'));
  return `
  <div class="toolbar"><button class="btn primary" data-act="addPledge">+ Add pledge</button>
    <span class="muted small">A part payment in Collections automatically creates a pledge for the balance.</span></div>
  <section class="kpis">
    ${kpi('Pledged, still due', inr(sum(pend.map(p => p.amount - (p.paid || 0)))), `${pend.length} families`)}
    ${kpi('Reminders due', due.length, 'today or overdue', due.length ? 'warn' : '')}
    ${kpi('Reminders next 7 days', next7.length, inr(sum(next7.map(p => p.amount - (p.paid || 0)))))}
    ${kpi('Pledges fulfilled', fulfilled.length, inr(sum(fulfilled.map(p => p.amount))), 'good')}
  </section>
  <section class="card"><div class="card-h"><h2>🔔 Send these reminders today</h2><span class="muted small">"Remind" opens WhatsApp with the message filled in and schedules the next reminder in 3 days</span></div>
    ${due.length ? `<div class="rem-list">${due.map(remCard).join('')}</div>` : empty('All caught up — no reminders due today 🙏')}
  </section>
  <section class="card"><div class="card-h"><h2>All pledges</h2>
    <div class="seg">${['Pending', 'Fulfilled', 'Cancelled', ''].map(s => `<label><input type="radio" name="pf" value="${s}" data-pledge-filter ${UI.pledgeStatus === s ? 'checked' : ''}> ${s || 'All'}</label>`).join('')}</div></div>
    ${list.length ? `<div class="table-wrap"><table class="rtable"><thead><tr><th>Donor</th><th>Tower / Flat</th><th class="r">Pledged</th><th class="r">Balance</th><th>Pay by</th><th>Next reminder</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr>
      <td data-label="Donor"><b>${esc(p.donor)}</b>${p.phone ? `<div class="small muted">${esc(p.phone)}</div>` : ''}${p.notes ? `<div class="small muted">${esc(p.notes)}</div>` : ''}</td>
      <td data-label="Tower / Flat">${esc(p.tower)} · ${esc(p.flat)}</td>
      <td class="r" data-label="Pledged">${inr(p.amount)}</td>
      <td class="r" data-label="Balance"><b>${inr(p.amount - (p.paid || 0))}</b></td>
      <td data-label="Pay by">${fmtD(p.dueDate)}</td>
      <td data-label="Next reminder">${p.status === 'Pending' ? `${fmtD(p.reminderDate)}${p.reminderDate && p.reminderDate <= t ? ' <span class="badge warn">due</span>' : ''}` : '—'}</td>
      <td data-label="Status">${statusBadge(p.status)}</td>
      <td data-label=""><div class="row-actions">
        ${p.status === 'Pending' ? `<button class="btn sm wa" data-act="remind" data-id="${p.id}">💬</button><button class="btn sm" data-act="payPledge" data-id="${p.id}">₹ Paid</button>` : ''}
        <button class="btn sm icon" data-act="editPledge" data-id="${p.id}">✏️</button>
        <button class="btn sm icon danger" data-act="delPledge" data-id="${p.id}">🗑</button></div></td></tr>`).join('')}
    </tbody></table></div>` : empty('No pledges in this view.')}
  </section>`;
};

/* ---------- Temple film ---------- */
function filmPlayer(compact = false) {
  const f = FILMS[UI.film], lang = UI.filmLang, scale = lang === 'hi' ? (f.hiScale || 1) : 1;
  return `<div class="film-ctrls">
      <div class="seg">${Object.entries(FILMS).map(([k, v]) => `<label><input type="radio" name="film" value="${k}" data-film ${UI.film === k ? 'checked' : ''}> ${v.label}</label>`).join('')}</div>
      <div class="seg"><label><input type="radio" name="filmLang" value="en" data-film-lang ${lang === 'en' ? 'checked' : ''}> English</label><label><input type="radio" name="filmLang" value="hi" data-film-lang ${lang === 'hi' ? 'checked' : ''}> हिन्दी</label></div>
    </div>
    <div class="film-frame"><video id="film" controls playsinline preload="metadata" poster="${VID + f.poster}" src="${VID + f[lang]}"></video></div>
    ${compact ? '' : `<div class="chapters">${f.chapters.map(([t, l]) => { const ts = Math.round(t * scale); return `<button class="chap" data-act="seek" data-t="${ts}"><span class="at">${Math.floor(ts / 60)}:${pad(ts % 60)}</span>${esc(l)}</button>`; }).join('')}</div>`}`;
}
RENDER.film = () => {
  const st = S.settings, T = totals();
  return `
  <section class="card film-card">
    <div class="card-h"><h2>🎬 ${esc(st.temple)} — the temple film</h2><span class="muted small">Play it during the 10-minute visit, or share it before you knock</span></div>
    ${filmPlayer()}
    <div class="row-actions" style="justify-content:flex-start;margin-top:10px">
      <button class="btn sm wa" data-act="shareFilm">💬 Share message on WhatsApp</button>
      <a class="btn sm" href="${VID + FILMS[UI.film][UI.filmLang]}" download>⬇ Download for WhatsApp</a>
    </div>
  </section>
  <section class="quote card"><div class="sk">यत्र नास्ति देवालयः, तत्र नास्ति धर्मः</div><div class="muted">"Where there is no temple, there is no dharma."</div></section>
  <div class="grid-2">
    <section class="card"><h2>What the film tells every family</h2><ul class="film-points">
      <li><b>One family.</b> 3,000+ residents across ${st.homes || 984} homes — every generation under one sky.</li>
      <li><b>A sacred space for every age.</b> Where little feet learn to fold in prayer, young hearts find stillness and elders sit in the evening light with Mahadev.</li>
      <li><b>Already happening.</b> Foundation ${st.foundationPct}% complete near the L–M–N–P towers; the Narmadeshwar Shivling has arrived; artisans in Rajasthan are carving the pink sandstone.</li>
      <li><b>Every festival, one family.</b> Ratha Yatra, Ganesh Chaturthi, Onam, Chhath, Rajyotsava — the temple becomes our home for all of them.</li>
      <li><b>Where we stand.</b> ${lakh(T.achieved)} received (${T.pct.toFixed(0)}%) — ${lakh(T.remaining)} more needed to bring the carved stone home.</li>
      <li><b>Prana Pratishtha on ${fmtLong(st.deadline)}.</b> “The temple does not belong to us. We belong to the temple.”</li>
    </ul></section>
    <section class="card"><h2>Choose your offering</h2><p class="muted small" style="margin-top:0">Give from ${inr(st.minDonation)} — or any amount your heart feels</p>
      <div class="tiers">${TIERS.map(t => `<span class="tier ${t === 51001 ? 'pop' : ''} ${t >= 131001 ? 'gold' : ''}">${inr(t)}${t === 51001 ? '<small>offered by many families</small>' : ''}</span>`).join('')}</div>
      <div class="callout info" style="margin-top:12px"><b>Scan · UPI · Cards</b> — HDFC UPI <b>${esc(st.upi)}</b> <button class="btn sm" data-act="copyUpi">Copy</button></div>
    </section>
  </div>
  <div class="grid-2">
    <section class="card"><div class="card-h"><h2>Dedicate a part of Mahadev's home</h2><button class="btn sm" data-act="goto" data-tab="seva">Book a seva →</button></div>
      <div class="offer-list">${(S.sevas || []).map(x => `<div><span>${esc(x.name)}${x.slots > 1 ? ` (${x.slots})` : ''}</span><b>${inr(x.amount)}${x.slots > 1 ? ' each' : ''}</b></div>`).join('')}</div>
      <p class="hint" style="margin-top:8px">Your name engraved in black stone · Highest donors: Main Yajman & Day 1–5 pooja, on the digital display</p></section>
    <section class="card"><h2>Deity sevas</h2><div class="rem-list">${(S.idols || []).map(x => `<div class="rem ${x.sponsor ? '' : 'overdue'}"><div><div class="who">${esc(x.name)}${x.amount ? ` · ${inr(x.amount)}` : ''}</div><div class="meta">${x.note ? esc(x.note) + ' · ' : ''}${x.sponsor ? `Sponsored by ${esc(x.sponsor)}` : 'Still open'}</div></div>${x.sponsor ? '<span class="badge good">Sponsored</span>' : '<span class="badge warn">Open</span>'}</div>`).join('')}</div></section>
  </div>
  <section class="card"><h2>Tan · Man · Dhan — every form of seva is the greatest support</h2><div class="flow">
    <div class="step"><b>तन · Your time</b>Volunteer at drives, festivals, events and construction days.</div>
    <div class="step"><b>मन · Your heart</b>Your prayers, your ideas, and spreading the word to every home.</div>
    <div class="step"><b>धन · Your offering</b>Any amount from ${inr(st.minDonation)} — every rupee becomes a brick of faith.</div>
  </div><p class="hint" style="margin-top:10px">Owners · Tenants · Every age · Every community — please reach out to the Temple Committee to volunteer.</p></section>`;
};

/* ---------- Seva & sponsors ---------- */
RENDER.seva = () => {
  const k = sevaStats(), st = S.settings;
  return `
  <section class="kpis">
    ${kpi('Temple-part slots booked', `${k.booked} / ${k.slots}`, `${lakh(k.bookedValue)} of ${lakh(k.value)}`)}
    ${kpi('Still open for sponsorship', lakh(k.value - k.bookedValue), `${k.slots - k.booked} slots`)}
    ${kpi('Idols sponsored', `${(S.idols || []).filter(x => x.sponsor).length} / ${(S.idols || []).length}`, '')}
    ${kpi('Family seva from', inr(st.minDonation), 'any amount welcome')}
  </section>
  <section class="card"><div class="card-h"><h2>Dedicate a part of Mahadev's home</h2><span class="muted small">${ADMIN ? 'Booking creates a pledge (or a collection if paid now) and frees up when cancelled' : 'To book a seva, WhatsApp ' + esc(st.auditName) + ' · ' + esc(fmtPhone(st.auditPhone))}</span></div>
    <div class="table-wrap"><table class="rtable"><thead><tr><th>Temple architectural seva</th><th class="r">Offering</th><th class="r">Slots</th><th>Sponsors</th><th></th></tr></thead><tbody>
    ${(S.sevas || []).map(x => {
      const left = x.slots - x.bookings.length;
      return `<tr><td data-label="Seva"><b>${esc(x.name)}</b></td><td class="r" data-label="Offering">${inr(x.amount)}${x.slots > 1 ? ' each' : ''}</td>
        <td class="r" data-label="Slots">${left ? `<span class="badge good">${left} of ${x.slots} open</span>` : '<span class="badge">Fully booked</span>'}</td>
        <td data-label="Sponsors"><div class="chips">${x.bookings.map(b => `<span class="chip vol">${esc(b.name)}${b.flat ? ` · ${esc(b.tower)} ${esc(b.flat)}` : ''} ${bookingPaid(b) ? '✓' : '⏳'}<button data-act="unbookSeva" data-seva="${x.id}" data-b="${b.id}" title="Cancel booking">×</button></span>`).join('') || '<span class="muted small">—</span>'}</div></td>
        <td data-label=""><div class="row-actions">${left ? `<button class="btn sm primary" data-act="bookSeva" data-seva="${x.id}">Book slot</button>` : ''}<button class="btn sm icon" data-act="editSeva" data-seva="${x.id}" title="Edit">✏️</button></div></td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="row-actions" style="justify-content:flex-start;margin-top:10px"><button class="btn sm" data-act="addSeva">+ Add seva item</button><button class="btn sm wa" data-act="shareSevas">💬 Share open slots</button></div>
  </section>
  <div class="grid-2">
    <section class="card"><h2>Deity sevas & sponsors</h2><div class="rem-list">${(S.idols || []).map(x => `<div class="rem"><div><div class="who">${esc(x.name)}${x.amount ? ` · ${inr(x.amount)}` : ''}</div><div class="meta">${x.note ? esc(x.note) + ' · ' : ''}${x.sponsor ? `Sponsored by <b>${esc(x.sponsor)}</b>` : 'Open for sponsorship — contact the Temple Committee'}</div></div>
      <div class="row-actions">${x.sponsor ? '<span class="badge good">Sponsored</span>' : '<span class="badge warn">Open</span>'}<button class="btn sm" data-act="setIdol" data-id="${x.id}">${x.sponsor ? 'Edit' : 'Assign sponsor'}</button></div></div>`).join('')}</div></section>
    <section class="card"><h2>Every offering is a seva</h2>
      <p style="margin-top:0"><b>Family seva tiers:</b></p><div class="chips">${TIERS.map(t => `<span class="chip">${inr(t)}${t === 100001 ? '+' : ''}</span>`).join('')}</div>
      <p><b>Tan • Man • Dhan</b> — time, prayers and sacred offerings are all seva.</p>
      <ul class="small" style="padding-left:18px;display:grid;gap:6px">
        <li><b>Black-stone donor plaque:</b> donor family names engraved permanently beside the temple.</li>
        <li><b>5-day Prana Pratishtha Yajmans:</b> top 5 contributors honoured as official Yajmans (highest = Day 1 Mukhya Yajman).</li>
        <li><b>Full accountability:</b> every rupee receipted and shared on the weekly ledger.</li>
      </ul>
      <div class="callout info"><b>HDFC UPI:</b> ${esc(st.upi)} <button class="btn sm" data-act="copyUpi">Copy</button><br><span class="small">GPay • PhonePe • Paytm • Cards • NetBanking — or pledge via your tower volunteer (30 Nov / salary day)</span></div>
    </section>
  </div>`;
};

/* ---------- Volunteers & drives ---------- */
function driveCard(d) {
  const t = today(), st = S.settings, dd = parseD(d.date);
  const vols = (d.volunteerIds || []).map(id => S.volunteers.find(v => v.id === id)).filter(Boolean);
  const need = Math.max(0, (+st.minVols || 0) - vols.length);
  const others = S.volunteers.filter(v => !(d.volunteerIds || []).includes(v.id));
  const wd = DAYS[dd.getDay()];
  return `<article class="drive">
    <div class="drive-date"><b>${dd.getDate()}</b><span>${dd.toLocaleDateString('en-IN', { month: 'short' })}</span><small>${wd}</small></div>
    <div class="drive-body">
      <div class="drive-h"><h3>${esc(d.time || 'Time TBD')}${d.meet ? ' · ' + esc(d.meet) : ''}</h3>
        ${d.date === t ? '<span class="badge accent">Today</span>' : ''}
        ${d.status === 'Done' ? '<span class="badge good">Done</span>' : need ? `<span class="badge warn">Need ${need} more volunteer${need > 1 ? 's' : ''}</span>` : '<span class="badge good">Fully staffed</span>'}</div>
      <div class="chips">${(d.towers || []).map(x => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="muted small">No towers selected</span>'}</div>
      <div class="small muted">Target ${inr(d.target)} · Collected ${inr(driveCollected(d))}${d.notes ? ' · ' + esc(d.notes) : ''}</div>
      <div class="chips">
        ${vols.map(v => `<span class="chip vol">🙋 ${esc(v.name)}<button data-act="unjoin" data-drive="${d.id}" data-vol="${v.id}" title="Remove" aria-label="Remove ${esc(v.name)}">×</button></span>`).join('')}
        ${others.length ? `<select data-join="${d.id}" aria-label="Add volunteer"><option value="">+ Add volunteer…</option>${others.map(v => `<option value="${v.id}">${esc(v.name)}${(v.avail || []).includes(wd) ? ' ✓ ' + wd : ''}</option>`).join('')}</select>` : ''}
      </div>
      <div class="row-actions" style="justify-content:flex-start">
        <button class="btn sm wa" data-act="shareDrive" data-id="${d.id}">💬 Share & ask to join</button>
        ${d.status !== 'Done' && d.date >= t ? `<button class="btn sm wa" data-act="remindDrive" data-id="${d.id}">🔔 30-min reminder</button><button class="btn sm" data-act="icsDrive" data-id="${d.id}">📅 Add to calendar</button>` : ''}
        ${d.status !== 'Done' ? `<button class="btn sm" data-act="driveDone" data-id="${d.id}">✓ Mark done</button>` : ''}
        <button class="btn sm icon" data-act="editDrive" data-id="${d.id}">✏️</button>
        <button class="btn sm icon danger" data-act="delDrive" data-id="${d.id}">🗑</button>
      </div>
    </div></article>`;
}
RENDER.volunteers = () => {
  const t = today(), wd = DAYS[parseD(t).getDay()];
  const upcoming = S.drives.filter(d => d.date >= t).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  const past = S.drives.filter(d => d.date < t).sort((a, b) => b.date.localeCompare(a.date));
  const inToday = new Set(S.drives.filter(d => d.date === t).flatMap(d => d.volunteerIds || []));
  const availToday = S.volunteers.filter(v => (v.avail || []).includes(wd) && !inToday.has(v.id));
  const short = upcoming.filter(d => (d.volunteerIds || []).length < (+S.settings.minVols || 0)).length;
  const collectedBy = n => sum(S.donations.filter(d => (d.collectedBy || '').trim().toLowerCase() === n.trim().toLowerCase()).map(d => d.amount));
  return `
  <div class="toolbar"><button class="btn primary" data-act="addDrive">+ Plan a drive</button><button class="btn" data-act="addVolunteer">+ Add volunteer</button><button class="btn" data-act="icsAll">📅 All drives to calendar</button></div>
  ${driveAlert()}
  ${doorStatus()}
  <section class="kpis">
    ${kpi('Volunteers', S.volunteers.length, `${availToday.length + inToday.size} available today`)}
    ${kpi('Upcoming drives', upcoming.length, `${upcoming.filter(d => d.date === t).length} today`)}
    ${kpi('Drives short of volunteers', short, `minimum ${S.settings.minVols} per drive`, short ? 'warn' : '')}
    ${kpi('Drives done', S.drives.filter(d => d.status === 'Done').length, '')}
  </section>
  <section class="card"><div class="card-h"><h2>Upcoming drives — join one!</h2><span class="muted small">✓ in the dropdown = volunteer is usually free that day</span></div>
    ${upcoming.length ? upcoming.map(driveCard).join('') : empty('No drives planned yet. Tap <b>+ Plan a drive</b>.')}
  </section>
  ${availToday.length ? `<section class="card"><h2>Free today (${wd}) but not in a drive</h2><div class="chips">
    ${availToday.map(v => `<span class="chip">${esc(v.name)} ${v.phone ? `<button data-act="inviteVol" data-id="${v.id}" title="Invite on WhatsApp">💬</button>` : ''}</span>`).join('')}</div></section>` : ''}
  <section class="card"><div class="card-h"><h2>Volunteer directory (${S.volunteers.length})</h2></div>
    ${S.volunteers.length ? `<div class="table-wrap"><table class="rtable"><thead><tr><th>Name</th><th>Phone</th><th>Lives in</th><th>Role</th><th>Free on</th><th>Assigned towers</th><th class="r">Drives</th><th class="r">Collected</th><th></th></tr></thead><tbody>
    ${S.volunteers.map(v => `<tr>
      <td data-label="Name"><b>${esc(v.name)}</b>${v.slot ? `<div class="small muted">${esc(v.slot)}</div>` : ''}</td>
      <td data-label="Phone">${esc(v.phone || '—')}</td>
      <td data-label="Lives in">${esc(v.tower || '')} ${esc(v.flat || '')}</td>
      <td data-label="Role"><span class="badge accent">${esc(v.role || 'Volunteer')}</span></td>
      <td data-label="Free on">${(v.avail || []).length === 7 ? 'All days' : (v.avail || []).join(', ') || '—'}</td>
      <td data-label="Assigned towers">${(v.towers || []).map(esc).join(', ') || '—'}</td>
      <td class="r" data-label="Drives">${S.drives.filter(d => (d.volunteerIds || []).includes(v.id)).length}</td>
      <td class="r" data-label="Collected">${inr(collectedBy(v.name))}</td>
      <td data-label=""><div class="row-actions">${v.phone ? `<button class="btn sm wa" data-act="inviteVol" data-id="${v.id}" title="WhatsApp">💬</button>` : ''}
        <button class="btn sm icon" data-act="editVolunteer" data-id="${v.id}">✏️</button><button class="btn sm icon danger" data-act="delVolunteer" data-id="${v.id}">🗑</button></div></td></tr>`).join('')}
    </tbody></table></div>` : empty('No volunteers added yet.')}
  </section>
  ${past.length ? `<details class="card"><summary>Past drives (${past.length})</summary>${past.map(driveCard).join('')}</details>` : ''}`;
};

/* ---------- Polls ---------- */
function pollCard(p) {
  const total = p.votes.length;
  const counts = p.options.map(o => p.votes.filter(v => v.optionId === o.id).length);
  const top = Math.max(0, ...counts);
  return `<section class="card poll">
    <div class="card-h" style="margin:0"><span class="badge accent">${esc(p.audience)}</span>${p.closed ? '<span class="badge">Closed</span>' : '<span class="badge good">Open</span>'}</div>
    <div class="poll-q">${esc(p.question)}</div>
    ${p.options.map((o, i) => `<div class="opt ${counts[i] && counts[i] === top ? 'lead' : ''}">
      <div class="opt-h"><span>${esc(o.text)}</span><span class="cnt">${counts[i]} · ${pctOf(counts[i], total).toFixed(0)}%
        <button class="btn sm wa" data-act="pollRemind" data-poll="${p.id}" data-opt="${o.id}" ${counts[i] ? '' : 'disabled'} title="Send reminder to these voters">💬 Remind</button></span></div>
      <div class="pbar"><span style="width:${pctOf(counts[i], total)}%"></span></div></div>`).join('')}
    <div class="small muted">${total} vote${total === 1 ? '' : 's'}</div>
    <div class="row-actions" style="justify-content:flex-start">
      ${p.closed ? '' : `<button class="btn sm primary" data-act="addVote" data-poll="${p.id}">+ Record vote</button>`}
      <button class="btn sm wa" data-act="sharePoll" data-poll="${p.id}">Share in group</button>
      <button class="btn sm" data-act="pollVoters" data-poll="${p.id}">Voters</button>
      <button class="btn sm ghost" data-act="togglePoll" data-poll="${p.id}">${p.closed ? 'Reopen' : 'Close'}</button>
      <button class="btn sm icon" data-act="editPoll" data-poll="${p.id}">✏️</button>
      <button class="btn sm icon danger" data-act="delPoll" data-poll="${p.id}">🗑</button>
    </div></section>`;
}
RENDER.polls = () => `
  <div class="toolbar"><button class="btn primary" data-act="addPoll">+ New poll</button>
    <span class="muted small">Share a poll in the society WhatsApp group, record replies here, then send a reminder to everyone who picked an option.</span></div>
  ${S.polls.length ? `<div class="grid-cards">${S.polls.map(pollCard).join('')}</div>` : empty('No polls yet.')}`;

/* ---------- Weekly plan ---------- */
RENDER.plan = () => {
  const st = S.settings, T = totals(), W = weeksData(), t = today();
  const assigned = new Set(W.flatMap(w => w.towers)), ts = towerStats();
  const unplanned = st.towers.filter(x => !assigned.has(x) && !ts[x]?.count);
  const days = []; for (let d = t; d <= st.deadline; d = addDays(d, 1)) days.push(d);
  return `
  <div class="toolbar"><button class="btn primary" data-act="autoPlan">✨ Auto-plan weeks</button>
    <button class="btn wa" data-act="shareLedger">💬 Share weekly ledger</button>
    <button class="btn" data-act="addDrive">+ Plan a drive</button>
    <span class="muted small">Auto-plan splits the remaining amount by days and spreads towers (least-covered first) across the weeks.</span></div>
  <section class="kpis">
    ${kpi('Remaining to raise', lakh(T.remaining), `${T.daysLeft} days · ${inr(T.perDay)}/day`)}
    ${kpi('Weeks left', W.length, W.length ? `${fmtD(W[0].start)} → ${fmtD(st.deadline)}` : '')}
    ${kpi('Towers not yet planned', unplanned.length, unplanned.length ? 'and no collection yet' : 'all covered 👍', unplanned.length ? 'warn' : 'good')}
    ${kpi('Drives planned ahead', S.drives.filter(d => d.date >= t).length, '')}
  </section>
  ${W.length ? `<div class="grid-cards">${W.map(w => {
    const gap = w.target - w.achieved, p = pctOf(w.achieved, w.target);
    return `<section class="card week ${w.current ? 'current' : ''}">
      <div class="week-h"><h2>${fmtD(w.start)} – ${fmtD(w.end)}</h2>${w.current ? '<span class="badge accent">This week</span>' : w.end < t ? '<span class="badge">Past</span>' : ''}</div>
      <div class="week-nums">
        <div><b>${inr(w.target)}</b><span>target${w.custom ? '' : ' (suggested)'}</span></div>
        <div><b>${inr(w.achieved)}</b><span>achieved</span></div>
        <div><b style="color:var(${gap > 0 ? '--warn' : '--good'})">${gap > 0 ? inr(gap) : '✓ met'}</b><span>${gap > 0 ? 'gap' : ''}</span></div>
      </div>
      <div class="pbar ${p >= 100 ? 'good' : ''}"><span style="width:${p}%"></span></div>
      <div class="small muted">${w.days} days · ${inr(w.target / w.days)}/day · ${Math.ceil(Math.max(0, gap) / Math.max(1, st.minDonation))} families at ${inr(st.minDonation)}</div>
      <div><div class="small muted" style="margin-bottom:4px">Towers to cover</div><div class="chips">${w.towers.map(x => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="muted small">None assigned</span>'}</div></div>
      <div class="small">Drives planned: <b>${w.drives.length}</b>${w.drives.length ? ' — ' + w.drives.map(d => fmtWD(d.date)).join(', ') : ''}</div>
      <label>Focus / notes<textarea rows="2" data-week-note="${w.start}" placeholder="e.g. Cover A & B wings, follow up pledges">${esc(w.notes)}</textarea></label>
      <div class="row-actions" style="justify-content:flex-start"><button class="btn sm" data-act="editWeek" data-week="${w.start}">✏️ Edit target & towers</button></div>
    </section>`;
  }).join('')}</div>` : empty('The deadline has passed. Update it in Settings.')}
  <section class="card"><div class="card-h"><h2>Day-by-day plan</h2><span class="muted small">Needed/day is recalculated from what's still remaining</span></div>
    <div class="table-wrap"><table class="rtable"><thead><tr><th>Day</th><th>Drives & towers</th><th class="r">Volunteers</th><th class="r">Target</th><th class="r">Collected</th><th></th></tr></thead><tbody>
    ${days.map(d => {
      const ds = S.drives.filter(x => x.date === d), col = sumRange(d, d), tgt = sum(ds.map(x => x.target)) || T.perDay;
      return `<tr><td data-label="Day"><b>${fmtWD(d)}</b>${d === t ? ' <span class="badge accent">Today</span>' : ''}${d === st.deadline ? ' <span class="badge bad">Deadline</span>' : ''}</td>
        <td data-label="Drives & towers">${ds.length ? ds.map(x => `${esc(x.time || '')} — ${(x.towers || []).map(esc).join(', ') || 'towers TBD'}`).join('<br>') : '<span class="muted">No drive yet</span>'}</td>
        <td class="r" data-label="Volunteers">${sum(ds.map(x => (x.volunteerIds || []).length))}</td>
        <td class="r" data-label="Target">${inr(tgt)}</td>
        <td class="r" data-label="Collected">${col ? `<b>${inr(col)}</b>` : '—'}</td>
        <td data-label=""><div class="row-actions">${ds.length ? '' : `<button class="btn sm" data-act="addDrive" data-date="${d}">+ Drive</button>`}</div></td></tr>`;
    }).join('')}
    </tbody></table></div>
  </section>`;
};

/* ---------- Script & presentation ---------- */
const scriptTpl = () => UI.lang === 'hi' ? (S.settings.scriptHi || DEFAULT_SCRIPT_HI) : (S.settings.scriptEn || DEFAULT_SCRIPT_EN);
const timerHTML = k => `<div class="timer" data-timer="${k}"><div class="t-time">0:00</div><div class="pbar"><span style="width:0"></span></div>
  <button class="btn sm primary" data-act="timerToggle" data-k="${k}">▶ Start</button><button class="btn sm ghost" data-act="timerReset" data-k="${k}">Reset</button></div>`;
function ytEmbed(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
const AUDIO = { en: { file: 'assets/audio/visit-script-en.m4a', label: 'English · 1:46' }, hi: { file: 'assets/audio/visit-script-hi.m4a', label: 'हिन्दी · 1:57' } };
function scriptAudio() {
  const a = AUDIO[UI.lang] || AUDIO.en;
  return `<div class="audio-box"><div class="small"><b>🔊 Listen to the script</b> <span class="muted">(${a.label}): practise before a visit, or play it at the door</span></div>
    <audio controls preload="none" src="${a.file}"></audio>
    <div class="row-actions"><button class="btn sm wa" data-act="shareAudio">📤 Share audio on WhatsApp</button><a class="btn sm" href="${a.file}" download>⬇ Download</a></div></div>`;
}
RENDER.script = () => {
  const st = S.settings, pr = S.presentation;
  const mapQ = st.mapQuery || st.address;
  const yt = st.videoUrl && ytEmbed(st.videoUrl);
  let video;
  if (!pr.videoFileId && !st.videoUrl) video = filmPlayer(true);
  else if (pr.videoFileId) video = `<div class="media-frame"><video controls playsinline data-file="${pr.videoFileId}"></video></div><div class="row-actions" style="margin-top:8px"><button class="btn sm danger" data-act="delVideo">Remove video</button></div>`;
  else if (yt) video = `<div class="media-frame"><iframe src="${yt}" title="Temple video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  else if (st.videoUrl) video = `<p><a class="btn" href="${esc(st.videoUrl)}" target="_blank" rel="noopener">▶ Open temple video</a></p>`;
  else if (false) video = `<div class="media-frame"><img src="${EV}video-still.jpg" alt="Temple video still" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55"></div>
    <label class="dropzone" style="margin-top:8px">🎬 <strong>Upload the temple video (3:14)</strong><br><span class="small">or paste a YouTube / Drive link in Settings</span><input type="file" accept="video/*" hidden data-upload="video"></label>`;
  return `
  <section class="card"><h2>Every visit in 3 steps</h2><div class="flow">
    <div class="step"><b>1 · Introduce (2 min)</b>Greet, read the script below, share current progress and the suggested ${inr(st.minDonation)}.</div>
    <div class="step"><b>2 · Show evidence (10 min, only if they have time)</b>Site & bhoomi pujan photos → seva options → location → temple video.</div>
    <div class="step"><b>3 · Record immediately</b>Collection, pledge or "visit later" — log it in the app and upload the receipt photo.</div>
  </div></section>
  <div class="grid-2">
    <section class="card">
      <div class="card-h"><h2>2-minute introduction</h2>
        <div class="seg"><label><input type="radio" name="lang" value="en" data-lang ${UI.lang === 'en' ? 'checked' : ''}> English</label><label><input type="radio" name="lang" value="hi" data-lang ${UI.lang === 'hi' ? 'checked' : ''}> हिन्दी</label></div></div>
      ${timerHTML('script')}
      ${scriptAudio()}
      <div class="script">${esc(fillTpl(scriptTpl())).replace(/\n/g, '<br>')}</div>
      <div class="row-actions" style="margin-top:10px"><button class="btn sm" data-act="copyScript">Copy</button><button class="btn sm wa" data-act="shareScript">Share with volunteers</button><button class="btn sm" data-act="editScript">✏️ Edit script</button></div>
      <p class="hint" style="margin-top:8px">Numbers (achieved, remaining, days left) update automatically from the dashboard.</p>
    </section>
    <section class="card guidelines"><h2>Ground rules for every visit</h2><ul>
      <li><b>Purely voluntary</b> — no force, no pressure, no follow-up if someone says no. Thank them and move on politely.</li>
      <li>We approach <b>Hindu families only</b>, and only those who <b>wish to donate</b>.</li>
      <li>Keep the introduction to <b>2 minutes</b>; offer the 10-minute presentation only if they're interested.</li>
      <li>Suggested contribution: <b>${inr(st.minDonation)} or more</b> per family — any amount given with devotion is welcome.</li>
      <li>Accept <b>HDFC UPI${st.upi ? ` (${esc(st.upi)})` : ''}</b> or <b>cash</b>. Always issue a receipt and photograph it.</li>
      <li>Offer the <b>seva options</b>: family tiers from ${inr(st.minDonation)}, temple-part sponsorship (pillar, main door…) and open idols (see the Seva tab).</li>
      <li>If they wish to give later, record a <b>pledge</b> with a reminder date — the app will remind you.</li>
      <li>Visit in pairs, wear the seva ID, respect "do not disturb" timings.</li>
    </ul></section>
  </div>
  <section class="card"><div class="card-h"><h2>10-minute presentation</h2><span class="muted small">Start the timer when you begin — the current segment is highlighted</span></div>
    ${timerHTML('pres')}
    <ol class="agenda">${AGENDA.map((a, i) => `<li data-seg="${i}"><span class="at">${a.t}</span><span>${a.label}</span></li>`).join('')}</ol>
  </section>
  <div class="grid-2">
    <section class="card"><h2>Project & funding status</h2><div class="stack" style="gap:10px">
      ${[['Foundation completed', st.foundationPct], ['Overall temple built', st.builtPct], [`Funds received (${lakh(totals().achieved)} of ${lakh(st.target)})`, totals().pct]].filter(x => x[1] != null && x[1] !== '').map(([l, v]) => `<div class="opt"><div class="opt-h"><span>${l}</span><b>${(+v).toFixed(0)}%</b></div><div class="pbar ${+v >= 100 ? 'good' : ''}"><span style="width:${pctOf(+v, 100)}%"></span></div></div>`).join('')}
    </div></section>
    <section class="card"><h2>Road to 15 December</h2><ol class="road">${ROADMAP.map(([t, d], i) => `<li><span class="n">0${i + 1}</span><span><b>${t}</b><small>${d}</small></span></li>`).join('')}</ol></section>
  </div>
  <section class="card"><div class="card-h"><h2>Progress evidence</h2><button class="btn sm primary" data-act="slideshow">▶ Slideshow (${evidenceItems().length})</button></div>
    ${(() => { let k = 0; return EVIDENCE.map(([group, list]) => `<h3 style="margin:14px 0 8px">${group}</h3><div class="gallery">${list.map(([f, cap]) => { const i = k++; return `<figure><button type="button" class="thumb" data-act="slideshow" data-i="${i}"><img src="${EV + f}" alt="${esc(cap)}" loading="lazy"></button><figcaption class="small muted">${esc(cap)}</figcaption></figure>`; }).join('')}</div>`).join(''); })()}
  </section>
  <section class="card"><div class="card-h"><h2>More photos you added (${pr.photos.length})</h2>
    <div class="row-actions"><label class="btn sm">+ Add photos<input type="file" accept="image/*" multiple hidden data-upload="photos"></label></div></div>
    ${pr.photos.length ? `<div class="gallery">${pr.photos.map((ph, i) => `<figure>
      <button type="button" class="thumb" data-act="slideshow" data-i="${EVIDENCE.reduce((n, g) => n + g[1].length, 0) + i}"><span data-file="${ph.id}"></span></button>
      <input value="${esc(ph.caption || '')}" placeholder="Caption (e.g. Foundation – Oct)" data-caption="${ph.id}" aria-label="Caption">
      <button class="btn sm ghost danger" data-act="delPhoto" data-id="${ph.id}">Remove</button></figure>`).join('')}</div>`
      : `<label class="dropzone">🖼️ <strong>Add new photos</strong><br><span class="small">Rajasthan stone carving, dispatch, crane, erection progress…</span><input type="file" accept="image/*" multiple hidden data-upload="photos"></label>`}
  </section>
  <div class="grid-2">
    <section class="card"><div class="card-h"><h2>Temple location</h2>${mapQ ? `<a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQ)}">Open in Maps ↗</a>` : ''}</div>
      ${st.address ? `<p style="margin-top:0">${esc(st.address)}</p>` : ''}
      ${mapQ ? `<div class="media-frame"><iframe loading="lazy" title="Temple location map" src="https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&output=embed"></iframe></div>`
        : empty('Add the temple address or map pin in <button class="btn sm" data-act="goto" data-tab="settings">Settings</button>')}
    </section>
    <section class="card"><h2>Video of the expected temple</h2>${video}</section>
  </div>`;
};

/* ---------- Settings ---------- */
RENDER.settings = () => {
  const st = S.settings;
  const f = (name, label, type = 'text', extra = '') => `<label>${label}<input type="${type}" name="${name}" value="${esc(st[name])}" ${extra}></label>`;
  return `
  <form class="card form" data-form="settings">
    <h2>Drive settings</h2>
    <div class="grid2">
      ${f('society', 'Society name', 'text', 'required')}
      ${f('temple', 'Temple name', 'text', 'required')}
      ${f('target', 'Total budget / target (₹)', 'number', 'min="0" step="1000" required')}
      ${f('opening', 'Already collected before this drive (₹)', 'number', 'min="0" step="1"')}
      ${f('deadline', 'Collection deadline', 'date', 'required')}
      ${f('minDonation', 'Suggested minimum donation (₹)', 'number', 'min="0" step="1"')}
      ${f('minVols', 'Minimum volunteers per drive', 'number', 'min="0" step="1"')}
      ${f('homes', 'Homes in the society', 'number', 'min="0" step="1"')}
      ${f('foundationPct', 'Foundation completed (%)', 'number', 'min="0" max="100"')}
      ${f('builtPct', 'Overall temple built (%)', 'number', 'min="0" max="100"')}
      ${f('upi', 'Society UPI ID (shown in script & reminders)')}
      ${f('coordName', 'Coordinator name (signs reminders)')}
      ${f('coordPhone', 'Coordinator phone', 'tel')}
      <label class="span2">Towers (one per line — ${st.towers.length} now). Renaming a tower does not update entries already saved under its old name.<textarea name="towers" rows="5">${esc(st.towers.join('\n'))}</textarea></label>
      ${f('address', 'Temple address (shown in presentation)')}
      ${f('mapQuery', 'Map search / pin (e.g. society name + city, or lat,long)')}
      <label class="span2">Temple video link (YouTube / Drive) — or upload a file in the Visit Script tab<input name="videoUrl" value="${esc(st.videoUrl)}"></label>
      <label class="span2">Pledge reminder message<textarea name="reminderTpl" rows="5">${esc(st.reminderTpl)}</textarea></label>
      <label class="span2">Thank-you message<textarea name="thanksTpl" rows="3">${esc(st.thanksTpl)}</textarea></label>
    </div>
    <p class="hint">Placeholders you can use in messages: {name} {amount} {society} {temple} {target} {achieved} {remaining} {pct} {deadline} {daysLeft} {min} {upi} {coord} {homes} {builtPct}</p>
    <div class="actions"><button class="btn primary">Save settings</button></div>
  </form>
  <section class="card"><h2>Data & backup</h2>
    <p class="hint" style="margin-bottom:12px">All data is saved in <b>this browser on this device</b>. Download a backup regularly and share it with the co-ordinator, who can import it on their device.</p>
    <div class="toolbar">
      <button class="btn primary" data-act="exportBackup">⬇ Download full backup (with photos)</button>
      <label class="btn">⬆ Import backup<input type="file" accept="application/json,.json" hidden data-import></label>
      <button class="btn" data-act="exportCSV">⬇ Collections CSV</button>
      <button class="btn" data-act="exportPledgesCSV">⬇ Pledges CSV</button>
      <span class="spacer"></span>
      <button class="btn ghost" data-act="demo">Load demo data</button>
      <button class="btn ghost danger" data-act="reset">Reset everything</button>
    </div>
  </section>`;
};

/* =========================================================================
   FORMS (modal)
   ========================================================================= */
const modal = () => $('#modal');
function openModal(html, wide = false) {
  $('#modal-body').innerHTML = html;
  modal().classList.toggle('wide', wide);
  if (!modal().open) modal().showModal();
  hydrate($('#modal-body'));
  renderPending();
  const first = $('#modal-body input:not([type=hidden]):not([type=radio]):not([type=checkbox]), #modal-body select');
  if (first && !wide) setTimeout(() => first.focus(), 30);
}
function closeModal() { if (modal().open) modal().close(); }
const cancelSave = (label = 'Save') => `<div class="actions"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary">${label}</button></div>`;
const radios = (name, opts, sel) => `<div class="seg">${opts.map(o => `<label><input type="radio" name="${name}" value="${esc(o)}" ${o === sel ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
const checks = (name, opts, sel = [], labelFn = x => x, valFn = x => x) => `<div class="checks">${opts.map(o => `<label><input type="checkbox" name="${name}" value="${esc(valFn(o))}" ${sel.includes(valFn(o)) ? 'checked' : ''}> ${esc(labelFn(o))}</label>`).join('')}</div>`;

function renderPending() {
  const el = $('#pending'); if (!el) return;
  pending.urls.forEach(u => URL.revokeObjectURL(u)); pending.urls = [];
  el.innerHTML = pending.keep.map((id, i) => `<span class="thumb"><span data-file="${id}"></span><button type="button" class="x" data-act="rmKeep" data-i="${i}" aria-label="Remove">×</button></span>`).join('') +
    pending.files.map((f, i) => {
      const u = URL.createObjectURL(f); pending.urls.push(u);
      return `<span class="thumb">${f.type.startsWith('image/') ? `<img src="${u}" alt="">` : `<span class="filechip">📄 ${esc(f.name)}</span>`}<button type="button" class="x" data-act="rmPending" data-i="${i}" aria-label="Remove">×</button></span>`;
    }).join('');
  hydrate(el);
}
function addPending(files) {
  const ok = [...files].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
  if (!ok.length) return toast('Only images or PDFs can be attached');
  pending.files.push(...ok); renderPending(); toast(`${ok.length} file${ok.length > 1 ? 's' : ''} attached`);
}

function donationForm(d = {}) {
  const st = S.settings;
  resetPending(d.receiptIds || []);
  const status = d.status || 'Full';
  openModal(`<form class="form" data-form="donation">
    <h3>${d.id ? 'Edit collection' : d.pledgeId ? 'Record pledge payment' : 'Add collection'}</h3>
    <input type="hidden" name="id" value="${esc(d.id || '')}"><input type="hidden" name="pledgeId" value="${esc(d.pledgeId || '')}">
    <div class="grid2">
      <label>Date<input type="date" name="date" required value="${esc(d.date || today())}"></label>
      <label>Amount received (₹)<input type="number" name="amount" min="1" step="1" required inputmode="numeric" value="${esc(d.amount || '')}" placeholder="${st.minDonation}"></label>
      <label class="span2">Donor name<input name="donor" required value="${esc(d.donor || '')}" autocomplete="off"></label>
      <label>Tower<select name="tower" required>${towerOpts(d.tower)}</select></label>
      <label>Flat no.<input name="flat" required value="${esc(d.flat || '')}" placeholder="e.g. 082"></label>
      <fieldset class="span2"><legend>Resident</legend>${radios('occupancy', ['Owner', 'Tenant'], d.occupancy || '')}</fieldset>
      <label>Phone (WhatsApp)<input name="phone" type="tel" inputmode="tel" value="${esc(d.phone || '')}"></label>
      <label>Collected by<input name="collectedBy" list="vol-list" value="${esc(d.collectedBy || '')}" placeholder="Volunteer name"></label>
    </div>
    <div class="chips">${TIERS.map(t => `<button type="button" class="chip" data-act="setAmt" data-v="${t}">${inr(t)}</button>`).join('')}</div>
    <fieldset><legend>Paid</legend>${radios('status', ['Full', 'Part'], status)}
      <div class="grid2" data-part ${status === 'Part' ? '' : 'hidden'}>
        <label>Total amount committed (₹)<input type="number" name="committed" min="0" step="1" value="${esc(d.committed || '')}" placeholder="e.g. 11000"></label>
        <label>Remind for balance on<input type="date" name="reminderDate" value="${esc(d.reminderDate || addDays(today(), 7))}"></label>
        <p class="hint span2">The balance is saved automatically as a pledge with this reminder date.</p>
      </div>
    </fieldset>
    <fieldset><legend>Mode</legend>${radios('mode', MODES, d.mode || 'UPI')}
      <label>UPI txn ID / receipt book no.<input name="ref" value="${esc(d.ref || '')}"></label>
      <div class="grid2"><label>Cash held by <span class="muted small">(cash only)</span><input name="cashWith" list="vol-list" value="${esc(d.cashWith || '')}" placeholder="Who has the cash now"></label>
      <label>Deposited to temple account on <span class="muted small">(cash only)</span><input type="date" name="depositedOn" value="${esc(d.depositedOn || '')}"></label></div></fieldset>
    <label>Notes<textarea name="notes" rows="2">${esc(d.notes || '')}</textarea></label>
    ${dropzone('Attach receipt(s)')}
    ${cancelSave()}
  </form>`);
}
function pledgeForm(p = {}) {
  openModal(`<form class="form" data-form="pledge">
    <h3>${p.id ? 'Edit pledge' : 'Add pledge (pay later)'}</h3>
    <input type="hidden" name="id" value="${esc(p.id || '')}">
    <div class="grid2">
      <label class="span2">Donor name<input name="donor" required value="${esc(p.donor || '')}"></label>
      <label>Tower<select name="tower" required>${towerOpts(p.tower)}</select></label>
      <label>Flat no.<input name="flat" required value="${esc(p.flat || '')}"></label>
      <label>Phone (WhatsApp)<input name="phone" type="tel" value="${esc(p.phone || '')}"></label>
      <label>Pledged amount (₹)<input type="number" name="amount" min="1" step="1" required value="${esc(p.amount || S.settings.minDonation)}"></label>
      <label>Will pay by<input type="date" name="dueDate" value="${esc(p.dueDate || addDays(today(), 7))}"></label>
      <label>Next reminder on<input type="date" name="reminderDate" value="${esc(p.reminderDate || addDays(today(), 5))}"></label>
      ${p.id ? `<label>Already paid (₹)<input type="number" name="paid" min="0" step="1" value="${esc(p.paid || 0)}"></label>` : ''}
      <label>Preferred mode<select name="mode">${MODES.map(m => `<option ${m === (p.mode || 'UPI') ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      ${p.id ? `<label>Status<select name="status">${['Pending', 'Fulfilled', 'Cancelled'].map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
      <label class="span2">Notes<textarea name="notes" rows="2">${esc(p.notes || '')}</textarea></label>
    </div>${cancelSave()}</form>`);
}
function volunteerForm(v = {}) {
  openModal(`<form class="form" data-form="volunteer">
    <h3>${v.id ? 'Edit volunteer' : 'Add volunteer'}</h3><input type="hidden" name="id" value="${esc(v.id || '')}">
    <div class="grid2">
      <label class="span2">Name<input name="name" required value="${esc(v.name || '')}"></label>
      <label>Phone (WhatsApp)<input name="phone" type="tel" value="${esc(v.phone || '')}"></label>
      <label>Role<select name="role">${ROLES.map(r => `<option ${r === (v.role || 'Volunteer') ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label>Lives in tower<select name="tower">${towerOpts(v.tower)}</select></label>
      <label>Flat no.<input name="flat" value="${esc(v.flat || '')}"></label>
      <label class="span2">Preferred time<input name="slot" value="${esc(v.slot || '')}" placeholder="e.g. Evenings after 7 PM, weekend mornings"></label>
    </div>
    <fieldset><legend>Usually free on</legend>${checks('avail', DAYS, v.avail || [])}</fieldset>
    <fieldset><legend>Assigned towers</legend>${checks('vtowers', S.settings.towers, v.towers || [])}</fieldset>
    <label>Notes<textarea name="notes" rows="2">${esc(v.notes || '')}</textarea></label>
    ${cancelSave()}</form>`);
}
function driveForm(d = {}) {
  const date = d.date || today();
  openModal(`<form class="form" data-form="drive">
    <h3>${d.id ? 'Edit drive' : 'Plan a drive'}</h3><input type="hidden" name="id" value="${esc(d.id || '')}">
    <div class="grid2">
      <label>Date<input type="date" name="date" required value="${esc(date)}"></label>
      <label>Time<input name="time" value="${esc(d.time || '7:00 PM – 9:00 PM')}"></label>
      <label>Meeting point<input name="meet" value="${esc(d.meet || '')}" placeholder="e.g. Clubhouse gate"></label>
      <label>Target (₹)<input type="number" name="target" min="0" step="1" value="${esc(d.target ?? Math.round(totals().perDay / 100) * 100)}"></label>
      ${d.id ? `<label>Status<select name="status">${['Planned', 'Done'].map(s => `<option ${s === (d.status || 'Planned') ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
    </div>
    <fieldset><legend>Towers to cover</legend>${checks('towers', S.settings.towers, d.towers || [])}</fieldset>
    <fieldset><legend>Volunteers (✓ = usually free that weekday)</legend>
      ${S.volunteers.length ? checks('vols', S.volunteers, d.volunteerIds || [], v => `${v.name}${(v.avail || []).includes(DAYS[parseD(date).getDay()]) ? ' ✓' : ''}`, v => v.id) : '<p class="hint">Add volunteers first — or share the drive in WhatsApp and add them as they join.</p>'}
    </fieldset>
    <label>Notes<textarea name="notes" rows="2">${esc(d.notes || '')}</textarea></label>
    ${cancelSave()}</form>`);
}
function pollForm(p = {}) {
  openModal(`<form class="form" data-form="poll">
    <h3>${p.id ? 'Edit poll' : 'New poll'}</h3><input type="hidden" name="id" value="${esc(p.id || '')}">
    <label>Question<input name="question" required value="${esc(p.question || '')}" placeholder="e.g. When can we visit you?"></label>
    <label>Audience<select name="audience">${['Residents', 'Volunteers'].map(a => `<option ${a === p.audience ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <label>Options (one per line)<textarea name="options" rows="5" required>${esc((p.options || []).map(o => o.text).join('\n'))}</textarea></label>
    ${p.id ? '<p class="hint">Renaming an option keeps its votes; removing an option deletes its votes.</p>' : ''}
    <label>Reminder message for voters<textarea name="reminderTpl" rows="3">${esc(p.reminderTpl || 'Jai Shri Ram 🙏 {name} ji, as per your choice "{option}" — gentle reminder from the {temple} seva team. Thank you!')}</textarea></label>
    <p class="hint">Use {name} {option} {question} and any dashboard placeholder like {achieved} {deadline}.</p>
    ${cancelSave()}</form>`);
}
function voteForm(p) {
  openModal(`<form class="form" data-form="vote"><h3>Record vote</h3><p class="muted" style="margin:0">${esc(p.question)}</p>
    <input type="hidden" name="poll" value="${p.id}">
    <fieldset><legend>Choice</legend><div class="seg">${p.options.map((o, i) => `<label><input type="radio" name="optionId" value="${o.id}" ${i === 0 ? 'checked' : ''}> ${esc(o.text)}</label>`).join('')}</div></fieldset>
    <div class="grid2">
      <label class="span2">Name<input name="name" required></label>
      <label>Phone (WhatsApp)<input name="phone" type="tel"></label>
      <label>Tower<select name="tower">${towerOpts('')}</select></label>
      <label>Flat no.<input name="flat"></label>
    </div>
    <div class="actions"><button type="button" class="btn ghost" data-act="closeModal">Done</button><button class="btn" name="again" value="1">Save & add another</button><button class="btn primary">Save</button></div></form>`);
}

const FORMS = {
  adminLogin: async (v, form) => {
    let h = ''; try { h = await sha256('dlfmahadev:' + String(v.pin || '').trim()); } catch { return toast('Login needs the https site link'); }
    if (h !== ADMIN_HASH) { form.pin.value = ''; form.pin.focus(); return toast('Wrong PIN'); }
    ADMIN = true; try { localStorage.setItem(ADMIN_KEY, h); } catch {}
    closeModal(); render(); toast('Admin view on — remembered on this phone');
  },
  async selfDonate(fd) {
    const amount = Math.round(+fd.amount);
    if (!(amount > 0)) return toast('Enter the amount you paid');
    if (!fd.occupancy) return toast('Please choose Owner or Tenant');
    if (String(fd.phone).replace(/\D/g, '').length < 10) return toast('Enter your 10-digit mobile number');
    if (fd.mode !== 'Cash to volunteer' && !pending.files.length) return toast('Please upload the payment screenshot 📎');
    const files = [...pending.files];
    const ids = await storeFiles(files);
    const rec = { id: uid(), created: Date.now(), date: today(), donor: fd.donor.trim(), tower: fd.tower, flat: fd.flat.trim(), occupancy: fd.occupancy,
      phone: fd.phone.trim(), amount, mode: fd.mode, ref: (fd.ref || '').trim(), receiptIds: ids };
    (S.submissions ||= []).push(rec); save();
    UI.lastSub = rec;
    UI.lastShare = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf').map((f, i) => f instanceof File ? f : new File([f], `receipt-${i + 1}.jpg`, { type: f.type || 'image/jpeg' }));
    thanksScreen(rec);
  },
  async donation(fd) {
    const amount = Math.round(+fd.amount);
    if (!(amount > 0)) return toast('Enter the amount received');
    const btn = $('#modal-body button.primary'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    const newIds = await storeFiles(pending.files);
    let d = fd.id ? S.donations.find(x => x.id === fd.id) : null;
    if (d) delFiles((d.receiptIds || []).filter(id => !pending.keep.includes(id)));
    const rec = {
      date: fd.date, donor: fd.donor.trim(), phone: fd.phone.trim(), tower: fd.tower, flat: fd.flat.trim(), amount,
      status: fd.status || 'Full', mode: fd.mode || 'UPI', ref: fd.ref.trim(), collectedBy: fd.collectedBy.trim(), notes: fd.notes.trim(),
      committed: fd.status === 'Part' ? Math.round(+fd.committed || 0) : 0, reminderDate: fd.reminderDate || '',
      receiptIds: [...(d ? pending.keep : []), ...newIds],
      occupancy: fd.occupancy || '', cashWith: fd.mode === 'Cash' ? (fd.cashWith || '').trim() || fd.collectedBy.trim() : '', depositedOn: fd.mode === 'Cash' ? fd.depositedOn || '' : '',
    };
    if (d) Object.assign(d, rec); else { d = { id: uid(), created: Date.now(), ...rec }; S.donations.push(d); }
    let msg = 'Collection saved 🙏';
    if (rec.status === 'Part') {
      const bal = rec.committed - amount, p = S.pledges.find(x => x.sourceDonationId === d.id);
      if (bal > 0) {
        if (p) Object.assign(p, { amount: bal, reminderDate: rec.reminderDate || p.reminderDate, dueDate: rec.reminderDate || p.dueDate });
        else S.pledges.push({ id: uid(), created: Date.now(), donor: rec.donor, phone: rec.phone, tower: rec.tower, flat: rec.flat, amount: bal, paid: 0, mode: rec.mode, dueDate: rec.reminderDate, reminderDate: rec.reminderDate, status: 'Pending', notes: 'Balance of part payment', sourceDonationId: d.id });
        msg = `Saved — balance ${inr(bal)} added to pledges with reminder on ${fmtD(rec.reminderDate)}`;
      }
    }
    if (fd.pledgeId && !fd.id) {
      const p = S.pledges.find(x => x.id === fd.pledgeId);
      if (p) {
        p.paid = (p.paid || 0) + amount;
        if (p.paid >= p.amount) { p.status = 'Fulfilled'; msg = 'Pledge fulfilled 🎉'; }
        else { p.reminderDate = addDays(today(), 7); msg = `Part paid — ${inr(p.amount - p.paid)} still due`; }
      }
    }
    resetPending(); save(); closeModal(); render(); toast(msg);
  },
  pledge(fd) {
    const p = fd.id ? S.pledges.find(x => x.id === fd.id) : null;
    const rec = {
      donor: fd.donor.trim(), tower: fd.tower, flat: fd.flat.trim(), phone: fd.phone.trim(), amount: Math.round(+fd.amount),
      dueDate: fd.dueDate, reminderDate: fd.reminderDate, mode: fd.mode, notes: fd.notes.trim(),
    };
    if (p) Object.assign(p, rec, { paid: Math.round(+fd.paid || 0), status: fd.status || p.status });
    else S.pledges.push({ id: uid(), created: Date.now(), paid: 0, status: 'Pending', ...rec });
    save(); closeModal(); render(); toast('Pledge saved — reminder on ' + fmtD(rec.reminderDate));
  },
  volunteer(fd, form) {
    const all = new FormData(form);
    const rec = { name: fd.name.trim(), phone: fd.phone.trim(), role: fd.role, tower: fd.tower, flat: fd.flat.trim(), slot: fd.slot.trim(), notes: fd.notes.trim(), avail: all.getAll('avail'), towers: all.getAll('vtowers') };
    const v = fd.id ? S.volunteers.find(x => x.id === fd.id) : null;
    if (v) Object.assign(v, rec); else S.volunteers.push({ id: uid(), created: Date.now(), ...rec });
    save(); closeModal(); render(); toast('Volunteer saved 🙋');
  },
  drive(fd, form) {
    const all = new FormData(form);
    const rec = { date: fd.date, time: fd.time.trim(), meet: fd.meet.trim(), target: Math.round(+fd.target || 0), notes: fd.notes.trim(), towers: all.getAll('towers'), volunteerIds: all.getAll('vols') };
    const d = fd.id ? S.drives.find(x => x.id === fd.id) : null;
    if (d) Object.assign(d, rec, { status: fd.status || d.status }); else S.drives.push({ id: uid(), created: Date.now(), status: 'Planned', ...rec });
    save(); closeModal(); render(); toast('Drive saved');
  },
  poll(fd) {
    const lines = fd.options.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length < 2) return toast('Add at least 2 options');
    const p = fd.id ? S.polls.find(x => x.id === fd.id) : null;
    if (p) {
      const old = p.options;
      p.options = lines.map((text, i) => ({ id: old[i]?.id || uid(), text }));
      const ids = new Set(p.options.map(o => o.id));
      p.votes = p.votes.filter(v => ids.has(v.optionId));
      Object.assign(p, { question: fd.question.trim(), audience: fd.audience, reminderTpl: fd.reminderTpl });
    } else S.polls.unshift({ id: uid(), created: Date.now(), closed: false, question: fd.question.trim(), audience: fd.audience, reminderTpl: fd.reminderTpl, options: lines.map(text => ({ id: uid(), text })), votes: [] });
    save(); closeModal(); render(); toast('Poll saved');
  },
  vote(fd, form, submitter) {
    const p = S.polls.find(x => x.id === fd.poll); if (!p) return;
    p.votes.push({ id: uid(), optionId: fd.optionId, name: fd.name.trim(), phone: fd.phone.trim(), tower: fd.tower, flat: fd.flat.trim(), at: Date.now() });
    save(); render(); toast('Vote recorded');
    if (submitter?.name === 'again') { form.reset(); form.querySelector('[name=name]').focus(); } else closeModal();
  },
  sevaBook(fd) {
    const x = S.sevas.find(v => v.id === fd.seva); if (!x || x.bookings.length >= x.slots) return toast('No slots left');
    const b = { id: uid(), name: fd.name.trim(), phone: fd.phone.trim(), tower: fd.tower, flat: fd.flat.trim(), date: today(), paid: fd.pay === 'Paid now' };
    const base = { donor: b.name, phone: b.phone, tower: b.tower || 'Seva sponsor', flat: b.flat || '—', mode: fd.mode, notes: `Seva: ${x.name}` };
    if (b.paid) { const d = { id: uid(), created: Date.now(), date: today(), amount: x.amount, status: 'Full', ref: '', collectedBy: '', receiptIds: [], ...base }; S.donations.push(d); b.donationId = d.id; }
    else { const p = { id: uid(), created: Date.now(), amount: x.amount, paid: 0, dueDate: fd.reminderDate, reminderDate: fd.reminderDate, status: 'Pending', ...base }; S.pledges.push(p); b.pledgeId = p.id; }
    x.bookings.push(b); save(); closeModal(); render(); toast(`${x.name} booked for ${b.name} 🙏`);
  },
  sevaEdit(fd) {
    const rec = { name: fd.name.trim(), amount: Math.round(+fd.amount), slots: Math.max(1, Math.round(+fd.slots)) };
    const x = S.sevas.find(v => v.id === fd.id);
    if (x) Object.assign(x, rec, { slots: Math.max(rec.slots, x.bookings.length) }); else S.sevas.push({ id: uid(), bookings: [], ...rec });
    save(); closeModal(); render();
  },
  week(fd, form) {
    const all = new FormData(form);
    S.weekPlans[fd.week] = { ...(S.weekPlans[fd.week] || {}), target: fd.target === '' ? null : Math.round(+fd.target), towers: all.getAll('towers') };
    save(); closeModal(); render(); toast('Week plan saved');
  },
  proof(fd) {
    if (!pending.files.length) return toast('Attach at least one image');
    const btn = $('#modal-body button.primary'); if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
    storeFiles(pending.files).then(ids => {
      S.dayProofs.push({ id: uid(), date: fd.date, note: fd.note.trim(), fileIds: ids, created: Date.now() });
      resetPending(); save(); closeModal(); render(); toast(`${ids.length} file${ids.length > 1 ? 's' : ''} uploaded for ${fmtD(fd.date)}`);
    });
  },
  script(fd) {
    const key = fd.lang === 'hi' ? 'scriptHi' : 'scriptEn', def = fd.lang === 'hi' ? DEFAULT_SCRIPT_HI : DEFAULT_SCRIPT_EN;
    S.settings[key] = fd.text.trim() === def.trim() ? '' : fd.text;
    save(); closeModal(); render(); toast('Script saved');
  },
  settings(fd) {
    const towers = fd.towers.split('\n').map(s => s.trim()).filter(Boolean);
    if (!towers.length) return toast('Add at least one tower');
    Object.assign(S.settings, {
      society: fd.society.trim(), temple: fd.temple.trim(), target: Math.round(+fd.target || 0), opening: Math.round(+fd.opening || 0),
      deadline: fd.deadline, minDonation: Math.round(+fd.minDonation || 0), minVols: Math.round(+fd.minVols || 0), upi: fd.upi.trim(),
      homes: Math.round(+fd.homes || 0), foundationPct: Math.round(+fd.foundationPct || 0), builtPct: Math.round(+fd.builtPct || 0),
      coordName: fd.coordName.trim(), coordPhone: fd.coordPhone.trim(), towers, address: fd.address.trim(), mapQuery: fd.mapQuery.trim(),
      videoUrl: fd.videoUrl.trim(), reminderTpl: fd.reminderTpl, thanksTpl: fd.thanksTpl,
    });
    save(); render(); toast('Settings saved');
  },
};

/* =========================================================================
   ACTIONS (click handlers)
   ========================================================================= */
const findD = id => S.donations.find(x => x.id === id);
const findP = id => S.pledges.find(x => x.id === id);
const findPoll = id => S.polls.find(x => x.id === id);
const ACTIONS = {
  goto: ds => go(ds.tab),
  adminLogin: () => adminLoginForm(),
  adminLogout: () => { ADMIN = false; try { localStorage.removeItem(ADMIN_KEY); } catch {} closeModal(); go(PUBLIC_TABS.includes(tab) ? tab : 'dashboard'); toast('Public view — this is what residents see'); },
  gotoTower: ds => { UI.col = { q: '', date: '', tower: ds.tower, mode: '', status: '' }; go('collections'); },
  closeModal,
  addDonation: () => donationForm(),
  editDonation: ds => donationForm(findD(ds.id)),
  delDonation: ds => {
    const d = findD(ds.id); if (!d || !confirm(`Delete ${d.donor}'s collection of ${inr(d.amount)}?`)) return;
    delFiles(d.receiptIds); S.donations = S.donations.filter(x => x !== d); save(); render(); toast('Deleted');
  },
  thank: ds => { const d = findD(ds.id); openWA(d.phone, fillTpl(S.settings.thanksTpl, { name: d.donor, amount: inr(d.amount) })); },
  filterDate: ds => { UI.col.date = ds.date; const i = $('[data-filter=date]'); if (i) i.value = ds.date; updateColList(); $('#col-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  clearFilters: () => { UI.col = { q: '', date: '', tower: '', mode: '', status: '' }; render(); },
  addProof: () => {
    resetPending();
    openModal(`<form class="form" data-form="proof"><h3>Upload day's receipts</h3>
      <label>Collection date<input type="date" name="date" required value="${today()}"></label>
      ${dropzone('Add WhatsApp screenshots / receipt photos')}
      <label>Note<input name="note" placeholder="e.g. Tower 5 & 6 evening drive — 9 UPI screenshots + cash sheet"></label>
      ${cancelSave('Upload')}</form>`);
  },
  delProof: ds => { const p = S.dayProofs.find(x => x.id === ds.id); if (!p || !confirm('Delete this upload?')) return; delFiles(p.fileIds); S.dayProofs = S.dayProofs.filter(x => x !== p); save(); render(); },
  rmPending: ds => { pending.files.splice(+ds.i, 1); renderPending(); },
  rmKeep: ds => { pending.keep.splice(+ds.i, 1); renderPending(); },
  viewFile: async ds => {
    const ids = ds.ids.split(','), i = +ds.i, f = await getFile(ids[i]);
    if (f && !f.type.startsWith('image/')) return window.open(f.url, '_blank');
    UI.lb = { items: ids.map(id => ({ id, cap: '' })), i }; lightbox();
  },
  slideshow: ds => {
    const items = evidenceItems(); if (!items.length) return;
    UI.lb = { items, i: Math.min(+ds.i || 0, items.length - 1) }; lightbox();
  },
  lbNav: ds => { const lb = UI.lb; lb.i = (lb.i + +ds.d + lb.items.length) % lb.items.length; lightbox(); },

  addPledge: () => pledgeForm(),
  editPledge: ds => pledgeForm(findP(ds.id)),
  delPledge: ds => { const p = findP(ds.id); if (p && confirm(`Delete pledge of ${p.donor}?`)) { S.pledges = S.pledges.filter(x => x !== p); save(); render(); } },
  remind: ds => {
    const p = findP(ds.id), t = today();
    openWA(p.phone, fillTpl(S.settings.reminderTpl, { name: p.donor, amount: inr(p.amount - (p.paid || 0)) }));
    Object.assign(p, { lastReminded: t, remindCount: (p.remindCount || 0) + 1, reminderDate: addDays(t, 3) });
    save(); render(); toast(`${p.phone ? '' : 'No phone saved — pick the contact in WhatsApp. '}Next reminder: ${fmtD(p.reminderDate)}`);
  },
  snooze: ds => { const p = findP(ds.id); p.reminderDate = addDays(today(), 3); save(); render(); toast('Reminder moved to ' + fmtD(p.reminderDate)); },
  payPledge: ds => { const p = findP(ds.id); donationForm({ donor: p.donor, phone: p.phone, tower: p.tower, flat: p.flat, amount: p.amount - (p.paid || 0), mode: p.mode, pledgeId: p.id, status: 'Full' }); },

  addVolunteer: () => volunteerForm(),
  editVolunteer: ds => volunteerForm(S.volunteers.find(v => v.id === ds.id)),
  delVolunteer: ds => {
    const v = S.volunteers.find(x => x.id === ds.id); if (!v || !confirm(`Remove ${v.name}?`)) return;
    S.volunteers = S.volunteers.filter(x => x !== v); S.drives.forEach(d => d.volunteerIds = (d.volunteerIds || []).filter(id => id !== v.id)); save(); render();
  },
  inviteVol: ds => {
    const v = S.volunteers.find(x => x.id === ds.id), next = S.drives.filter(d => d.date >= today() && d.status !== 'Done').sort((a, b) => a.date.localeCompare(b.date))[0];
    openWA(v.phone, `🙏 ${v.name} ji, can you join the temple collection drive${next ? ` on ${fmtWD(next.date)} (${next.time})${next.towers?.length ? ' for ' + next.towers.join(', ') : ''}` : ' this week'}? We are at ${lakh(totals().achieved)} of ${lakh(S.settings.target)} — ${totals().daysLeft} days to go. Please reply 👍`);
  },
  addDrive: ds => driveForm(ds.date ? { date: ds.date } : {}),
  editDrive: ds => driveForm(S.drives.find(d => d.id === ds.id)),
  delDrive: ds => { if (confirm('Delete this drive?')) { S.drives = S.drives.filter(d => d.id !== ds.id); save(); render(); } },
  driveDone: ds => { const d = S.drives.find(x => x.id === ds.id); d.status = 'Done'; save(); render(); toast(`Drive marked done — ${inr(driveCollected(d))} collected`); },
  unjoin: ds => { const d = S.drives.find(x => x.id === ds.drive); d.volunteerIds = d.volunteerIds.filter(id => id !== ds.vol); save(); render(); },
  shareDrive: ds => {
    const d = S.drives.find(x => x.id === ds.id), T = totals(), need = Math.max(0, S.settings.minVols - (d.volunteerIds || []).length);
    const st = S.settings, vols = (d.volunteerIds || []).map(volName).filter(Boolean), towers = d.towers || [];
    const lines = [
      `🔱 *Har Har Mahadev* 🙏`,
      `*${st.temple} — Seva Drive*`,
      ``,
      `📅 *${fmtWD(d.date)}*${d.time ? ` · ${d.time}` : ''}`,
      d.meet ? `📍 Meet at: *${d.meet}*` : null,
      `🏢 Visiting: ${towers.length ? towers.join(' & ').replace(/ & (?=.* & )/g, ', ') : 'towers to be decided'}`,
      d.target ? `🎯 Goal for the evening: ${inr(d.target)}` : null,
      ``,
      vols.length ? `🙋 Joining: ${vols.join(', ')}` : null,
      need ? `👉 *We need ${need} more volunteer${need > 1 ? 's' : ''}.* Reply *"I'm in"* to join — even one hour helps.` : `✅ Team is complete — thank you! More hands are always welcome.`,
      ``,
      `📊 So far: *${lakh(T.achieved)}* of ${lakh(st.target)} (${T.pct.toFixed(0)}%) · ${T.daysLeft} days to ${fmtD(st.deadline)}`,
      siteLink() ? `🎬 Temple film & details: ${siteLink()}` : null,
      ``,
      `Tan · Man · Dhan — every seva counts 🙏`,
    ];
    openWA('', lines.filter(l => l !== null).join('\n').trim());
  },

  addPoll: () => pollForm(),
  editPoll: ds => pollForm(findPoll(ds.poll)),
  delPoll: ds => { if (confirm('Delete this poll and all its votes?')) { S.polls = S.polls.filter(p => p.id !== ds.poll); save(); render(); } },
  togglePoll: ds => { const p = findPoll(ds.poll); p.closed = !p.closed; save(); render(); },
  addVote: ds => voteForm(findPoll(ds.poll)),
  sharePoll: ds => {
    const p = findPoll(ds.poll);
    openWA('', `🗳️ *${p.question}*\n\n${p.options.map((o, i) => `${i + 1}. ${o.text}`).join('\n')}\n\nPlease reply with the option number + your tower & flat 🙏 — ${S.settings.temple} seva team`);
  },
  pollVoters: ds => {
    const p = findPoll(ds.poll);
    openModal(`<h3>${esc(p.question)}</h3><div class="table-wrap" style="margin-top:10px">${p.votes.length ? `<table class="rtable"><thead><tr><th>Name</th><th>Flat</th><th>Phone</th><th>Choice</th><th></th></tr></thead><tbody>
      ${p.votes.map(v => `<tr><td data-label="Name">${esc(v.name)}</td><td data-label="Flat">${esc(v.tower)} ${esc(v.flat)}</td><td data-label="Phone">${esc(v.phone || '—')}</td>
      <td data-label="Choice">${esc(p.options.find(o => o.id === v.optionId)?.text || '')}</td>
      <td data-label=""><button class="btn sm icon danger" data-act="delVote" data-poll="${p.id}" data-vote="${v.id}">🗑</button></td></tr>`).join('')}</tbody></table>` : empty('No votes yet')}</div>
      <div class="actions" style="margin-top:12px"><button class="btn" data-act="closeModal">Close</button></div>`, true);
  },
  delVote: ds => { const p = findPoll(ds.poll); p.votes = p.votes.filter(v => v.id !== ds.vote); save(); render(); ACTIONS.pollVoters(ds); },
  pollRemind: ds => {
    const p = findPoll(ds.poll), o = p.options.find(x => x.id === ds.opt), voters = p.votes.filter(v => v.optionId === o.id);
    const generic = fillTpl(p.reminderTpl, { name: '', option: o.text, question: p.question }).replace(/ +ji,/, ',').replace(/🙏 ,/, '🙏');
    openModal(`<h3>Remind ${voters.length} voter${voters.length === 1 ? '' : 's'} who chose "${esc(o.text)}"</h3>
      <p class="hint" style="margin:6px 0 12px">Tap 💬 for each person — WhatsApp opens with their personalised message. People without a phone can be reached via the group message below.</p>
      <div class="rem-list">${voters.map(v => `<div class="rem"><div><div class="who">${esc(v.name)} <span class="muted small">· ${esc(v.tower)} ${esc(v.flat)}</span></div><div class="meta">${esc(v.phone || 'no phone')}${v.reminded ? ` · reminded ${fmtD(v.reminded)}` : ''}</div></div>
        <div class="row-actions"><button class="btn sm wa" data-act="waVoter" data-poll="${p.id}" data-vote="${v.id}" data-opt="${o.id}">💬 Remind</button></div></div>`).join('')}</div>
      <div class="actions" style="margin-top:14px"><button class="btn" data-act="copyNumbers" data-poll="${p.id}" data-opt="${o.id}">Copy numbers</button>
        <button class="btn wa" data-act="waGroup" data-msg="${esc(generic)}">Send one group message</button><button class="btn primary" data-act="closeModal">Done</button></div>`, true);
  },
  waVoter: ds => {
    const p = findPoll(ds.poll), o = p.options.find(x => x.id === ds.opt), v = p.votes.find(x => x.id === ds.vote);
    openWA(v.phone, fillTpl(p.reminderTpl, { name: v.name || '', option: o.text, question: p.question }));
    v.reminded = today(); save();
    const btn = $(`[data-act=waVoter][data-vote="${v.id}"]`); if (btn) { btn.textContent = '✓ Sent'; btn.classList.remove('wa'); }
  },
  copyNumbers: ds => { const p = findPoll(ds.poll); copyText(p.votes.filter(v => v.optionId === ds.opt && v.phone).map(v => v.phone).join(', ') || '(no phone numbers)'); },
  waGroup: ds => openWA('', ds.msg),

  editWeek: ds => {
    const w = weeksData().find(x => x.start === ds.week);
    openModal(`<form class="form" data-form="week"><h3>Week of ${fmtD(w.start)} – ${fmtD(w.end)}</h3><input type="hidden" name="week" value="${w.start}">
      <label>Target for this week (₹) — leave blank to use suggested ${inr(w.suggested)}<input type="number" name="target" min="0" step="1000" value="${w.custom ? w.target : ''}"></label>
      <fieldset><legend>Towers to cover this week</legend>${checks('towers', S.settings.towers, w.towers)}</fieldset>${cancelSave()}</form>`);
  },
  autoPlan: () => {
    const W = weeksData(); if (!W.length) return;
    if (Object.keys(S.weekPlans).some(k => W.some(w => w.start === k && (S.weekPlans[k].towers?.length || S.weekPlans[k].target != null))) && !confirm('Replace the current week targets & tower assignments?')) return;
    const ts = towerStats();
    const towers = [...S.settings.towers].sort((a, b) => (ts[a]?.amount || 0) - (ts[b]?.amount || 0));
    const eligible = W.filter(w => w.days >= 3 && w.end >= today());
    const plan = eligible.length ? eligible : W;
    const totalDays = sum(plan.map(w => w.days));
    let k = 0;
    plan.forEach((w, i) => {
      const n = i === plan.length - 1 ? towers.length - k : Math.round(towers.length * w.days / totalDays);
      S.weekPlans[w.start] = { ...(S.weekPlans[w.start] || {}), target: null, towers: towers.slice(k, k + n) };
      k += n;
    });
    W.filter(w => !plan.includes(w)).forEach(w => S.weekPlans[w.start] = { ...(S.weekPlans[w.start] || {}), target: null, towers: [], notes: S.weekPlans[w.start]?.notes || 'Final follow-ups & pledge collection' });
    save(); render(); toast('Weeks planned ✨');
  },

  timerToggle: ds => { const t = TIMERS[ds.k]; if (t.running) { t.acc += Date.now() - t.start; t.running = false; } else { t.start = Date.now(); t.running = true; } tickTimers(); },
  timerReset: ds => { Object.assign(TIMERS[ds.k], { acc: 0, running: false, start: 0 }); tickTimers(); },
  copyScript: () => copyText(fillTpl(scriptTpl())),
  shareScript: () => openWA('', `🛕 *Visit script (2 min)*\n\n${fillTpl(scriptTpl())}`),
  editScript: () => openModal(`<form class="form" data-form="script"><h3>Edit ${UI.lang === 'hi' ? 'Hindi' : 'English'} script</h3><input type="hidden" name="lang" value="${UI.lang}">
    <textarea name="text" rows="16">${esc(scriptTpl())}</textarea><p class="hint">Placeholders: {society} {temple} {achieved} {target} {pct} {remaining} {deadline} {daysLeft} {min} {upi}</p>
    <div class="actions"><button type="button" class="btn ghost" data-act="resetScript">Reset to default</button><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary">Save</button></div></form>`, true),
  resetScript: () => { const ta = $('#modal-body textarea[name=text]'); ta.value = UI.lang === 'hi' ? DEFAULT_SCRIPT_HI : DEFAULT_SCRIPT_EN; },
  delPhoto: ds => { if (!confirm('Remove this photo?')) return; delFiles([ds.id]); S.presentation.photos = S.presentation.photos.filter(p => p.id !== ds.id); save(); render(); },
  delVideo: () => { if (!confirm('Remove the uploaded video?')) return; delFiles([S.presentation.videoFileId]); S.presentation.videoFileId = null; save(); render(); },

  setAmt: ds => { const i = $('#modal-body [name=amount]'); if (i) { i.value = ds.v; i.focus(); } },
  setCoverage: ds => {
    const cur = (S.coverage || {})[ds.tower] || 0;
    const v = window.prompt(`What % of ${ds.tower} flats have been visited?`, cur); if (v == null) return;
    const n = Math.max(0, Math.min(100, Math.round(+v || 0)));
    (S.coverage ||= {})[ds.tower] = n; save(); render(); toast(`${ds.tower}: ${n}% visited`);
  },
  copyUpi: () => copyText(S.settings.upi),
  seek: ds => { const v = $('#film'); if (!v) return; v.currentTime = +ds.t; v.play().catch(() => {}); v.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  shareFilm: () => {
    const T = totals(), st = S.settings;
    openWA('', `🔱 *${st.temple}* — ${st.society}\n\n“Where there is no temple, there is no dharma.”\n\nFoundation ${st.foundationPct}% complete · Shivling arrived · Pink sandstone being carved in Rajasthan.\n${lakh(T.achieved)} received — ${lakh(T.remaining)} more needed. Prana Pratishtha: ${fmtLong(st.deadline)}.\n\nGive from ${inr(st.minDonation)} or sponsor a seva. HDFC UPI: ${st.upi}\n\n🎬 Watch our temple film.\nHar Har Mahadev 🙏`);
  },
  bookSeva: ds => {
    const x = S.sevas.find(v => v.id === ds.seva);
    openModal(`<form class="form" data-form="sevaBook"><h3>Book: ${esc(x.name)} — ${inr(x.amount)}</h3><input type="hidden" name="seva" value="${x.id}">
      <div class="grid2"><label class="span2">Sponsor name (as on plaque)<input name="name" required></label>
        <label>Tower<select name="tower">${towerOpts('')}</select></label><label>Flat no.<input name="flat"></label>
        <label>Phone (WhatsApp)<input name="phone" type="tel"></label><label>Mode<select name="mode">${MODES.map(m => `<option>${m}</option>`).join('')}</select></label></div>
      <fieldset><legend>Payment</legend>${radios('pay', ['Pledge — pay later', 'Paid now'], 'Pledge — pay later')}
        <label>Pledge reminder on<input type="date" name="reminderDate" value="${addDays(today(), 5)}"></label></fieldset>${cancelSave('Book slot')}</form>`);
  },
  unbookSeva: ds => {
    const x = S.sevas.find(v => v.id === ds.seva), b = x.bookings.find(v => v.id === ds.b);
    if (!confirm(`Cancel ${b.name}'s booking for ${x.name}?${b.donationId ? ' (The recorded collection stays.)' : ''}`)) return;
    const p = S.pledges.find(v => v.id === b.pledgeId); if (p && p.status === 'Pending') p.status = 'Cancelled';
    x.bookings = x.bookings.filter(v => v !== b); save(); render();
  },
  addSeva: () => ACTIONS.editSeva({}),
  editSeva: ds => {
    const x = S.sevas.find(v => v.id === ds.seva) || {};
    openModal(`<form class="form" data-form="sevaEdit"><h3>${x.id ? 'Edit' : 'Add'} seva item</h3><input type="hidden" name="id" value="${esc(x.id || '')}">
      <div class="grid2"><label class="span2">Name<input name="name" required value="${esc(x.name || '')}"></label>
      <label>Offering (₹)<input type="number" name="amount" min="1" required value="${esc(x.amount || '')}"></label>
      <label>Slots<input type="number" name="slots" min="${x.bookings?.length || 1}" required value="${esc(x.slots || 1)}"></label></div>
      <div class="actions">${x.id && !x.bookings.length ? '<button type="button" class="btn ghost danger" data-act="delSeva" data-seva="' + x.id + '">Delete</button>' : ''}<button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button class="btn primary">Save</button></div></form>`);
  },
  delSeva: ds => { S.sevas = S.sevas.filter(v => v.id !== ds.seva); save(); closeModal(); render(); },
  shareSevas: () => {
    const open = S.sevas.filter(x => x.slots > x.bookings.length);
    openWA('', `🔱 *Dedicate a part of Mahadev's home* — ${S.settings.temple}\n\n${open.map(x => `• ${x.name}: ${inr(x.amount)}${x.slots > 1 ? ' each' : ''} (${x.slots - x.bookings.length} open)`).join('\n')}\n\nFamily seva from ${inr(S.settings.minDonation)} • UPI: ${S.settings.upi}\nHar Har Mahadev 🙏`);
  },
  setIdol: ds => {
    const x = S.idols.find(v => v.id === ds.id);
    const v = window.prompt(`Sponsor for ${x.name} (leave blank if open):`, x.sponsor || ''); if (v == null) return;
    x.sponsor = v.trim(); save(); render();
  },
  shareLedger: () => {
    const t = today(), ws = mondayOf(t), T = totals();
    const days = []; for (let d = ws; d <= t; d = addDays(d, 1)) days.push(d);
    const lines = days.map(d => { const ds = S.donations.filter(x => x.date === d); return ds.length ? `${fmtWD(d)}: ${inr(sum(ds.map(x => x.amount)))} (${ds.length} entr${ds.length === 1 ? 'y' : 'ies'})` : null; }).filter(Boolean);
    openWA('', `📒 *Weekly ledger — ${S.settings.temple}*\nWeek of ${fmtD(ws)}\n\n${lines.join('\n') || 'No collections recorded yet this week.'}\n\n*This week:* ${inr(sumRange(ws, t))}\n*Total achieved:* ${lakh(T.achieved)} of ${lakh(S.settings.target)} (${T.pct.toFixed(1)}%)\n*Pledged, still due:* ${inr(T.pledgedPending)}\n*Remaining:* ${lakh(T.remaining)} · ${T.daysLeft} days to Prana Pratishtha\n\nEvery rupee receipted 🙏 Har Har Mahadev`);
  },
  selfDonate: () => selfDonateForm(),
  remindDrive: ds => { const d = S.drives.find(x => x.id === ds.id); if (d) openWA('', remindMsg(d)); },
  icsDrive: ds => { const d = S.drives.find(x => x.id === ds.id); if (d) { download(`temple-drive-${d.date}.ics`, icsFor([d]), 'text/calendar'); toast('Open the file to add it: your phone will alert 30 min before'); } },
  icsAll: () => { const L = S.drives.filter(d => d.status !== 'Done' && d.date >= today()); if (!L.length) return toast('No upcoming drives'); download('temple-drives.ics', icsFor(L), 'text/calendar'); toast(`${L.length} drives: each alerts 30 min before`); },
  enableAlerts: async () => { try { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Alerts on: this phone will notify 30 min before each drive (while the site is open)' : 'Alerts not allowed'); render(); } catch { toast('This browser does not support alerts'); } },
  shareAudio: async () => {
    const a = AUDIO[UI.lang] || AUDIO.en, name = `Temple-visit-script-${UI.lang === 'hi' ? 'Hindi' : 'English'}.m4a`;
    try {
      const blob = await (await fetch(a.file)).blob(), file = new File([blob], name, { type: 'audio/mp4' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text: `🔊 ${S.settings.temple}: 2-minute visit script (${a.label}). Har Har Mahadev 🙏` });
    } catch (e) { if (e.name === 'AbortError') return; }
    const l = document.createElement('a'); l.href = a.file; l.download = name; l.click();
    toast('Audio downloaded. Attach it in WhatsApp with 📎');
  },
  acceptSub: ds => {
    const x = S.submissions.find(v => v.id === ds.id); if (!x) return;
    const d = { id: uid(), created: Date.now(), date: x.date, donor: x.donor, phone: x.phone, tower: x.tower, flat: x.flat, occupancy: x.occupancy, amount: x.amount,
      status: 'Full', mode: x.mode === 'Cash to volunteer' ? 'Cash' : x.mode, ref: x.ref, collectedBy: 'Self (resident form)', notes: 'Submitted by resident', receiptIds: [...x.receiptIds], committed: 0 };
    S.donations.push(d); x.addedId = d.id; save(); render(); toast(`${x.donor} added to collections 🙏`);
  },
  delSub: ds => { if (!confirm('Delete this submission?')) return; const x = S.submissions.find(v => v.id === ds.id); delFiles(x.receiptIds); S.submissions = S.submissions.filter(v => v.id !== ds.id); save(); render(); },
  shareAudit: () => {
    const st = S.settings;
    openWA(st.auditPhone, `🧾 *Temple donation — receipt for audit*\n${st.temple}\n\nName: \nTower & flat: \nOwner / Tenant: \nAmount: ₹\nUPI / UTR ref: \n\n📎 Payment screenshot attached.\nHar Har Mahadev 🙏`);
  },
  sendAudit: () => { const r = UI.lastSub; if (r) openWA(S.settings.auditPhone, auditMsg(r)); },
  shareReceiptFile: async () => {
    const r = UI.lastSub; if (!r) return;
    try { await navigator.share({ files: UI.lastShare, text: auditMsg(r) }); }
    catch (e) { if (e.name !== 'AbortError') { toast('Sharing not available — opening WhatsApp instead'); openWA(S.settings.auditPhone, auditMsg(r)); } }
  },
  depositCash: ds => {
    const list = cashStats().byHolder[ds.who] || [];
    if (!list.length || !confirm(`Mark ${inr(sum(list.map(d => d.amount)))} cash held by ${ds.who} as deposited to the temple account today?`)) return;
    list.forEach(d => d.depositedOn = today()); save(); render(); toast('Cash marked as deposited ✅');
  },
  exportCSV: () => {
    const cols = ['date', 'donor', 'phone', 'tower', 'flat', 'amount', 'status', 'committed', 'occupancy', 'mode', 'ref', 'collectedBy', 'cashWith', 'depositedOn', 'notes'];
    const rows = [...S.donations].sort((a, b) => a.date.localeCompare(b.date)).map(d => cols.map(c => d[c] ?? '').concat((d.receiptIds || []).length));
    download(`collections-${today()}.csv`, toCSV([[...cols, 'receipts'], ...rows]), 'text/csv');
  },
  exportPledgesCSV: () => {
    const cols = ['donor', 'phone', 'tower', 'flat', 'amount', 'paid', 'dueDate', 'reminderDate', 'status', 'lastReminded', 'notes'];
    download(`pledges-${today()}.csv`, toCSV([cols, ...S.pledges.map(p => cols.map(c => p[c] ?? ''))]), 'text/csv');
  },
  exportBackup: async () => {
    toast('Preparing backup…');
    const files = await FileDB.all().catch(() => []);
    const enc = await Promise.all(files.map(async f => ({ id: f.id, name: f.name, type: f.type, data: await blobToDataURL(f.blob) })));
    download(`temple-drive-backup-${today()}.json`, JSON.stringify({ app: 'templeFundDrive', version: 1, exported: new Date().toISOString(), state: S, files: enc }), 'application/json');
  },
  demo: () => { if ((S.donations.length || S.volunteers.length) && !confirm('Replace current data with demo data?')) return; loadDemo(); },
  reset: async () => {
    if (!confirm('Delete ALL data (collections, pledges, volunteers, photos)? Download a backup first if needed.')) return;
    await FileDB.clear().catch(() => {}); fileCache.clear(); S = defaults(); save(); render(); toast('All data cleared');
  },
};
const toCSV = rows => '﻿' + rows.map(r => r.map(v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

function lightbox() {
  const lb = UI.lb, it = lb.items[lb.i], n = lb.items.length;
  openModal(`<div class="lightbox"><div class="stage">${it.src ? `<img src="${it.src}" alt="${esc(it.cap)}">` : `<span data-file="${it.id}"></span>`}</div>
    ${it.cap ? `<div class="cap">${esc(it.cap)}</div>` : ''}
    <div class="nav">${n > 1 ? `<button class="btn" data-act="lbNav" data-d="-1">← Prev</button>` : '<span></span>'}<span class="muted small">${lb.i + 1} / ${n}</span>
    ${n > 1 ? `<button class="btn" data-act="lbNav" data-d="1">Next →</button>` : '<span></span>'}</div>
    <div class="actions"><button class="btn primary" data-act="closeModal">Close</button></div></div>`, true);
}

/* ---------- timers ---------- */
const TIMERS = { script: { dur: 120, acc: 0, start: 0, running: false }, pres: { dur: 600, acc: 0, start: 0, running: false } };
const mmss = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
function tickTimers() {
  for (const [k, t] of Object.entries(TIMERS)) {
    const el = $(`[data-timer="${k}"]`); if (!el) continue;
    const elapsed = (t.acc + (t.running ? Date.now() - t.start : 0)) / 1000, rem = t.dur - elapsed;
    el.querySelector('.t-time').textContent = rem >= 0 ? mmss(Math.ceil(rem)) : '+' + mmss(-rem);
    el.querySelector('.pbar span').style.width = pctOf(elapsed, t.dur) + '%';
    el.classList.toggle('over', rem < 0);
    el.querySelector('[data-act=timerToggle]').textContent = t.running ? '⏸ Pause' : elapsed > 0 ? '▶ Resume' : '▶ Start';
    if (k === 'pres') $$('.agenda li').forEach((li, i) => {
      const a = AGENDA[i], started = elapsed > 0;
      li.classList.toggle('now', started && elapsed >= a.s && elapsed < a.e);
      li.classList.toggle('done', started && elapsed >= a.e);
    });
  }
}
setInterval(() => { if (TIMERS.script.running || TIMERS.pres.running) tickTimers(); }, 250);

/* ---------- demo data ---------- */
function loadDemo() {
  const st = S.settings, t = today();
  const names = ['Ramesh Sharma', 'Sunita Gupta', 'Anil Mehta', 'Priya Iyer', 'Vikas Patel', 'Neha Joshi', 'Suresh Reddy', 'Kavita Nair', 'Rajesh Agarwal', 'Pooja Verma', 'Manoj Kulkarni', 'Deepa Rao', 'Amit Singh', 'Swati Desai', 'Harish Pillai', 'Meena Chauhan', 'Sanjay Tiwari', 'Ritu Bansal', 'Gopal Krishnan', 'Anjali Mishra', 'Prakash Jain', 'Lata Bhat', 'Vivek Saxena', 'Rekha Menon', 'Arun Dubey', 'Shalini Kapoor', 'Mahesh Yadav', 'Nidhi Arora'];
  const amts = [5100, 5100, 5100, 11000, 2100, 21000, 11000, 3100, 51000, 1100, 5100, 7100];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const vols = ['Ravi Kumar', 'Anita Shah', 'Deepak Rao', 'Kiran Joshi', 'Mohan Das', 'Seema Pandey', 'Ajay Thakur'].map((name, i) => ({
    id: uid(), name, phone: '', role: i === 0 ? 'Coordinator' : i === 1 ? 'Accounts / Receipts' : i === 2 ? 'Team Lead' : 'Volunteer',
    tower: st.towers[i % st.towers.length], flat: String(101 + i * 100), slot: i % 2 ? 'Evenings after 7 PM' : 'Weekend mornings',
    avail: i % 2 ? ['Mon', 'Wed', 'Fri', 'Sat'] : ['Tue', 'Thu', 'Sat', 'Sun'], towers: st.towers.slice(i * 2, i * 2 + 3), notes: '',
  }));
  const donations = []; let ni = 0;
  for (let back = 6; back >= 0; back--) {
    const date = addDays(t, -back), n = 3 + Math.floor(Math.random() * 5);
    for (let j = 0; j < n; j++) {
      const amount = pick(amts), part = Math.random() < 0.12;
      donations.push({
        id: uid(), created: Date.now() - back * 864e5 + j, date, donor: names[ni++ % names.length], phone: '',
        tower: st.towers[(back * 3 + j) % 12], flat: String((1 + Math.floor(Math.random() * 15)) * 100 + 1 + Math.floor(Math.random() * 4)),
        amount, status: part ? 'Part' : 'Full', committed: part ? amount * 2 : 0, mode: Math.random() < 0.65 ? 'UPI' : 'Cash',
        ref: '', collectedBy: pick(vols).name, notes: '', receiptIds: [], reminderDate: addDays(t, 2),
      });
    }
  }
  const pledges = donations.filter(d => d.status === 'Part').map(d => ({ id: uid(), created: Date.now(), donor: d.donor, phone: '', tower: d.tower, flat: d.flat, amount: d.committed - d.amount, paid: 0, mode: d.mode, dueDate: addDays(t, 2), reminderDate: addDays(t, Math.random() < .5 ? -1 : 2), status: 'Pending', notes: 'Balance of part payment', sourceDonationId: d.id }));
  pledges.push(
    { id: uid(), created: Date.now(), donor: 'Yogesh Malhotra', phone: '', tower: st.towers[13], flat: '904', amount: 11000, paid: 0, mode: 'UPI', dueDate: addDays(t, 5), reminderDate: t, status: 'Pending', notes: 'Salary on 1st' },
    { id: uid(), created: Date.now(), donor: 'Bhavna Sethi', phone: '', tower: st.towers[14], flat: '1203', amount: 5100, paid: 0, mode: 'Cash', dueDate: addDays(t, 4), reminderDate: addDays(t, 3), status: 'Pending', notes: 'Call before visiting' },
  );
  const drives = [0, 1, 2, 4].map((k, i) => ({
    id: uid(), created: Date.now(), date: addDays(t, k), time: k % 2 ? '10:00 AM – 1:00 PM' : '7:00 PM – 9:00 PM', meet: 'Clubhouse gate',
    towers: st.towers.slice(12 + i * 2, 14 + i * 2), volunteerIds: vols.slice(i, i + 2 + (i % 2)).map(v => v.id), target: 100000, status: 'Planned', notes: '',
  }));
  const polls = defaultPolls();
  polls.forEach(p => { const n = 6 + Math.floor(Math.random() * 10); for (let i = 0; i < n; i++) p.votes.push({ id: uid(), optionId: pick(p.options).id, name: pick(names), phone: '', tower: pick(st.towers), flat: String(100 + i * 101), at: Date.now() }); });
  S = { ...S, donations, pledges, volunteers: vols, drives, polls, weekPlans: {} };
  save(); render(); toast('Demo data loaded — use "Reset everything" in Settings to clear it');
}

/* =========================================================================
   EVENT WIRING
   ========================================================================= */
document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]:not([data-act])');
  if (tb && tb.closest('#tabs')) return go(tb.dataset.tab);
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  if (!ADMIN && !PUBLIC_ACTS.has(b.dataset.act)) return;
  const fn = ACTIONS[b.dataset.act];
  if (fn) { e.preventDefault(); fn(b.dataset, b, e); }
});
modal().addEventListener('click', e => { if (e.target === modal()) closeModal(); });
modal().addEventListener('close', () => { resetPending(); UI.lb = null; });

document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]'); if (!form) return;
  e.preventDefault();
  FORMS[form.dataset.form](Object.fromEntries(new FormData(form)), form, e.submitter);
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.filter) { UI.col[el.dataset.filter] = el.value; updateColList(); }
  if (el.dataset.lg === 'q') { LG.q = el.value; const l = $('#lg-list'); if (l) l.innerHTML = ledgerList(); }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.name === 'status' && el.closest('form[data-form=donation]')) { const p = $('[data-part]'); if (p) p.hidden = el.value !== 'Part'; }
  if (el.matches('[data-pick]')) { addPending(el.files); el.value = ''; }
  if (el.matches('[data-vstower]')) { VS.tower = el.value; render(); }
  if (el.dataset.lg && el.dataset.lg !== 'q') { LG[el.dataset.lg] = el.value; if (el.dataset.lg === 'sec') LG.st = ''; render(); }
  if (el.matches('[data-join]') && el.value) {
    const d = S.drives.find(x => x.id === el.dataset.join); (d.volunteerIds ||= []).push(el.value); save(); render(); toast(`${volName(el.value)} joined the drive 🙋`);
  }
  if (el.matches('[data-pledge-filter]')) { UI.pledgeStatus = el.value; render(); }
  if (el.matches('[data-lang]')) { UI.lang = el.value; render(); }
  if (el.matches('[data-film]')) { UI.film = el.value; render(); }
  if (el.matches('[data-film-lang]')) { UI.filmLang = el.value; render(); }
  if (el.matches('[data-week-note]')) { S.weekPlans[el.dataset.weekNote] = { ...(S.weekPlans[el.dataset.weekNote] || {}), notes: el.value }; save(); toast('Note saved'); }
  if (el.matches('[data-caption]')) { const p = S.presentation.photos.find(x => x.id === el.dataset.caption); if (p) { p.caption = el.value; save(); } }
  if (el.matches('[data-upload=photos]') && el.files.length) {
    toast('Uploading photos…'); const ids = await storeFiles([...el.files]);
    S.presentation.photos.push(...ids.map(id => ({ id, caption: '' }))); save(); render(); toast(`${ids.length} photo${ids.length > 1 ? 's' : ''} added`);
  }
  if (el.matches('[data-upload=video]') && el.files[0]) {
    toast('Saving video…'); const [id] = await storeFiles([el.files[0]]);
    if (S.presentation.videoFileId) delFiles([S.presentation.videoFileId]);
    S.presentation.videoFileId = id; save(); render(); toast('Video saved');
  }
  if (el.matches('[data-import]') && el.files[0]) {
    try {
      const obj = JSON.parse(await el.files[0].text());
      if (!obj.state) throw new Error('Not a backup file');
      if (!confirm('Importing replaces all current data on this device. Continue?')) return;
      await FileDB.clear(); fileCache.clear();
      for (const f of obj.files || []) await FileDB.put({ id: f.id, name: f.name, type: f.type, blob: await (await fetch(f.data)).blob(), created: Date.now() });
      S = merge(obj.state); save(); render(); toast('Backup imported ✅');
    } catch (err) { toast('Import failed: ' + err.message); }
    el.value = '';
  }
});

/* drag & drop + paste for receipts */
document.addEventListener('dragover', e => { const z = e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest('[data-drop]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => { const z = e.target.closest('[data-drop]'); if (z) { e.preventDefault(); z.classList.remove('over'); addPending(e.dataTransfer.files); } });
document.addEventListener('paste', e => {
  if (!modal().open || !$('#modal-body [data-drop]')) return;
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); addPending(files); }
});
document.addEventListener('keydown', e => {
  if (UI.lb && modal().open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) ACTIONS.lbNav({ d: e.key === 'ArrowRight' ? 1 : -1 });
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h === 'admin') return ADMIN ? go('collections') : adminLoginForm(); if (tabOk(h) && h !== tab) { tab = h; render(); } });
if (location.hash === '#admin' && !ADMIN) setTimeout(adminLoginForm, 0);

render();
