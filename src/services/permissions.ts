import { Types } from 'mongoose';
import type { Role } from '../models/Utilisateur';

/**
 * Règles de droits centralisées, utilisées par l'API ET par le back-office.
 * Fonctions pures (pas d'accès base) => faciles à tester unitairement.
 *
 *  - admin       : peut tout gérer ;
 *  - responsable : ne gère QUE les données de son association ;
 *  - etudiant    : ne gère que ses propres inscriptions / son profil.
 */
export interface Acteur {
  _id: Types.ObjectId | string;
  role: Role;
  association?: Id;
}

type Id = Types.ObjectId | string | { _id: Types.ObjectId } | null | undefined;

/**
 * Renvoie l'identifiant, que la référence soit un ObjectId, une chaîne ou un document PEUPLÉ
 * (après populate('association'), la propriété contient un document, pas un id).
 */
export function idDe(ref: Id): string | null {
  if (!ref) return null;
  if (typeof ref === 'object' && '_id' in ref && !(ref instanceof Types.ObjectId)) return String(ref._id);
  return String(ref);
}

const memeId = (a: Id, b: Id): boolean => {
  const [x, y] = [idDe(a), idDe(b)];
  return Boolean(x && y && x === y);
};

export const estAdmin = (acteur?: Acteur | null): boolean => acteur?.role === 'admin';

export const accedeAuBackOffice = (acteur?: Acteur | null): boolean =>
  acteur?.role === 'admin' || acteur?.role === 'responsable';

/** Modifier les informations d'une association (nom, description, contact, logo). */
export function peutModifierAssociation(acteur: Acteur | null | undefined, associationId: Id): boolean {
  if (!acteur) return false;
  if (acteur.role === 'admin') return true;
  return acteur.role === 'responsable' && memeId(acteur.association, associationId);
}

/** Créer, activer/désactiver ou supprimer une association : réservé à l'admin. */
export const peutAdministrerAssociations = estAdmin;

/** Créer / modifier / supprimer / publier un événement d'une association donnée. */
export const peutGererEvenementsDe = peutModifierAssociation;

/** Voir la liste des inscrits d'un événement organisé par `associationId`. */
export const peutVoirInscrits = peutModifierAssociation;

/** Gérer les comptes utilisateurs (rôles, rattachements, suppression) : réservé à l'admin. */
export const peutGererUtilisateurs = estAdmin;

/** Consulter / modifier un compte : soi-même ou un admin. */
export function peutAccederAuCompte(acteur: Acteur | null | undefined, utilisateurId: Id): boolean {
  if (!acteur) return false;
  return acteur.role === 'admin' || memeId(acteur._id, utilisateurId);
}

/**
 * Agir sur une inscription : son propriétaire, ou un gestionnaire de l'association
 * organisatrice de l'événement concerné.
 */
export function peutGererInscription(
  acteur: Acteur | null | undefined,
  inscription: { utilisateur: Id },
  associationOrganisatrice: Id
): boolean {
  if (!acteur) return false;
  return memeId(acteur._id, inscription.utilisateur) || peutGererEvenementsDe(acteur, associationOrganisatrice);
}
