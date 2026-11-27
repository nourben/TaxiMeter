// Lien de partage qui rouvre un calcul tout rempli : ?c=<données compactes en base64url>.
// Les km sont dans le lien : à l'ouverture, aucun appel au calcul d'itinéraire (gratuit).
// On n'y met que des noms courts (ville, établissement), jamais l'adresse exacte saisie.

const FLAGS = { hospital: 1, night: 2, metropole: 4, excluded: 8, soloLong: 16 };

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * @param {Array<{from:string,to:string,km:number,rate:number,durationMin?:number|null,departAt?:number|null,
 *   hospital:boolean,night:boolean,metropole:boolean,excluded?:boolean,soloLong?:boolean}>} trips
 * @returns {string} valeur du paramètre « c »
 */
export function encodeShare(trips) {
  const t = trips.map((x) => {
    let f = 0;
    for (const [k, bit] of Object.entries(FLAGS)) if (x[k]) f |= bit;
    return [x.from || '', x.to || '', x.km, x.rate, f, x.durationMin ?? 0, x.departAt ? Math.round(x.departAt / 60_000) : 0];
  });
  return toBase64Url(JSON.stringify({ v: 1, t }));
}

/** @returns {Array|null} trajets décodés, ou null si le lien est invalide */
export function decodeShare(value) {
  try {
    const data = JSON.parse(fromBase64Url(String(value)));
    if (data?.v !== 1 || !Array.isArray(data.t) || !data.t.length) return null;
    return data.t.slice(0, 20).map(([from, to, km, rate, f, durationMin, departMin]) => {
      const out = {
        from: String(from ?? '').slice(0, 120),
        to: String(to ?? '').slice(0, 120),
        km: Number(km),
        rate: Number(rate),
        durationMin: Number(durationMin) || null,
        departAt: Number(departMin) ? Number(departMin) * 60_000 : null,
      };
      for (const [k, bit] of Object.entries(FLAGS)) out[k] = Boolean(Number(f) & bit);
      if (!Number.isFinite(out.km) || out.km < 0 || !Number.isFinite(out.rate) || out.rate <= 0) throw new Error('invalide');
      return out;
    });
  } catch {
    return null;
  }
}

/**
 * Nom court d'un lieu pour le partage : établissement + ville, ou ville (département),
 * sans numéro ni rue.
 * @param {string} text  saisie
 * @param {{type?:string,label?:string,city?:string,postcode?:string}|null} geo  lieu reconnu
 */
export function shortPlace(text, geo) {
  const dept = (pc) => (pc ? ` (${String(pc).startsWith('97') ? pc.slice(0, 3) : pc.slice(0, 2)})` : '');
  if (geo?.type === 'poi' && geo.label) return geo.label;
  if (geo?.city) return `${geo.city}${dept(geo.postcode)}`;
  const raw = String(text || '').trim();
  // Saisie libre qui ressemble à une adresse (« 12 rue …, Ville ») : on ne garde que la fin (ville)
  if (/^\d/.test(raw) && raw.includes(',')) return raw.split(',').pop().replace(/\b\d{5}\b/, '').trim();
  return raw;
}
