const eventsManifestPath = '/events-library/manifest.json';
async function loadEventManifest() {
  const response = await fetch(eventsManifestPath);

  if (!response.ok) {
    throw new Error(`Failed to load ${eventsManifestPath}`);
  }

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
    .map(event => ({
      ...event,
      date: new Date(event.date)
    }))
    .filter(event => !Number.isNaN(event.date.getTime()))
    .sort((a, b) => a.date - b.date);
}

async function initEvents() {
  const events = await loadEvents();
  console.log('events loaded:', events);

  const MAX_EVENTS = 2;
  const now = new Date();

  const upcomingEvents = events
    .filter(e => e.date >= now)
    .sort((a, b) => a.date - b.date)
    .slice(0, MAX_EVENTS);

  const container = document.getElementById('events-container');
  const noEvents = document.getElementById('no-events');

  if (upcomingEvents.length === 0) {
    noEvents.style.display = '';
    return;
  }

  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  upcomingEvents.forEach((ev, i) => {
    const dateStr = etFormatter.format(ev.date);
    const el = document.createElement('div');
    const modifiers = ['', 'event-secondary', 'event-tertiary'];

    el.className = ('event-highlight ' + (modifiers[i] ?? 'event-tertiary')).trim();
    if (i > 0) el.style.marginTop = 'var(--space-4)';
    el.setAttribute('aria-label', ev.name);

    el.innerHTML = `
      <p class="event-label">${ev.label}</p>
      <div class="event-grid">
        <div class="event-pill"><span>Event</span><strong>${ev.name}</strong></div>
        <div class="event-pill"><span>Date</span><strong>${dateStr}</strong></div>
        <div class="event-pill"><span>Presenter</span><strong>${ev.presenter}</strong></div>
        <div class="event-pill" style="grid-column:1/-1">
          <span>Address</span>
          <strong>
            <a href="${ev.mapquestUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;text-underline-offset:2px;">
              ${ev.address}
            </a>
          </strong>
        </div>
      </div>
      <p style="margin-top:12px;font-size:var(--text-sm);color:${i === 0 ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)'}">${ev.description}</p>
    `;

    container.appendChild(el);
  });
}

initEvents().catch(error => {
  console.error('Event loading failed:', error);
  document.getElementById('no-events').style.display = '';
});

