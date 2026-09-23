(() => {
  const imageUrls = [
    './_images/image_22.png',
    './_images/image_23.png',
    './_images/image_24.png',
    './_images/image_25.png',
    './_images/image_26.png',
    './_images/image_29.png',
    './_images/image_30.png',
    './_images/image_31.png',
    './_images/image_32.png',
    './_images/image_33.png',
    './_images/image_36.png',
    './_images/image_37.png',
    './_images/image_38.png',
    './_images/image_39.png',
    './_images/image_40.png',
    './_images/image_41.png'
  ];

  const imgA = document.getElementById('rotatorImageA');
  const imgB = document.getElementById('rotatorImageB');

  if (!imgA || !imgB || imageUrls.length === 0) return;

  for (let i = imageUrls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [imageUrls[i], imageUrls[j]] = [imageUrls[j], imageUrls[i]];
  }

  const cache = new Map();

  function load(src) {
    if (!cache.has(src)) {
      const p = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
        cache.set(src, img);
      });

      cache.set(src + '::p', p);
      return p;
    }

    return cache.get(src + '::p') || Promise.resolve();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function runRotator() {
    let idx = 0;
    let onLayerA = true;
    const INTERVAL = 1800;

    imgA.setAttribute('href', imageUrls[0]);
    imgA.setAttribute('xlink:href', imageUrls[0]);
    imgA.style.opacity = '1';
    imgB.style.opacity = '0';

    while (true) {
      const nextIdx = (idx + 1) % imageUrls.length;
      const nextSrc = imageUrls[nextIdx];

      await Promise.all([
        wait(INTERVAL),
        load(nextSrc)
      ]);

      for (let i = 2; i <= 4; i++) {
        load(imageUrls[(nextIdx + i - 1) % imageUrls.length]);
      }

      const incoming = onLayerA ? imgB : imgA;
      const outgoing = onLayerA ? imgA : imgB;

      incoming.setAttribute('href', nextSrc);
      incoming.setAttribute('xlink:href', nextSrc);
      incoming.style.opacity = '1';
      outgoing.style.opacity = '0';

      idx = nextIdx;
      onLayerA = !onLayerA;
    }
  }

  runRotator();
})();
