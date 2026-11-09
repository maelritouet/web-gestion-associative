import bcrypt from 'bcryptjs';
import { Utilisateur, UtilisateurDoc, ROLES } from '../models/Utilisateur';
import { Association } from '../models/Association';
import { Acteur, peutAccederAuCompte, peutGererUtilisateurs } from './permissions';
import { conflit, interdit, nonTrouve, requeteInvalide, ErreurHttp } from './erreurs';
import { choisir, echapperRegex, estIdValide } from '../utils/outils';
import { supprimerToutesDeUtilisateur } from './inscriptionService';

const CHAMPS_PROFIL = ['prenom', 'nom', 'email', 'motDePasse'] as const;
const CHAMPS_ADMIN = [...CHAMPS_PROFIL, 'role', 'association'] as const;

// Hash factice : on compare quand même un mot de passe quand l'email n'existe pas,
// pour que le temps de réponse ne révèle pas quels emails sont inscrits.
const HASH_FACTICE = bcrypt.hashSync('mot-de-passe-factice', 10);

/** Inscription publique : le rôle est TOUJOURS "etudiant", quoi qu'envoie le client. */
export async function inscrire(donnees: Record<string, unknown>): Promise<UtilisateurDoc> {
  return Utilisateur.create({ ...choisir(donnees, CHAMPS_PROFIL), role: 'etudiant', association: null });
}

/** Vérifie les identifiants. Message volontairement identique dans tous les cas d'échec. */
export async function authentifier(email: string, motDePasse: string): Promise<UtilisateurDoc> {
  const utilisateur = await Utilisateur.findOne({ email: email.toLowerCase().trim() }).select('+motDePasse');
  const valide = utilisateur
    ? await utilisateur.verifierMotDePasse(motDePasse)
    : await bcrypt.compare(motDePasse, HASH_FACTICE).then(() => false);
  if (!utilisateur || !valide) throw new ErreurHttp(401, 'Email ou mot de passe incorrect');
  return utilisateur;
}

export function trouverParId(id: string) {
  return estIdValide(id) ? Utilisateur.findById(id) : null;
}

export async function lister(acteur: Acteur, filtres: { q?: string; role?: string } = {}) {
  if (!peutGererUtilisateurs(acteur)) throw interdit();
  const filtre: Record<string, unknown> = {};
  if (filtres.role && (ROLES as readonly string[]).includes(filtres.role)) filtre.role = filtres.role;
  if (filtres.q) {
    const motif = new RegExp(echapperRegex(filtres.q.slice(0, 100)), 'i');
    filtre.$or = [{ prenom: motif }, { nom: motif }, { email: motif }];
  }
  return Utilisateur.find(filtre).populate('association', 'nom').sort({ nom: 1, prenom: 1 }).limit(500);
}

export async function chargerAccessible(acteur: Acteur, id: string): Promise<UtilisateurDoc> {
  if (!estIdValide(id)) throw nonTrouve('Utilisateur');
  if (!peutAccederAuCompte(acteur, id)) throw interdit();
  const utilisateur = await Utilisateur.findById(id).populate('association', 'nom');
  if (!utilisateur) throw nonTrouve('Utilisateur');
  return utilisateur;
}

async function verifierAssociation(champs: Partial<Record<string, unknown>>): Promise<void> {
  // Un champ "association" vide (formulaire) signifie "aucune".
  if (champs.association === '' || champs.association === undefined) {
    if (champs.association === '') champs.association = null;
    return;
  }
  if (champs.association === null) return;
  if (!estIdValide(champs.association) || !(await Association.exists({ _id: champs.association }))) {
    throw requeteInvalide('Association invalide', { association: 'Association introuvable' });
  }
}

/** Empêche de retirer le dernier compte administrateur (sinon plus personne ne peut gérer le site). */
async function verifierDernierAdmin(utilisateur: UtilisateurDoc): Promise<void> {
  if (utilisateur.role !== 'admin') return;
  const autresAdmins = await Utilisateur.countDocuments({ role: 'admin', _id: { $ne: utilisateur._id } });
  if (autresAdmins === 0) throw conflit('Impossible : il doit rester au moins un administrateur');
}

export async function creer(acteur: Acteur, donnees: Record<string, unknown>): Promise<UtilisateurDoc> {
  if (!peutGererUtilisateurs(acteur)) throw interdit();
  const champs = choisir(donnees, CHAMPS_ADMIN);
  await verifierAssociation(champs);
  if (champs.role !== 'responsable') champs.association = null;
  return Utilisateur.create(champs);
}

export async function modifier(acteur: Acteur, id: string, donnees: Record<string, unknown>): Promise<UtilisateurDoc> {
  const utilisateur = await chargerAccessible(acteur, id);
  const admin = peutGererUtilisateurs(acteur);
  const champs = choisir(donnees, admin ? CHAMPS_ADMIN : CHAMPS_PROFIL);

  // Mot de passe vide dans un formulaire d'édition = "ne pas changer".
  if (champs.motDePasse === '' || champs.motDePasse === undefined) delete champs.motDePasse;

  if (admin) {
    await verifierAssociation(champs);
    const nouveauRole = (champs.role as string | undefined) ?? utilisateur.role;
    if (nouveauRole !== 'admin') await verifierDernierAdmin(utilisateur);
    if (nouveauRole !== 'responsable') champs.association = null;
  }

  utilisateur.set(champs);
  await utilisateur.save();
  return utilisateur;
}

/** Supprime un compte et ses inscriptions (en libérant les places). */
export async function supprimer(acteur: Acteur, id: string): Promise<void> {
  if (!peutGererUtilisateurs(acteur)) throw interdit();
  const utilisateur = await chargerAccessible(acteur, id);
  await verifierDernierAdmin(utilisateur);
  await supprimerToutesDeUtilisateur(utilisateur._id);
  await utilisateur.deleteOne();
}
