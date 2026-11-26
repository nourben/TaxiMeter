// Page Confidentialité : refuser ou réactiver la mesure d'audience.
import { isOptedOut, setOptOut } from '../services/visits.js';

const btn = document.getElementById('audience-toggle');
const state = document.getElementById('audience-state');

function paint() {
  const out = isOptedOut();
  btn.textContent = out ? 'Accepter d’être compté' : 'Ne plus être compté';
  state.textContent = out ? 'Vos visites ne sont pas comptées.' : 'Vos visites sont comptées de façon anonyme.';
}

btn.addEventListener('click', () => {
  setOptOut(!isOptedOut());
  paint();
});
paint();
