const eventsManifestPath = '/events-library/manifest.json';
const EVENTS_PER_ROW = 6;
const DEFAULT_TIME_ZONE = 'America/New_York';

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#e9c8f5"/><path d="M40 150l35-45 25 30 20-25 40 40z" fill="#bb44dd" opacity=".55"/><circle cx="145" cy="65" r="16" fill="#fff" opacity=".8"/></svg>');

const escapeDangerousCharacters = text =>
  String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function parseWallClock(text) {
  const [year, month, day, hour = 0, minute = 0] = String(text).match(/\d+/g).map(Number);
  return { year, month, day, hour, minute };
}

const wallToDate = w => new Date(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute));

function zonedToInstant(w, timeZone) {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric'
  }).formatToParts(new Date(guess));
  const get = type => +parts.find(p => p.type === type).value;
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess - (shown - guess));
}

const formatWall = (w, options) =>
  wallToDate(w).toLocaleString('en-US', { timeZone: 'UTC', ...options });

const formatLongDate = w => formatWall(w, { weekday: 'long', month: 'long', day: 'numeric' });
const formatClock = w =>
  formatWall(w, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase();

function formatWhen(startWall, endWall) {
  if (!endWall) return `${formatLongDate(startWall)} · ${formatClock(startWall)}`;
  const sameDay =
    startWall.year === endWall.year &&
    startWall.month === endWall.month &&
    startWall.day === endWall.day;
  return sameDay
    ? `${formatLongDate(startWall)} · ${formatClock(startWall)}–${formatClock(endWall)}`
    : `${formatLongDate(startWall)} · ${formatClock(startWall)}–${formatLongDate(endWall)} · ${formatClock(endWall)}`;
}

async function loadEventManifest() {
  const response = await fetch(eventsManifestPath);
  if (!response.ok) throw new Error(`Failed to load ${eventsManifestPath}`);
  return response.json();
}

function prepareEvent(event) {
  const timeZone = event.timeZone || DEFAULT_TIME_ZONE;
  const startWall = parseWallClock(event.start);
  const endWall = event.end ? parseWallClock(event.end) : null;
  return {
    ...event,
    timeZone,
    startWall,
    endWall,
    startInstant: zonedToInstant(startWall, timeZone),
    endInstant: endWall ? zonedToInstant(endWall, timeZone) : null
  };
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
    .filter(event => event && event.start)
    .map(prepareEvent)
    .filter(event => !Number.isNaN(event.startInstant.getTime()))
    .sort((a, b) => a.startInstant - b.startInstant);
}

function formatEvent(event) {
  const formatted = {
    ...event,
    day: formatWall(event.startWall, { day: 'numeric' }),
    month: formatWall(event.startWall, { month: 'short' }),
    when: formatWhen(event.startWall, event.endWall)
  };
  Object.keys(formatted).forEach(key => {
    if (typeof formatted[key] === 'string') {
      formatted[key] = escapeDangerousCharacters(formatted[key]);
    }
  });
  return formatted;
}

const detailHTML = e => `
  <div class="event-detail-top">
    <div class="event-heading">
      ${e.label ? `<p class="event-label">${e.label}</p>` : ''}
      <h3>${e.name}</h3>
      <h4 class="event-when">${e.when}</h4>
    </div>
    <div class="event-side">
      <div class="event-meta">
        <p class="event-where">${e.mapquestUrl
          ? `<a href="${e.mapquestUrl}" target="_blank" rel="noopener noreferrer">${e.address}</a>`
          : (e.address || '')}</p>
        ${e.presenter ? `<p class="event-who">${e.presenter}</p>` : ''}
      </div>
    </div>
  </div>
  <div class="event-body">
    <div class="event-media">
      <img
        src="${e.imageUrl || 'https://placehold.co/400x300/e9c8f5/bb44dd?text=Event'}"
        alt="${e.name}"
        title="${e.attribution || e.name}"
        loading="lazy"
        decoding="async"
      >
    </div>
    <p class="event-desc">${e.description || ''}</p>
  </div>
  ${e.registrationUrl ? `
    <div class="event-footer">
      <a class="event-register event-register--is-warm" href="${e.registrationUrl}" target="_blank" rel="noopener noreferrer">
        <span>Register <span class="event-register-extra-narrow">Here</span><span class="event-register-extra-wide">for this class</span></span>
        <span class="event-register-arrow" aria-hidden="true">→</span>
      </a>
    </div>
  ` : ''}
`;

async function initEvents() {
  const events = await loadEvents();
  const now = new Date();
  const upcomingEvents = events
    .filter(e => (e.endInstant || e.startInstant) >= now)
    .map(formatEvent);

  const container = document.getElementById('events-container');
  const noEvents = document.getElementById('no-events');

  if (upcomingEvents.length === 0) {
    noEvents.style.display = '';
    return;
  }

  container.style.setProperty('--n', Math.min(EVENTS_PER_ROW, upcomingEvents.length));

  container.removeAttribute('role');
  container.innerHTML = `
    <section class="event-panel" id="event-panel" aria-live="polite" hidden></section>
    <div class="event-tiles" role="list">${upcomingEvents.map((e, i) => `
      <article class="event-tile" role="listitem" tabindex="0" data-index="${i}"
               aria-controls="event-panel" aria-pressed="false"
               aria-label="${e.name}, ${e.when}. Show details">
        <div class="event-date"><span class="event-day">${e.day}</span><span class="event-month">${e.month}</span></div>
        <p class="event-name">${e.name}</p>
      </article>`).join('')}
    </div>`;

  const panel = container.querySelector('.event-panel');

  function setSelected(tile) {
    container.querySelectorAll('.event-tile').forEach(t => {
      const on = t === tile;
      t.classList.toggle('is-selected', on);
      t.setAttribute('aria-pressed', on);
    });
    panel.innerHTML = detailHTML(upcomingEvents[Number(tile.dataset.index)]);
    panel.hidden = false;
  }

  container.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && !img.src) img.src = PLACEHOLDER_IMG;
  }, true);

  container.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const tile = e.target.closest('.event-tile');
    if (tile && !tile.classList.contains('is-selected')) setSelected(tile);
  });

  container.addEventListener('keydown', e => {
    const tile = e.target.closest('.event-tile');
    if (tile && e.target === tile && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (!tile.classList.contains('is-selected')) setSelected(tile);
    }
  });

  setSelected(container.querySelector('.event-tile'));
}

initEvents().catch(error => {
  console.error('Event loading failed:', error);
  document.getElementById('no-events').style.display = '';
});
