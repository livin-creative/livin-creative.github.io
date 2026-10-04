const eventsManifestPath = '/events-library/manifest.json';
const MAX_EVENTS = 8;

async function loadEventManifest() {
  const response = await fetch(eventsManifestPath);
  if (!response.ok) throw new Error(`Failed to load ${eventsManifestPath}`);
  return response.json();
}

async function loadEvents() {
  const manifest = await loadEventManifest();
  const results = await Promise.all(
    manifest.filter(item => item.active).map(async ({ path }) => {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        return await response.json();
      } catch (error) {
        console.warn('Skipping event file:', path, error);
        return [];
      }
    })
  );
  return results
    .flat()
    .map(event => ({ ...event, date: new Date(event.date) }))
    .filter(event => !Number.isNaN(event.date.getTime()))
    .sort((a, b) => a.date - b.date);
}
// Shown when an event has no imageUrl, or the image fails to load.
const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#e9c8f5"/><path d="M40 150l35-45 25 30 20-25 40 40z" fill="#bb44dd" opacity=".55"/><circle cx="145" cy="65" r="16" fill="#fff" opacity=".8"/></svg>');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function initEvents() {
  const events = await loadEvents();
  const now = new Date();
  const upcoming = events.filter(e => e.date >= now).slice(0, MAX_EVENTS);

  const container = document.getElementById('events-container');
  const noEvents = document.getElementById('no-events');

  if (upcoming.length === 0) {
    noEvents.style.display = '';
    return;
  }

  const tz = 'America/New_York';
  const fullFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' });
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' });
  const monFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short' });

  container.style.setProperty('--n', upcoming.length);
  container.innerHTML = upcoming.map((ev, i) => `
    <article class="ev-tile${i === 0 ? ' is-next' : ''}" role="listitem" tabindex="0"
             aria-expanded="false" aria-label="${esc(ev.name)}, ${esc(fullFmt.format(ev.date))}. Show details">
      <div class="ev-date ev-summary"><span class="ev-day">${dayFmt.format(ev.date)}</span><span class="ev-mon">${monFmt.format(ev.date)}</span></div>
      <p class="ev-name ev-summary">${esc(ev.name)}</p>
      <div class="ev-detail">
        <div class="ev-detail-top">
          <div>
            ${ev.label ? `<p class="ev-label">${esc(ev.label)}</p>` : ''}
            <h3>${esc(ev.name)}</h3>
          </div>
          <button class="ev-close" type="button" aria-label="Close details">&times;</button>
        </div>
        <div class="ev-grid">
          <div class="ev-pill"><span>Date</span><strong>${esc(fullFmt.format(ev.date))}</strong></div>
          <div class="ev-pill"><span>Presenter</span><strong>${esc(ev.presenter)}</strong></div>
          <div class="ev-pill"><span>Address</span><strong>${ev.mapquestUrl
            ? `<a href="${esc(ev.mapquestUrl)}" target="_blank" rel="noopener noreferrer">${esc(ev.address)}</a>`
            : esc(ev.address)}</strong></div>
        </div>
        <div class="ev-body">
          <p class="ev-desc">${esc(ev.description)}</p>
          <div class="ev-media">
            <img
              src="${esc(ev.imageUrl || 'https://placehold.co/400x300/e9c8f5/bb44dd?text=Event')}"
              alt="${esc(ev.name)}"
              loading="lazy"
              decoding="async"
            >
          </div>
        </div>

        <!-- <p class="ev-desc">${esc(ev.description)}</p> -->
      </div>
    </article>`).join('');

  function setOpen(tile) {
    container.querySelectorAll('.ev-tile').forEach(t => {
      const on = t === tile;
      t.classList.toggle('is-open', on);
      t.setAttribute('aria-expanded', on);
    });
    container.classList.toggle('has-open', !!tile);
  }
  container.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.src !== PLACEHOLDER_IMG) img.src = PLACEHOLDER_IMG;
  }, true);
  container.addEventListener('click', e => {
    const tile = e.target.closest('.ev-tile');
    if (!tile || e.target.closest('a')) return;
    if (e.target.closest('.ev-close')) { setOpen(null); tile.focus(); return; }
    if (!tile.classList.contains('is-open')) setOpen(tile);
  });
  container.addEventListener('keydown', e => {
    const tile = e.target.closest('.ev-tile');
    if (e.key === 'Escape') setOpen(null);
    else if (tile && e.target === tile && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (!tile.classList.contains('is-open')) setOpen(tile);
    }
  });
}

initEvents().catch(error => {
  console.error('Event loading failed:', error);
  document.getElementById('no-events').style.display = '';
});
