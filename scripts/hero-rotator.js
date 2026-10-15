(function () {
  const cfg = window.HERO_CONFIG;
  const root = document.getElementById("hero-rotator");
  if (!cfg || !root) return;

  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  const svg = el("svg", {
    class: "brand-svg", viewBox: cfg.viewBox,
    preserveAspectRatio: "xMidYMid meet", role: "img",
    "aria-label": "Livin Creative logomark"
  });

  const clip = el("clipPath", { id: "brandImageRotatorClip" });
  cfg.paths.forEach(d => clip.appendChild(el("path", { d })));
  svg.appendChild(el("defs")).appendChild(clip);

  const g = el("g", { "clip-path": "url(#brandImageRotatorClip)" });
  const [w, h] = cfg.viewBox.split(" ").slice(2);
  const imgs = cfg.images.map((src, i) => {
    const im = el("image", {
      href: src, x: 0, y: 0, width: w, height: h,
      preserveAspectRatio: "xMidYMid slice"
    });
    im.style.opacity = i === 0 ? "1" : "0";
    im.style.transition = `opacity ${cfg.fadeMs}ms ease`;
    g.appendChild(im);
    return im;
  });
  svg.appendChild(g);

  cfg.paths.forEach(d => svg.appendChild(el("path", { class: "logo-outline", d })));
  root.appendChild(svg);

  let i = 0;
  if (imgs.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => {
      imgs[i].style.opacity = "0";
      i = (i + 1) % imgs.length;
      imgs[i].style.opacity = "1";
    }, cfg.intervalMs);
  }
})();
