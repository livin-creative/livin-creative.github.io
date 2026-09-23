const kitsManifestPath = '/kits-library/manifest.json';
async function loadKitsManifest() {
  const response = await fetch(kitsManifestPath);

  if (!response.ok) {
    throw new Error(`Failed to load ${kitsManifestPath}`);
  }

  return response.json();
}

async function loadKits() {
  const manifest = await loadKitsManifest();

  const results = await Promise.all(
    manifest.filter(item => item.active).map(async ({ path }) => {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        return await response.json();
      } catch (error) {
        console.warn('Skipping kit file:', path, error);
        return [];
      }
    })
  );

  return results
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

function createKitCard(kit) {
  const article = document.createElement('article');
  article.className = 'product-card';

  const indexClasses = ['product-index'];
  if (kit.type === 'date-night') {
    indexClasses.push('date-night');
  }

  article.innerHTML = `
    <div class="product-card-content">
      <div class="${indexClasses.join(' ')}">${kit.typeLabel}</div>
      <h3>${kit.name}</h3>
      <p>${kit.description}</p>
    </div>
    <img
      class="product-card-image"
      src="${kit.image}"
      alt="${kit.imageAlt || kit.name}"
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width="400"
      height="400"
    >
  `;

  return article;
}

async function initKits() {
  const container = document.getElementById('kits-container');
  const empty = document.getElementById('kits-empty');

  const kits = await loadKits();

  if (kits.length === 0) {
    empty.hidden = false;
    return;
  }

  kits.forEach(kit => {
    container.appendChild(createKitCard(kit));
  });
}

initKits().catch(error => {
  console.error('Kit loading failed:', error);
  document.getElementById('kits-empty').hidden = false;
});
