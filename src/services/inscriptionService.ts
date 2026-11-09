import { Types } from 'mongoose';
import { Evenement } from '../models/Evenement';
import { Association } from '../models/Association';
import { Inscription, InscriptionDoc, StatutInscription } from '../models/Inscription';
import { Acteur, peutGererInscription, peutVoirInscrits, estAdmin } from './permissions';
import { conflit, interdit, nonTrouve, requeteInvalide } from './erreurs';
import { estIdValide } from '../utils/outils';

type Id = Types.ObjectId | string;

/**
 * Réserve une place de façon atomique.
 * Le filtre $expr compare deux champs DU MÊME document au moment de l'écriture :
 * MongoDB garantit qu'aucune autre requête ne peut s'intercaler entre le test et l'incrément.
 * Résultat : impossible de dépasser la capacité, même avec 100 clics simultanés.
 */
async function reserverPlace(evenementId: Id): Promise<boolean> {
  const resultat = await Evenement.findOneAndUpdate(
    { _id: evenementId, statut: 'publie', $expr: { $lt: ['$nbInscrits', '$capacite'] } },
    { $inc: { nbInscrits: 1 } },
    { new: true }
  );
  return resultat !== null;
}

async function libererPlace(evenementId: Id): Promise<void> {
  // Garde-fou nbInscrits > 0 : le compteur ne peut jamais devenir négatif.
  await Evenement.updateOne({ _id: evenementId, nbInscrits: { $gt: 0 } }, { $inc: { nbInscrits: -1 } });
}

/** Vérifie qu'un événement est ouvert aux inscriptions et le renvoie. */
async function evenementOuvert(evenementId: Id) {
  if (!estIdValide(String(evenementId))) throw nonTrouve('Événement');
  const evenement = await Evenement.findById(evenementId);
  if (!evenement || evenement.statut !== 'publie') throw nonTrouve('Événement');

  const association = await Association.findById(evenement.association).select('statut');
  if (!association || association.statut !== 'active') {
    throw requeteInvalide("L'association organisatrice n'est plus active : inscriptions fermées");
  }
  if (evenement.date.getTime() < Date.now()) {
    throw requeteInvalide('Cet événement est déjà passé : inscriptions fermées');
  }
  return evenement;
}

/**
 * Inscrit un utilisateur à un événement.
 * Règles : événement publié, à venir, association active, pas de double inscription,
 * capacité maximale respectée. Une inscription annulée est réactivée.
 */
export async function inscrire(utilisateurId: Id, evenementId: Id): Promise<InscriptionDoc> {
  const evenement = await evenementOuvert(evenementId);

  const existante = await Inscription.findOne({ utilisateur: utilisateurId, evenement: evenement._id });
  if (existante?.statut === 'confirmee') throw conflit('Vous êtes déjà inscrit(e) à cet événement');

  if (!(await reserverPlace(evenement._id))) throw conflit('Cet événement est complet');

  try {
    if (existante) {
      // Réactivation conditionnelle : si une autre requête l'a déjà réactivée, on obtient null.
      const reactivee = await Inscription.findOneAndUpdate(
        { _id: existante._id, statut: 'annulee' },
        { statut: 'confirmee', dateInscription: new Date() },
        { new: true }
      );
      if (!reactivee) throw conflit('Vous êtes déjà inscrit(e) à cet événement');
      return reactivee;
    }
    return await Inscription.create({ utilisateur: utilisateurId, evenement: evenement._id });
  } catch (err) {
    // La place a été réservée mais l'inscription a échoué : on la rend (compensation).
    await libererPlace(evenement._id);
    if ((err as { code?: number }).code === 11000) {
      throw conflit('Vous êtes déjà inscrit(e) à cet événement');
    }
    throw err;
  }
}

/** Annule une inscription confirmée et libère la place. */
export async function annuler(inscription: InscriptionDoc): Promise<InscriptionDoc> {
  const annulee = await Inscription.findOneAndUpdate(
    { _id: inscription._id, statut: 'confirmee' },
    { statut: 'annulee' },
    { new: true }
  );
  if (!annulee) throw conflit('Cette inscription est déjà annulée');
  await libererPlace(annulee.evenement);
  return annulee;
}

/** Supprime définitivement une inscription (libère la place si elle était confirmée). */
export async function supprimer(inscription: InscriptionDoc): Promise<void> {
  const supprimee = await Inscription.findOneAndDelete({ _id: inscription._id });
  if (supprimee?.statut === 'confirmee') await libererPlace(supprimee.evenement);
}

/** Change le statut d'une inscription (confirmee <-> annulee) en respectant les règles. */
export async function changerStatut(inscription: InscriptionDoc, statut: StatutInscription): Promise<InscriptionDoc> {
  if (statut === inscription.statut) return inscription;
  if (statut === 'annulee') return annuler(inscription);
  if (statut === 'confirmee') return inscrire(inscription.utilisateur, inscription.evenement);
  throw requeteInvalide('Statut inconnu');
}

/** Charge une inscription et vérifie que l'acteur a le droit d'agir dessus. */
export async function chargerAutorisee(acteur: Acteur, inscriptionId: string): Promise<InscriptionDoc> {
  if (!estIdValide(inscriptionId)) throw nonTrouve('Inscription');
  const inscription = await Inscription.findById(inscriptionId);
  if (!inscription) throw nonTrouve('Inscription');
  const evenement = await Evenement.findById(inscription.evenement).select('association');
  if (!peutGererInscription(acteur, inscription, evenement?.association)) throw interdit();
  return inscription;
}

/** Inscriptions de l'utilisateur, avec l'événement et son association. */
export function mesInscriptions(utilisateurId: Id, statut?: StatutInscription) {
  return Inscription.find({ utilisateur: utilisateurId, ...(statut ? { statut } : {}) })
    .populate({ path: 'evenement', populate: { path: 'association', select: 'nom logo' } })
    .sort({ dateInscription: -1 });
}

/** Statut de l'utilisateur pour un événement (pour afficher le bon bouton). */
export function inscriptionDe(utilisateurId: Id, evenementId: Id) {
  return Inscription.findOne({ utilisateur: utilisateurId, evenement: evenementId });
}

/** Liste des inscrits d'un événement (back-office / API), réservée aux gestionnaires. */
export async function listerInscrits(acteur: Acteur, evenementId: string, statut?: StatutInscription) {
  if (!estIdValide(evenementId)) throw nonTrouve('Événement');
  const evenement = await Evenement.findById(evenementId).populate('association', 'nom');
  if (!evenement) throw nonTrouve('Événement');
  if (!peutVoirInscrits(acteur, evenement.association._id)) throw interdit();

  const inscriptions = await Inscription.find({ evenement: evenement._id, ...(statut ? { statut } : {}) })
    .populate('utilisateur', 'prenom nom email')
    .sort({ statut: 1, dateInscription: 1 });
  return { evenement, inscriptions };
}

/** Liste filtrable pour l'API : un admin voit tout, les autres seulement leurs inscriptions. */
export async function listerPourApi(acteur: Acteur, filtres: { evenement?: string; statut?: string }) {
  const requete: Record<string, unknown> = {};
  if (filtres.statut === 'confirmee' || filtres.statut === 'annulee') requete.statut = filtres.statut;

  if (filtres.evenement) {
    if (!estIdValide(filtres.evenement)) throw requeteInvalide('Identifiant d’événement invalide');
    requete.evenement = filtres.evenement;
    const evenement = await Evenement.findById(filtres.evenement).select('association');
    // Un gestionnaire de l'association voit tous les inscrits ; sinon on restreint à soi.
    if (!evenement || !peutVoirInscrits(acteur, evenement.association)) requete.utilisateur = acteur._id;
  } else if (!estAdmin(acteur)) {
    requete.utilisateur = acteur._id;
  }

  return Inscription.find(requete)
    .populate('utilisateur', 'prenom nom email')
    .populate('evenement', 'titre date lieu')
    .sort({ dateInscription: -1 })
    .limit(500);
}

/** Supprime toutes les inscriptions d'un utilisateur en libérant les places occupées. */
export async function supprimerToutesDeUtilisateur(utilisateurId: Id): Promise<void> {
  const confirmees = await Inscription.find({ utilisateur: utilisateurId, statut: 'confirmee' }).select('evenement');
  for (const inscription of confirmees) await libererPlace(inscription.evenement);
  await Inscription.deleteMany({ utilisateur: utilisateurId });
}
