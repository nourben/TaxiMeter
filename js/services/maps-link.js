/** Lien Google Maps vers l'itinéraire en voiture (sans clé API). */
export function googleMapsDirectionsUrl(origin, destination) {
  const params = new URLSearchParams({
    api: '1',
    origin: origin.trim(),
    destination: destination.trim(),
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
