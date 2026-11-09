import { Request, Response } from 'express';
import { Association } from '../../models/Association';
import { Evenement } from '../../models/Evenement';
import { Inscription } from '../../models/Inscription';
import { Utilisateur } from '../../models/Utilisateur';
import { estAdmin } from '../../services/permissions';

export async function tableauDeBord(req: Request, res: Response): Promise<void> {
  const acteur = req.utilisateur!;
  const admin = estAdmin(acteur);
  const filtreEvenements = admin ? {} : { association: acteur.association?._id };
  const idsEvenements = await Evenement.find(filtreEvenements).distinct('_id');

  const [nbEvenements, nbPublies, nbInscriptions, nbAssociations, nbUtilisateurs, prochains] = await Promise.all([
    Evenement.countDocuments(filtreEvenements),
    Evenement.countDocuments({ ...filtreEvenements, statut: 'publie' }),
    Inscription.countDocuments({ evenement: { $in: idsEvenements }, statut: 'confirmee' }),
    admin ? Association.countDocuments() : Promise.resolve(null),
    admin ? Utilisateur.countDocuments() : Promise.resolve(null),
    Evenement.find({ ...filtreEvenements, date: { $gte: new Date() } })
      .populate('association', 'nom')
      .sort({ date: 1 })
      .limit(8),
  ]);

  res.render('admin/tableau-de-bord', {
    titre: 'Tableau de bord',
    stats: { nbEvenements, nbPublies, nbInscriptions, nbAssociations, nbUtilisateurs },
    prochains,
  });
}
