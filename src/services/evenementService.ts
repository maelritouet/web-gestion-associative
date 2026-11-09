import { Types } from 'mongoose';
import { Evenement, EvenementDoc, CATEGORIES, STATUTS_EVENEMENT, StatutEvenement } from '../models/Evenement';
import { Association } from '../models/Association';
import { Inscription } from '../models/Inscription';
import { Acteur, accedeAuBackOffice, estAdmin, idDe, peutGererEvenementsDe } from './permissions';
import { interdit, nonTrouve, requeteInvalide } from './erreurs';
import { choisir, echapperRegex, estIdValide, entierPositif } from '../utils/outils';

export const PAR_PAGE = 9;

export interface FiltresEvenements {
  q?: string;
  categorie?: string;
  association?: string;
  /** a-venir (défaut) | passes | tous */
  quand?: string;
  du?: string;
  au?: string;
  statut?: string;
  page?: unknown;
}

const CHAMPS_MODIFIABLES = ['titre', 'description', 'date', 'lieu', 'capacite', 'categorie', 'association', 'statut'] as const;

/** Construit le filtre Mongo commun à la liste publique et à la liste de gestion. */
function construireFiltre(filtres: FiltresEvenements): Record<string, unknown> {
  const filtre: Record<string, unknown> = {};

  if (filtres.q) {
    const motif = new RegExp(echapperRegex(filtres.q.slice(0, 100)), 'i');
    filtre.$or = [{ titre: motif }, { description: motif }, { lieu: motif }];
  }
  if (filtres.categorie && (CATEGORIES as readonly string[]).includes(filtres.categorie)) {
    filtre.categorie = filtres.categorie;
  }
  if (filtres.association && estIdValide(filtres.association)) {
    filtre.association = new Types.ObjectId(filtres.association);
  }

  const date: Record<string, Date> = {};
  const maintenant = new Date();
  if (filtres.quand === 'passes') date.$lt = maintenant;
  else if (filtres.quand !== 'tous') date.$gte = maintenant;

  const du = filtres.du ? new Date(filtres.du) : null;
  if (du && !Number.isNaN(du.getTime())) date.$gte = date.$gte && date.$gte > du ? date.$gte : du;
  const au = filtres.au ? new Date(filtres.au) : null;
  if (au && !Number.isNaN(au.getTime())) {
    au.setHours(23, 59, 59, 999); // "au" est inclusif : jusqu'à la fin de la journée
    date.$lte = au;
  }
  if (Object.keys(date).length) filtre.date = date;

  return filtre;
}

async function paginer(filtre: Record<string, unknown>, tri: Record<string, 1 | -1>, pageDemandee: unknown) {
  const total = await Evenement.countDocuments(filtre);
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const page = Math.min(entierPositif(pageDemandee, 1), pages);
  const evenements = await Evenement.find(filtre)
    .populate('association', 'nom logo')
    .sort(tri)
    .skip((page - 1) * PAR_PAGE)
    .limit(PAR_PAGE);
  return { evenements, total, page, pages };
}

/** Recherche publique : uniquement les événements publiés d'associations actives. */
export async function rechercherPublics(filtres: FiltresEvenements) {
  const associationsActives = await Association.find({ statut: 'active' }).distinct('_id');
  const filtre = construireFiltre(filtres);
  filtre.statut = 'publie';

  const demandee = filtre.association as Types.ObjectId | undefined;
  filtre.association = demandee
    ? associationsActives.some((id) => id.equals(demandee)) ? demandee : null
    : { $in: associationsActives };

  return paginer(filtre, { date: filtres.quand === 'passes' ? -1 : 1 }, filtres.page);
}

/** Prochains événements publiés (page d'accueil). */
export async function prochains(limite = 6) {
  const associationsActives = await Association.find({ statut: 'active' }).distinct('_id');
  return Evenement.find({ statut: 'publie', date: { $gte: new Date() }, association: { $in: associationsActives } })
    .populate('association', 'nom logo')
    .sort({ date: 1 })
    .limit(limite);
}

/** Fiche publique d'un événement (404 si brouillon ou association inactive). */
export async function trouverPublic(id: string): Promise<EvenementDoc> {
  if (!estIdValide(id)) throw nonTrouve('Événement');
  const evenement = await Evenement.findOne({ _id: id, statut: 'publie' }).populate('association', 'nom logo statut contact');
  const association = evenement?.association as unknown as { statut?: string } | undefined;
  if (!evenement || association?.statut !== 'active') throw nonTrouve('Événement');
  return evenement;
}

/** Liste pour le back-office : un responsable ne voit que les événements de son association. */
export async function listerPourGestion(acteur: Acteur, filtres: FiltresEvenements) {
  const filtre = construireFiltre({ ...filtres, quand: filtres.quand ?? 'tous' });
  if (filtres.statut && (STATUTS_EVENEMENT as readonly string[]).includes(filtres.statut)) {
    filtre.statut = filtres.statut;
  }
  if (!estAdmin(acteur)) filtre.association = idDe(acteur.association);
  return paginer(filtre, { date: -1 }, filtres.page);
}

/** Charge un événement et vérifie que l'acteur peut le gérer. */
export async function chargerGerable(acteur: Acteur, id: string): Promise<EvenementDoc> {
  if (!estIdValide(id)) throw nonTrouve('Événement');
  const evenement = await Evenement.findById(id);
  if (!evenement) throw nonTrouve('Événement');
  if (!peutGererEvenementsDe(acteur, evenement.association)) throw interdit();
  return evenement;
}

/**
 * Vérifie l'association cible si elle est fournie. Si elle est absente ou mal formée,
 * on laisse la validation Mongoose la signaler AVEC les autres erreurs du formulaire.
 */
async function verifierAssociationCible(acteur: Acteur, associationId: unknown): Promise<void> {
  if (!estIdValide(associationId)) return;
  if (!(await Association.exists({ _id: associationId }))) {
    throw requeteInvalide('Association introuvable', { association: 'Association introuvable' });
  }
  if (!peutGererEvenementsDe(acteur, associationId)) {
    throw interdit('Vous ne pouvez gérer que les événements de votre association');
  }
}

export async function creer(acteur: Acteur, donnees: Record<string, unknown>): Promise<EvenementDoc> {
  if (!accedeAuBackOffice(acteur)) throw interdit();
  const champs = choisir(donnees, CHAMPS_MODIFIABLES);
  // Un responsable crée toujours pour SON association, quoi qu'envoie le formulaire.
  if (!estAdmin(acteur)) {
    if (champs.association !== undefined && idDe(champs.association) !== idDe(acteur.association)) {
      throw interdit('Vous ne pouvez gérer que les événements de votre association');
    }
    champs.association = idDe(acteur.association) ?? undefined;
  }
  if (champs.association === '') delete champs.association;
  await verifierAssociationCible(acteur, champs.association);
  return Evenement.create(champs);
}

export async function modifier(acteur: Acteur, id: string, donnees: Record<string, unknown>): Promise<EvenementDoc> {
  const evenement = await chargerGerable(acteur, id);
  const champs = choisir(donnees, CHAMPS_MODIFIABLES);

  if (champs.association !== undefined && String(champs.association) !== String(evenement.association)) {
    if (!estAdmin(acteur)) throw interdit("Seul un administrateur peut changer l'association organisatrice");
    await verifierAssociationCible(acteur, champs.association);
  }
  evenement.set(champs);
  return evenement.save();
}

export async function changerStatut(acteur: Acteur, id: string, statut: StatutEvenement): Promise<EvenementDoc> {
  if (!(STATUTS_EVENEMENT as readonly string[]).includes(statut)) throw requeteInvalide('Statut inconnu');
  const evenement = await chargerGerable(acteur, id);
  evenement.statut = statut;
  return evenement.save();
}

/** Supprime l'événement ET ses inscriptions (suppression en cascade). */
export async function supprimer(acteur: Acteur, id: string): Promise<void> {
  const evenement = await chargerGerable(acteur, id);
  await Inscription.deleteMany({ evenement: evenement._id });
  await evenement.deleteOne();
}
