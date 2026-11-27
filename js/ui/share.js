// Bouton « Partager » du module Prix estimé : image générée + texte prêt à poster + lien
// qui rouvre le calcul. Deux usages : envoyer l'estimation, ou proposer la course à des confrères.

import { drawShareImage } from './share-image.js';

const ICON_SHARE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

/**
 * @param {object} o
 * @param {HTMLElement} o.anchor   élément après lequel placer le bouton (bas du module prix)
 * @param {() => object|null} o.snapshot  données de partage, ou null s'il n'y a pas de prix
 * @param {(msg:string) => void} o.toast
 * @returns {{ refresh: (hasPrice:boolean) => void }}
 */
export function attachShare({ anchor, snapshot, toast }) {
  const wrap = document.createElement('div');
  wrap.className = 'share-wrap hidden';
  wrap.innerHTML = `
    <button type="button" class="share-btn" aria-haspopup="menu" aria-expanded="false">${ICON_SHARE}<span>Partager</span></button>
    <div class="share-menu hidden" role="menu">
      <button type="button" role="menuitem" data-kind="estimate"><strong>Envoyer l’estimation</strong><small>Prix et détail du calcul</small></button>
      <button type="button" role="menuitem" data-kind="course"><strong>Proposer la course</strong><small>À un confrère : « ça intéresse quelqu’un ? »</small></button>
    </div>`;
  anchor.insertAdjacentElement('afterend', wrap);
  const btn = wrap.querySelector('.share-btn');
  const menu = wrap.querySelector('.share-menu');
  let prepared = null; // { estimate: {file, text}, course: {file, text} }

  function close() {
    menu.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  }

  // Les images sont préparées dès l'ouverture du menu : le partage part ensuite tout de suite au toucher
  // (Safari refuse le partage s'il arrive trop longtemps après le geste).
  async function prepare() {
    const snap = snapshot();
    if (!snap) return null;
    const out = {};
    for (const kind of ['estimate', 'course']) {
      const blob = await drawShareImage({ ...snap.image, kind });
      out[kind] = {
        file: new File([blob], kind === 'course' ? 'taximeter-course.png' : 'taximeter-estimation.png', { type: 'image/png' }),
        text: snap.text(kind),
      };
    }
    return out;
  }

  btn.addEventListener('click', async () => {
    if (!menu.classList.contains('hidden')) return close();
    menu.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    prepared = null;
    prepared = await prepare();
  });

  menu.addEventListener('click', async (e) => {
    const item = e.target.closest('[data-kind]');
    if (!item) return;
    const kind = item.dataset.kind;
    const ready = prepared ?? (await prepare());
    close();
    if (!ready) return;
    const { file, text } = ready[kind];
    // Texte copié aussi : certaines applis ne reprennent que l'image
    navigator.clipboard?.writeText(text).catch(() => {});
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // partage annulé
      }
    }
    // Ordinateur ou navigateur sans partage de fichiers : téléchargement de l'image + texte copié
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast('Image téléchargée et texte copié : collez-les dans votre message.');
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });

  return {
    refresh(has) {
      wrap.classList.toggle('hidden', !has);
      if (!has) close();
    },
  };
}
