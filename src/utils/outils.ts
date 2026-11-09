import mongoose from 'mongoose';
import { ErreurHttp } from '../services/erreurs';

/** Échappe une saisie utilisateur avant de l'utiliser dans une RegExp (évite ReDoS / injection de regex). */
export function echapperRegex(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Liste blanche de champs : protège contre l'assignation de masse
 * (ex : un étudiant qui enverrait { role: "admin" } dans son formulaire de profil).
 */
// Les valeurs restent non typées (any) : c'est Mongoose qui les convertit et les valide ensuite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function choisir<T extends object, K extends string>(source: T, champs: readonly K[]): Partial<Record<K, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultat: Partial<Record<K, any>> = {};
  for (const champ of champs) {
    if (Object.prototype.hasOwnProperty.call(source, champ)) {
      resultat[champ] = (source as Record<string, unknown>)[champ];
    }
  }
  return resultat;
}

export const estIdValide = (id: unknown): id is string =>
  typeof id === 'string' && mongoose.isValidObjectId(id) && /^[a-f0-9]{24}$/i.test(id);

/** Lit une chaîne simple depuis req.query / req.body (ignore les tableaux et objets injectés). */
export function texte(valeur: unknown): string | undefined {
  return typeof valeur === 'string' ? valeur.trim() : undefined;
}

export function entierPositif(valeur: unknown, defaut: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number.parseInt(String(valeur ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : defaut;
}

/** Convertit n'importe quelle erreur (Mongoose, Mongo, métier) en ErreurHttp homogène. */
export function normaliserErreur(err: unknown): ErreurHttp {
  if (err instanceof ErreurHttp) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string> = {};
    for (const [champ, e] of Object.entries(err.errors)) {
      details[champ] =
        e instanceof mongoose.Error.CastError ? `Valeur invalide pour « ${champ} »` : e.message;
    }
    return new ErreurHttp(400, 'Certaines données sont invalides', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return new ErreurHttp(400, `Valeur invalide pour « ${err.path} »`);
  }

  const code = (err as { code?: number })?.code;
  if (code === 11000) {
    const champ = Object.keys((err as { keyPattern?: object }).keyPattern ?? {})[0] ?? 'valeur';
    const message =
      champ === 'email'
        ? 'Cette adresse email est déjà utilisée'
        : champ === 'nom'
          ? 'Ce nom est déjà utilisé'
          : 'Cet élément existe déjà';
    return new ErreurHttp(409, message, { [champ]: message });
  }

  return new ErreurHttp(500, 'Erreur interne du serveur');
}

/** Formate une date en français pour les vues. */
export function formaterDate(date: Date | string, avecHeure = true): string {
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    weekday: avecHeure ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** Valeur pour un <input type="datetime-local"> (heure locale du serveur). */
export function versInputDate(date?: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
