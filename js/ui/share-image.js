// Image de partage d'une course ou d'une estimation, dessinée dans le navigateur (canvas) :
// aucun serveur, aucun service payant. Format portrait 1080 px de large, adapté à WhatsApp.

import qrcode from '../vendor/qrcode.js';

const W = 1080;
const PAD = 72;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const C = {
  bg: '#f6f4ef',
  card: '#ffffff',
  text: '#1b1b1f',
  muted: '#6b6b74',
  line: '#ececec',
  accent: '#f5b400',
  chip: '#f0eee8',
  chipOn: '#fff1c2',
  dark: '#1b1b1f',
};

const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

function roundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/** Coupe un texte trop long avec « … ». */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Pastilles sur plusieurs lignes ; renvoie la hauteur utilisée. */
function chips(ctx, items, x, y, maxWidth, draw = true) {
  ctx.font = font(27, 600);
  const h = 54;
  let cx = x;
  let cy = y;
  for (const { text, on } of items) {
    const w = Math.min(ctx.measureText(text).width + 36, maxWidth);
    if (cx > x && cx + w > x + maxWidth) {
      cx = x;
      cy += h + 14;
    }
    if (draw) {
      roundRect(ctx, cx, cy, w, h, 14, on ? C.chipOn : C.chip);
      ctx.fillStyle = C.text;
      ctx.textBaseline = 'middle';
      ctx.fillText(fit(ctx, text, w - 36), cx + 18, cy + h / 2 + 1);
    }
    cx += w + 14;
  }
  return items.length ? cy - y + h : 0;
}

function qrModules(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q;
}

/**
 * @param {object} d
 * @param {'course'|'estimate'} d.kind
 * @param {Array<{from:string,to:string,chips:Array<{text:string,on?:boolean}>}>} d.trips
 * @param {string} d.total            ex. « 39,38 € »
 * @param {Array<[string,string]>} d.lines  détail [libellé, montant]
 * @param {string} d.link
 * @param {string} d.linkLabel        adresse courte affichée sous le QR code
 * @returns {Promise<Blob>}
 */
export async function drawShareImage(d) {
  const measure = document.createElement('canvas').getContext('2d');
  const innerW = W - PAD * 2;
  const trips = d.trips.slice(0, 3);
  const extra = d.trips.length - trips.length;

  // Hauteur de chaque bloc trajet (pastilles sur une ou plusieurs lignes)
  const tripHeights = trips.map((t) => 210 + (t.chips.length ? chips(measure, t.chips, 0, 0, innerW - 80, false) + 30 : 0));
  const routeH = tripHeights.reduce((a, b) => a + b, 0) + (trips.length - 1) * 2 + (extra ? 50 : 0) + 30;
  const priceH = 150 + d.lines.length * 56 + 20;
  const H = Math.max(1080, 70 + 76 + 46 + routeH + 28 + priceH + 70 + 170 + 70);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // En-tête : logo, nom, pastille du type de partage
  let y = 70;
  roundRect(ctx, PAD, y, 76, 76, 18, C.accent);
  ctx.fillStyle = C.text;
  ctx.font = font(31, 800);
  ctx.textAlign = 'center';
  ctx.fillText('TX', PAD + 38, y + 49);
  ctx.textAlign = 'left';
  ctx.font = font(40, 800);
  ctx.fillText('TaxiMeter', PAD + 94, y + 52);
  const kindText = d.kind === 'course' ? 'Course disponible' : 'Estimation';
  ctx.font = font(28, 700);
  const kw = ctx.measureText(kindText).width + 52;
  roundRect(ctx, W - PAD - kw, y + 9, kw, 58, 29, C.dark);
  ctx.fillStyle = '#fff';
  ctx.fillText(kindText, W - PAD - kw + 26, y + 48);
  y += 76 + 46;

  // Trajets
  roundRect(ctx, PAD, y, innerW, routeH, 28, C.card);
  let ty = y + 40;
  trips.forEach((t, i) => {
    const x = PAD + 40;
    if (i > 0) {
      ctx.fillStyle = C.line;
      ctx.fillRect(x, ty - 20, innerW - 80, 2);
      ty += 10;
    }
    // Départ
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x + 11, ty + 22, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.font = font(40, 700);
    ctx.fillText(fit(ctx, t.from || 'Départ', innerW - 140), x + 44, ty + 36);
    // Liaison
    ctx.fillStyle = '#ddd';
    ctx.fillRect(x + 9, ty + 46, 4, 40);
    // Destination
    roundRect(ctx, x, ty + 96, 22, 22, 5, C.accent);
    ctx.fillStyle = C.text;
    ctx.fillText(fit(ctx, t.to || 'Destination', innerW - 140), x + 44, ty + 122);
    ty += 160;
    if (t.chips.length) ty += chips(ctx, t.chips, x, ty, innerW - 80) + 30;
    ty += 20;
  });
  if (extra) {
    ctx.fillStyle = C.muted;
    ctx.font = font(27, 600);
    ctx.fillText(`+ ${extra} autre${extra > 1 ? 's' : ''} trajet${extra > 1 ? 's' : ''}`, PAD + 40, ty + 10);
  }
  y += routeH + 28;

  // Prix
  roundRect(ctx, PAD, y, innerW, priceH, 28, C.card, C.accent, 4);
  ctx.fillStyle = C.text;
  ctx.font = font(36, 700);
  ctx.fillText(d.trips.length > 1 ? 'Prix total' : 'Prix estimé', PAD + 44, y + 104);
  ctx.font = font(92, 800);
  ctx.textAlign = 'right';
  ctx.fillText(d.total, W - PAD - 44, y + 112);
  ctx.textAlign = 'left';
  let ly = y + 150;
  for (const [label, amount] of d.lines) {
    ctx.fillStyle = C.line;
    ctx.fillRect(PAD + 44, ly, innerW - 88, 2);
    ctx.fillStyle = C.text;
    ctx.font = font(28, 400);
    ctx.fillText(fit(ctx, label, innerW - 320), PAD + 44, ly + 38);
    ctx.font = font(28, 700);
    ctx.textAlign = 'right';
    ctx.fillText(amount, W - PAD - 44, ly + 38);
    ctx.textAlign = 'left';
    ly += 56;
  }
  y += priceH;

  // Pied : QR code + adresse
  const qr = qrModules(d.link);
  const n = qr.getModuleCount();
  const size = 170;
  const fy = H - 70 - size;
  roundRect(ctx, PAD, fy, size, size, 14, '#fff');
  const cell = (size - 20) / n;
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(PAD + 10 + c * cell, fy + 10 + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
  ctx.fillStyle = C.text;
  ctx.font = font(31, 700);
  ctx.fillText('Scannez pour ouvrir ce calcul', PAD + size + 30, fy + 62);
  ctx.fillStyle = C.muted;
  ctx.font = font(27, 400);
  ctx.fillText(fit(ctx, d.linkLabel, innerW - size - 30), PAD + size + 30, fy + 104);
  ctx.fillText('Estimation indicative · tarifs convention Sécu 2025', PAD + size + 30, fy + 140);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
