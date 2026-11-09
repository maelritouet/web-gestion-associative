import { Request, Response } from 'express';
import * as evenements from '../../services/evenementService';
import * as associations from '../../services/associationService';
import * as inscriptions from '../../services/inscriptionService';
import { Association } from '../../models/Association';
import { texte } from '../../utils/outils';

/** Contrôleur des pages publiques de consultation (accueil, associations, événements). */

export async function accueil(_req: Request, res: Response): Promise<void> {
  const [prochains, nbAssociations] = await Promise.all([
    evenements.prochains(6),
    Association.countDocuments({ statut: 'active' }),
  ]);
  res.render('public/accueil', { titre: 'Accueil', prochains, nbAssociations });
}

export async function listerAssociations(req: Request, res: Response): Promise<void> {
  const q = texte(req.query.q) ?? '';
  res.render('public/associations', { titre: 'Associations', associations: await associations.listerActives(q), q });
}

export async function afficherAssociation(req: Request, res: Response): Promise<void> {
  const { association, evenements: aVenir } = await associations.trouverPublique(String(req.params.id));
  res.render('public/association', { titre: association.nom, association, evenements: aVenir });
}

export async function listerEvenements(req: Request, res: Response): Promise<void> {
  const filtres = {
    q: texte(req.query.q),
    categorie: texte(req.query.categorie),
    association: texte(req.query.association),
    quand: texte(req.query.quand) ?? 'a-venir',
    du: texte(req.query.du),
    au: texte(req.query.au),
    page: req.query.page,
  };
  const [resultat, listeAssociations] = await Promise.all([
    evenements.rechercherPublics(filtres),
    associations.listerActives(),
  ]);
  res.render('public/evenements', {
    titre: 'Événements',
    ...resultat,
    filtres,
    associations: listeAssociations,
  });
}

export async function afficherEvenement(req: Request, res: Response): Promise<void> {
  const evenement = await evenements.trouverPublic(String(req.params.id));
  const monInscription = req.utilisateur ? await inscriptions.inscriptionDe(req.utilisateur._id, evenement._id) : null;
  res.render('public/evenement', { titre: evenement.titre, evenement, monInscription });
}
