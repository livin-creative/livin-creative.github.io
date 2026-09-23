(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowMemory = navigator.deviceMemory !== undefined && navigator.deviceMemory < 4;
  const lowCPU = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4;

  if (reducedMotion || lowMemory || lowCPU) return;

  const clipPaths = document.querySelectorAll('#brandImageRotatorClip path');
  const outlines = document.querySelectorAll('.logo-outline');

  if (!clipPaths.length) return;

  const NUM_FRAMES = 6;
  const AMPLITUDE = 18;
  const DURATION = '1s';

  function makeRand(seed) {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s, 1664525) + 1013904223 >>> 0;
      return (s / 0xffffffff) - 0.5;
    };
  }

  function perturbPath(d, rand) {
    return d.replace(/-?[\d.]+(?:e[+-]?\d+)?/g, n =>
      (parseFloat(n) + rand() * AMPLITUDE * 2).toFixed(2)
    );
  }

  function animatePath(el, d0, frameSeeds) {
    const variants = frameSeeds.map((seed, fi) => perturbPath(d0, makeRand(seed + fi)));
    const values = [d0, ...variants, d0].join(';');
    const n = NUM_FRAMES + 2;
    const keyTimes = Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(4)).join(';');
    const spline = '0.45 0 0.55 1';
    const keySplines = Array(n - 1).fill(spline).join(';');

    const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    anim.setAttribute('attributeName', 'd');
    anim.setAttribute('values', values);
    anim.setAttribute('dur', DURATION);
    anim.setAttribute('repeatCount', 'indefinite');
    anim.setAttribute('calcMode', 'spline');
    anim.setAttribute('keyTimes', keyTimes);
    anim.setAttribute('keySplines', keySplines);

    el.appendChild(anim);
  }

  clipPaths.forEach((cp, i) => {
    const d0 = cp.getAttribute('d');
    if (!d0) return;

    const seeds = Array.from({ length: NUM_FRAMES }, (_, fi) => (i + 1) * 31337 + fi * 7919);
    animatePath(cp, d0, seeds);

    if (outlines[i]) {
      animatePath(outlines[i], d0, seeds);
    }
  });
})();
