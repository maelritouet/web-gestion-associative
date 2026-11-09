import { Request, Response } from 'express';
import { ErreurHttp } from '../../services/erreurs';
import { normaliserErreur } from '../../utils/outils';

/**
 * Exécute une action de formulaire du back-office :
 * - succès  : message flash + redirection (pattern Post/Redirect/Get, évite la double soumission) ;
 * - erreur de validation (4xx) : on ré-affiche le formulaire avec les erreurs par champ ;
 * - erreur de droits ou serveur : remontée au gestionnaire d'erreurs global.
 */
export async function traiterFormulaire(
  res: Response,
  action: () => Promise<{ message: string; redirection: string }>,
  reafficher: (erreurs: Record<string, string>, status: number) => void | Promise<void>
): Promise<void> {
  try {
    const { message, redirection } = await action();
    res.flash('succes', message);
    res.redirect(redirection);
  } catch (err) {
    const e = normaliserErreur(err);
    if (e.status >= 500 || e.status === 403 || e.status === 404) throw err;
    await reafficher(e.details ?? { general: e.message }, e.status);
  }
}

/** Pour les actions sans formulaire (boutons) : l'erreur métier devient un message flash. */
export async function traiterAction(req: Request, res: Response, retour: string, action: () => Promise<string>) {
  try {
    res.flash('succes', await action());
  } catch (err) {
    if (!(err instanceof ErreurHttp) || err.status >= 500 || err.status === 403 || err.status === 404) throw err;
    res.flash('erreur', err.message);
  }
  res.redirect(retour);
}
