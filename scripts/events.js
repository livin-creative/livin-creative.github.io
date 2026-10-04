const eventsManifestPath = '/events-library/manifest.json';
const EVENTS_PER_ROW = 6;

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
  const upcoming = events.filter(e => e.date >= now);

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
  const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
  const formatTime = value => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : timeFmt.format(parsed).replace(/\s/g, '').toLowerCase();
  };

  container.style.setProperty('--n', Math.min(EVENTS_PER_ROW, upcoming.length));

  const detailHTML = ev => `
    <div class="ev-detail-top">
      <div class="ev-heading">
        ${ev.label ? `<p class="ev-label">${esc(ev.label)}</p>` : ''}
        <h3>${esc(ev.name)}</h3>
        <h4 class="ev-when">${esc(fullFmt.format(ev.date))}${formatTime(ev.date) ? ` · ${esc(formatTime(ev.date))}${formatTime(ev.end) ? `–${esc(formatTime(ev.end))}` : ''}` : ''}</h4>
      </div>
      <div class="ev-side">
        <div class="ev-meta">
          <p class="ev-where">${ev.mapquestUrl
            ? `<a href="${esc(ev.mapquestUrl)}" target="_blank" rel="noopener noreferrer">${esc(ev.address)}</a>`
            : esc(ev.address)}</p>
          ${ev.presenter ? `<p class="ev-who">${esc(ev.presenter)}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="ev-body">
      <div class="ev-media">
        <img
          src="${esc(ev.imageUrl || 'https://placehold.co/400x300/e9c8f5/bb44dd?text=Event')}"
          alt="${esc(ev.name)}"
          title="${esc(ev.attribution || ev.name)}"
          loading="lazy"
          decoding="async"
        >
      </div>
      <p class="ev-desc">${esc(ev.description)}</p>
    </div>`;

  // Tiles stay in the grid; the details live in a separate full-width panel.
  container.removeAttribute('role');
  container.innerHTML = `
    <section class="ev-panel" id="ev-panel" aria-live="polite" hidden></section>
    <div class="ev-tiles" role="list">${upcoming.map((ev, i) => `
      <article class="ev-tile" role="listitem" tabindex="0" data-index="${i}"
               aria-controls="ev-panel" aria-pressed="false"
               aria-label="${esc(ev.name)}, ${esc(fullFmt.format(ev.date))}. Show details">
        <div class="ev-date"><span class="ev-day">${dayFmt.format(ev.date)}</span><span class="ev-mon">${monFmt.format(ev.date)}</span></div>
        <p class="ev-name">${esc(ev.name)}</p>
      </article>`).join('')}
    </div>`;

  const panel = container.querySelector('.ev-panel');

  function setSelected(tile) {
    container.querySelectorAll('.ev-tile').forEach(t => {
      const on = t === tile;
      t.classList.toggle('is-selected', on);
      t.setAttribute('aria-pressed', on);
    });
    panel.innerHTML = detailHTML(upcoming[Number(tile.dataset.index)]);
    panel.hidden = false;
  }

  container.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && !img.src) img.src = PLACEHOLDER_IMG;
  }, true);
  container.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const tile = e.target.closest('.ev-tile');
    if (tile && !tile.classList.contains('is-selected')) setSelected(tile);
  });
  container.addEventListener('keydown', e => {
    const tile = e.target.closest('.ev-tile');
    if (tile && e.target === tile && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (!tile.classList.contains('is-selected')) setSelected(tile);
    }
  });
  // Select the first (soonest) event on page load
  setSelected(container.querySelector('.ev-tile'));
}

initEvents().catch(error => {
  console.error('Event loading failed:', error);
  document.getElementById('no-events').style.display = '';
});
