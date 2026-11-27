// En-tête (logo + bascule de thème) et pied de page communs à toutes les pages.

const THEME_KEY = 'taximeter.theme';

const ICON_MOON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICON_SUN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

const FOOTER_LINKS = [
  { href: 'index.html', label: 'Estimer une course' },
  { href: 'stats.html', label: 'Statistiques' },
  { href: 'mentions-legales.html', label: 'Mentions légales' },
  { href: 'confidentialite.html', label: 'Confidentialité' },
  { href: 'contact.html', label: 'Contact' },
];

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* navigation privée : thème non mémorisé */
  }
}

function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  el.className = 'site-header';
  el.innerHTML = `
    <a class="brand" href="index.html" aria-label="TaxiMeter — accueil">
      <span class="brand-mark" aria-hidden="true">TX</span>
      <span>TaxiMeter</span>
    </a>
    <button class="icon-btn" type="button" id="theme-toggle"></button>`;

  const btn = el.querySelector('#theme-toggle');
  const paint = () => {
    const dark = currentTheme() === 'dark';
    btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
    btn.setAttribute('aria-label', dark ? 'Passer au thème clair' : 'Passer au thème sombre');
    btn.title = btn.getAttribute('aria-label');
  };
  btn.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    paint();
  });
  paint();
}

/** Lien « Partager le site » : menu de partage du téléphone, sinon copie du lien. */
async function shareSite(e) {
  e.preventDefault();
  const link = e.currentTarget;
  const url = new URL('./', location.href).href;
  const data = { title: 'TaxiMeter', text: 'Estimer le prix d’une course de taxi conventionné', url };
  if (navigator.share) {
    try {
      await navigator.share(data);
    } catch {
      /* partage annulé */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    link.textContent = 'Lien copié ✓';
  } catch {
    link.textContent = url;
  }
  setTimeout(() => (link.textContent = 'Partager le site'), 2500);
}

function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  const here = location.pathname.split('/').pop() || 'index.html';
  el.className = 'site-footer';
  el.innerHTML = `
    <nav aria-label="Liens de pied de page">
      ${FOOTER_LINKS.map(
        (l) =>
          `<a href="${l.href}"${l.href === here ? ' aria-current="page"' : ''}${l.external ? ' target="_blank" rel="noopener"' : ''}>${l.label}</a>`,
      ).join('')}
    </nav>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} TaxiMeter</span><a href="./" class="share-site" id="share-site">Partager le site</a></div>`;
  el.querySelector('#share-site').addEventListener('click', shareSite);
}

renderHeader();
renderFooter();

// Nouvelle version en ligne : rechargement automatique (utile en mode app sur l'écran d'accueil)
import('./auto-update.js').then((m) => m.startAutoUpdate()).catch(() => {});

// Mesure d'audience anonyme (chargée à part : une erreur ne doit pas casser la page)
import('../services/visits.js').then((m) => m.trackPageView()).catch(() => {});
