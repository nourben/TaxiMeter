/**
 * Couche d'abstraction itinéraire — SQUELETTE, pas encore branché.
 *
 * Objectif : l'interface ne connaît que `getRoutes(origin, destination, { departAt })`.
 * Chaque fournisseur (Google Routes, TomTom…) implémente le même contrat et renvoie
 * des itinéraires normalisés : [{ distanceKm, durationMin, provider, polyline? }].
 *
 * Bascule prévue : Google tant que le quota gratuit n'est pas atteint, puis TomTom.
 * Si un seul fournisseur est configuré, on n'utilise que lui.
 * Les clés API ne doivent PAS être dans le front : appels à faire passer par une
 * fonction serveur (ex. Supabase Edge Function) qui compte aussi le quota.
 */

/** @typedef {{ distanceKm:number, durationMin:number, provider:string }} NormalizedRoute */

const providers = []; // ex. [googleProvider, tomtomProvider] — ordre = priorité

export function registerProvider(provider) {
  providers.push(provider);
}

/** @returns {Promise<NormalizedRoute[]>} */
export async function getRoutes(origin, destination, options = {}) {
  for (const provider of providers) {
    if (await provider.isAvailable()) {
      return provider.getRoutes(origin, destination, options);
    }
  }
  throw new Error('Aucun fournisseur d’itinéraire disponible — saisie manuelle de la distance.');
}

export function hasRoutingProvider() {
  return providers.length > 0;
}
