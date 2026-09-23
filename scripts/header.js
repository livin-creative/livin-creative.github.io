(() => {
  const header = document.querySelector('.site-header');
  const logoStage = document.querySelector('.logo-stage');

  if (!header || !logoStage) return;

  let rafPending = false;

  function updateHeaderBg() {
    const stageBounds = logoStage.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();

    header.classList.toggle('scrolled-past', stageBounds.bottom <= headerBounds.bottom);
    rafPending = false;
  }

  window.addEventListener('scroll', () => {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(updateHeaderBg);
    }
  }, { passive: true });

  updateHeaderBg();
})();
