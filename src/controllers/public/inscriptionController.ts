import { Request, Response } from 'express';
import * as inscriptions from '../../services/inscriptionService';
import { ErreurHttp } from '../../services/erreurs';
import { cheminInterne } from '../../utils/session';

/** Les erreurs métier (complet, déjà inscrit…) deviennent un message flash, pas une page d'erreur. */
async function avecMessage(req: Request, res: Response, retour: string, action: () => Promise<string>) {
  try {
    res.flash('succes', await action());
  } catch (err) {
    if (!(err instanceof ErreurHttp) || err.status >= 500 || err.status === 403) throw err;
    res.flash('erreur', err.message);
  }
  res.redirect(cheminInterne(req.body?.retour, retour));
}

export async function inscrire(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  await avecMessage(req, res, `/evenements/${id}`, async () => {
    await inscriptions.inscrire(req.utilisateur!._id, id);
    return 'Inscription confirmée ! Retrouvez-la dans « Mes inscriptions ».';
  });
}

export async function annuler(req: Request, res: Response): Promise<void> {
  await avecMessage(req, res, '/mes-inscriptions', async () => {
    const inscription = await inscriptions.chargerAutorisee(req.utilisateur!, String(req.params.id));
    await inscriptions.annuler(inscription);
    return 'Inscription annulée, votre place a été libérée.';
  });
}

export async function mesInscriptions(req: Request, res: Response): Promise<void> {
  const liste = await inscriptions.mesInscriptions(req.utilisateur!._id);
  // Un événement supprimé laisse evenement = null après populate : on l'ignore.
  const valides = liste.filter((i) => i.evenement);
  const maintenant = Date.now();
  const estAVenir = (i: (typeof valides)[number]) =>
    (i.evenement as unknown as { date: Date }).date.getTime() >= maintenant;
  res.render('public/mes-inscriptions', {
    titre: 'Mes inscriptions',
    aVenir: valides.filter((i) => i.statut === 'confirmee' && estAVenir(i)),
    passees: valides.filter((i) => i.statut === 'confirmee' && !estAVenir(i)),
    annulees: valides.filter((i) => i.statut === 'annulee'),
  });
}
