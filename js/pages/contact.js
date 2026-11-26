import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TURNSTILE_SITE_KEY } from '../config/supabase.js';

const $ = (id) => document.getElementById(id);
const form = $('contact-form');
const msg = $('c-msg');
const submit = $('c-submit');
const MAX_FILE = 5 * 1024 * 1024;

$('c-started').value = String(Date.now());

// Anti-robot Cloudflare Turnstile, seulement si une clé de site est configurée
if (TURNSTILE_SITE_KEY) {
  const box = $('c-turnstile');
  box.classList.remove('hidden');
  box.innerHTML = `<div class="cf-turnstile" data-sitekey="${TURNSTILE_SITE_KEY}" data-language="fr"></div>`;
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  s.async = true;
  document.head.appendChild(s);
}

function show(text, type) {
  msg.textContent = text;
  msg.className = `form-msg ${type}`;
}

function validate() {
  const email = $('c-email').value.trim();
  const phone = $('c-phone').value.trim();
  if (!email && !phone) return ['Indiquez un e-mail ou un téléphone pour qu’on puisse vous répondre.', 'c-email'];
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return ['L’adresse e-mail semble incorrecte.', 'c-email'];
  if (phone && phone.replace(/\D/g, '').length < 9) return ['Le numéro de téléphone semble incorrect.', 'c-phone'];
  if (!$('c-subject').value.trim()) return ['Indiquez un sujet.', 'c-subject'];
  if ($('c-message').value.trim().length < 5) return ['Écrivez votre message.', 'c-message'];
  const file = $('c-file').files[0];
  if (file && file.size > MAX_FILE) return ['La pièce jointe dépasse 5 Mo.', 'c-file'];
  return null;
}

// Bouton « Retirer » à côté de la pièce jointe
const fileInput = $('c-file');
const fileClear = $('c-file-clear');
const syncFileClear = () => fileClear.classList.toggle('hidden', !fileInput.files.length);
fileInput.addEventListener('change', syncFileClear);
fileClear.addEventListener('click', () => {
  fileInput.value = '';
  syncFileClear();
  fileInput.focus();
});

form.addEventListener('input', () => {
  if (msg.classList.contains('is-error')) show('', 'hidden');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = validate();
  if (error) {
    show(error[0], 'is-error');
    $(error[1]).focus();
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Envoi en cours…';
  show('', 'hidden');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/contact`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      body: new FormData(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Envoi impossible pour le moment.');
    form.reset();
    syncFileClear();
    $('c-started').value = String(Date.now());
    if (window.turnstile) window.turnstile.reset();
    show('Merci, votre message a bien été envoyé. Nous vous répondrons rapidement.', 'is-ok');
  } catch (err) {
    show(err.message || 'Envoi impossible pour le moment, réessayez plus tard.', 'is-error');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Envoyer';
  }
});
