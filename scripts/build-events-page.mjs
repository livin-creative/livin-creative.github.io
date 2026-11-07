#!/usr/bin/env node
// Builds events/index.html as plain HTML from events-library, so Safari Reader
// can read the schedule without waiting for JavaScript.
// Run from the repo root:  node scripts/build-events-page.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const TZ = 'America/New_York';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Event times are wall-clock values in the event's own time zone, so format them without converting.
const parts = iso => {
  const [d, t = '00:00'] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return { y, m, day, h, min, date: d };
};
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDate = p => `${DAYS[new Date(Date.UTC(p.y, p.m - 1, p.day)).getUTCDay()]}, ${MONTHS[p.m - 1]} ${p.day}`;
const clock = p => `${p.h % 12 || 12}:${String(p.min).padStart(2, '0')}${p.h < 12 ? 'am' : 'pm'}`;
const when = (s, e) => !e ? `${longDate(s)} · ${clock(s)}`
  : s.date === e.date ? `${longDate(s)} · ${clock(s)}-${clock(e)}`
  : `${longDate(s)} · ${clock(s)}-${longDate(e)} · ${clock(e)}`;

const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
const manifest = JSON.parse(readFileSync(join(root, 'events-library/manifest.json'), 'utf8'));
const events = manifest.filter(i => i.active).flatMap(({ path }) => {
  try { return [JSON.parse(readFileSync(join(root, path.replace(/^\//, '')), 'utf8'))].flat(); }
  catch (err) { console.warn('Skipping', path, err.message); return []; }
})
  .filter(e => e && e.start)
  .filter(e => parts(e.end || e.start).date >= today)
  .sort((a, b) => a.start.localeCompare(b.start));

// Read pixel size from PNG/JPEG headers so each <img> can carry width/height
// attributes that already fit the 400px height limit (Reader may honour these).
const imageSize = file => {
  try {
    const b = readFileSync(file);
    if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        const marker = b[i + 1], len = b.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
          return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + len;
      }
    }
  } catch {}
  return null;
};
const MAX_IMG_H = 400;
const sizeAttrs = url => {
  if (!url || /^https?:/.test(url)) return '';
  const s = imageSize(join(root, url.replace(/^\.?\//, '')));
  if (!s) return '';
  const scale = Math.min(1, MAX_IMG_H / s.h);
  return ` width="${Math.round(s.w * scale)}" height="${Math.round(s.h * scale)}"`;
};

const imgSrc = url => url ? esc(url.replace(/^\.\//, '/')) : '';
const item = e => {
  const s = parts(e.start), en = e.end ? parts(e.end) : null;
  return `
      <section class="schedule-item">
        <h2>${esc(e.name)}</h2>
        <p class="schedule-when">${esc(when(s, en))}${e.label ? `<br>
        <span class="schedule-label">${esc(e.label)}</span>` : ''}</p>${e.address ? `
        <p class="schedule-where">${e.mapquestUrl ? `<a href="${esc(e.mapquestUrl)}">${esc(e.address)}</a>` : esc(e.address)}</p>` : ''}${e.presenter ? `
        <p class="schedule-who">Presented by ${esc(e.presenter)}</p>` : ''}${e.imageUrl ? `
        <figure class="schedule-figure">
          <img src="${imgSrc(e.imageUrl)}" alt="${esc(e.name)}"${sizeAttrs(e.imageUrl)} loading="lazy">${e.attribution ? `
          <figcaption>${esc(e.attribution)}</figcaption>` : ''}
        </figure>` : ''}${e.description ? `
        <p class="schedule-desc">${esc(e.description)}</p>` : ''}${e.registrationUrl ? `
        <p><a href="${esc(e.registrationUrl)}">Register for ${esc(e.name)}</a></p>` : ''}
        <hr class="schedule-end">
      </section>`;
};

const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Events Schedule - Livin Creative</title>
  <meta name="description" content="Upcoming Livin Creative craft workshops, markets, and hands-on art events.">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Livin Creative">
  <meta property="og:title" content="Events Schedule - Livin Creative">
  <link rel="icon" type="image/svg+xml" href="../favicon.svg">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800;900&display=swap">
  <link rel="stylesheet" href="../styles/main.css">
  <style>
    .events-page { max-width: 46rem; margin: 0 auto; padding: 3rem 1.25rem; }
    .events-page h1 { max-width: none; margin-bottom: 1rem; }
    .events-page .schedule-figure { margin: 0 0 0.75rem; }
    .events-page .schedule-figure img { display: block; max-width: 30%; max-height: 400px; width: auto; height: auto; border-radius: 12px; }
    .events-page .schedule-figure figcaption { margin-top: 0.35rem; font-size: 0.8rem; color: var(--text-muted); }
    .events-page .schedule-label { display: inline-block; }
    /* Divider is for Reader only: on the page it's just whitespace */
    .events-page .schedule-end { border: 0; height: 0; margin: 1.5rem 0 0; }
  </style>
</head>
<body>
  <main id="events-main" class="events-page">
    <article class="panel info-card copy-block">
      <h1>Events Schedule</h1>
      <p>Join us at upcoming craft workshops, markets, and hands-on art events. Each listing below includes the date, time, location, and how to sign up.</p>${events.length ? events.map(item).join('') : `
      <p>No upcoming events at this time. Check back soon!</p>`}
    </article>
  </main>
</body>
</html>
`;

mkdirSync(join(root, 'events'), { recursive: true });
writeFileSync(join(root, 'events/index.html'), html);
console.log(`Wrote events/index.html with ${events.length} upcoming event(s) as of ${today}.`);
