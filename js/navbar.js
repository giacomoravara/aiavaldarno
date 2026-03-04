// ============================================================
// navbar.js — AIA Sezione Valdarno
// Gestione dropdown desktop e accordion mobile
// ============================================================

/**
 * Inizializza il comportamento dei dropdown nella navbar.
 * Da chiamare dopo initNavbar() (che gestisce hamburger e ruoli).
 */
export function initDropdowns() {
  const items = document.querySelectorAll('.has-dropdown');
  if (!items.length) return;

  const isMobile = () => window.innerWidth <= 700;

  items.forEach(item => {
    const link = item.querySelector(':scope > a');
    if (!link) return;

    // Mobile: accordion toggle al click
    link.addEventListener('click', (e) => {
      if (!isMobile()) return;
      e.preventDefault();
      const isOpen = item.classList.toggle('open');
      // Chiudi gli altri
      items.forEach(other => {
        if (other !== item) other.classList.remove('open');
      });
    });
  });

  // Desktop: chiudi dropdown su click fuori
  document.addEventListener('click', (e) => {
    if (isMobile()) return;
    items.forEach(item => {
      if (!item.contains(e.target)) item.classList.remove('open');
    });
  });

  // Chiudi accordion mobile quando si ridimensiona a desktop
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      items.forEach(item => item.classList.remove('open'));
    }
  });
}
