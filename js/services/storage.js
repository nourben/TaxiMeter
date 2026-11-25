/**
 * Stockage des courses. Implémentation actuelle : localStorage (navigateur uniquement).
 * Plus tard : SupabaseCourseRepository avec les mêmes méthodes → l'interface ne change pas.
 */
const KEY = 'taximeter.courses.v1';

class LocalCourseRepository {
  async list() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? [];
    } catch {
      return [];
    }
  }

  async save(course) {
    const all = await this.list();
    const record = { id: crypto.randomUUID?.() ?? String(Date.now()), createdAt: new Date().toISOString(), ...course };
    all.unshift(record);
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      throw new Error('Impossible d’enregistrer (stockage du navigateur indisponible).');
    }
    return record;
  }

  async clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* rien */
    }
  }
}

export const courses = new LocalCourseRepository();
