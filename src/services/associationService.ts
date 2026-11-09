import { Association, AssociationDoc, STATUTS_ASSOCIATION, StatutAssociation } from '../models/Association';
import { Evenement } from '../models/Evenement';
import { Utilisateur } from '../models/Utilisateur';
import { Acteur, estAdmin, idDe, peutAdministrerAssociations, peutModifierAssociation } from './permissions';
import { conflit, interdit, nonTrouve, requeteInvalide } from './erreurs';
import { choisir, echapperRegex, estIdValide } from '../utils/outils';
import { supprimerLogo } from '../utils/fichiers';

const CHAMPS_INFOS = ['nom', 'description', 'contact', 'logo'] as const;

export function listerActives(q?: string) {
  const filtre: Record<string, unknown> = { statut: 'active' };
  if (q) filtre.nom = new RegExp(echapperRegex(q.slice(0, 100)), 'i');
  return Association.find(filtre).sort({ nom: 1 });
}

/** Fiche publique : association active + ses événements publiés à venir. */
export async function trouverPublique(id: string) {
  if (!estIdValide(id)) throw nonTrouve('Association');
  const association = await Association.findOne({ _id: id, statut: 'active' });
  if (!association) throw nonTrouve('Association');
  const evenements = await Evenement.find({ association: association._id, statut: 'publie', date: { $gte: new Date() } }).sort({
    date: 1,
  });
  return { association, evenements };
}

/** Back-office : l'admin voit tout, un responsable uniquement son association. */
export function listerPourGestion(acteur: Acteur) {
  const filtre = estAdmin(acteur) ? {} : { _id: idDe(acteur.association) };
  return Association.find(filtre).sort({ nom: 1 });
}

export async function chargerModifiable(acteur: Acteur, id: string): Promise<AssociationDoc> {
  if (!estIdValide(id)) throw nonTrouve('Association');
  const association = await Association.findById(id);
  if (!association) throw nonTrouve('Association');
  if (!peutModifierAssociation(acteur, association._id)) throw interdit();
  return association;
}

export async function creer(acteur: Acteur, donnees: Record<string, unknown>): Promise<AssociationDoc> {
  if (!peutAdministrerAssociations(acteur)) throw interdit('Seul un administrateur peut créer une association');
  return Association.create(choisir(donnees, [...CHAMPS_INFOS, 'statut']));
}

export async function modifier(acteur: Acteur, id: string, donnees: Record<string, unknown>): Promise<AssociationDoc> {
  const association = await chargerModifiable(acteur, id);
  const champs = choisir(donnees, [...CHAMPS_INFOS, 'statut']);
  if (champs.statut !== undefined && champs.statut !== association.statut && !peutAdministrerAssociations(acteur)) {
    throw interdit("Seul un administrateur peut activer ou désactiver une association");
  }
  const ancienLogo = association.logo;
  association.set(champs);
  const sauvee = await association.save();
  if (champs.logo !== undefined && ancienLogo && ancienLogo !== sauvee.logo) await supprimerLogo(ancienLogo);
  return sauvee;
}

export async function changerStatut(acteur: Acteur, id: string, statut: StatutAssociation): Promise<AssociationDoc> {
  if (!peutAdministrerAssociations(acteur)) throw interdit("Seul un administrateur peut activer ou désactiver une association");
  if (!(STATUTS_ASSOCIATION as readonly string[]).includes(statut)) throw requeteInvalide('Statut inconnu');
  const association = await chargerModifiable(acteur, id);
  association.statut = statut;
  return association.save();
}

/**
 * Suppression définitive : refusée si l'association a encore des événements ou des responsables,
 * pour ne jamais laisser de références orphelines. On privilégie la désactivation.
 */
export async function supprimer(acteur: Acteur, id: string): Promise<void> {
  if (!peutAdministrerAssociations(acteur)) throw interdit('Seul un administrateur peut supprimer une association');
  const association = await chargerModifiable(acteur, id);
  if (await Evenement.exists({ association: association._id })) {
    throw conflit("Impossible de supprimer une association qui a des événements : désactivez-la plutôt");
  }
  if (await Utilisateur.exists({ association: association._id })) {
    throw conflit('Impossible de supprimer une association qui a encore des responsables rattachés');
  }
  await association.deleteOne();
  if (association.logo) await supprimerLogo(association.logo);
}
