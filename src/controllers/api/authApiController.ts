import { Request, Response } from 'express';
import * as utilisateurs from '../../services/utilisateurService';
import { erreursDeValidation } from '../../middlewares/validation';
import { requeteInvalide } from '../../services/erreurs';
import { ouvrirSession, fermerSession } from '../../utils/session';

function verifierValidation(req: Request): void {
  const erreurs = erreursDeValidation(req);
  if (erreurs) throw requeteInvalide('Certaines données sont invalides', erreurs);
}

/** POST /api/auth/inscription */
export async function inscrire(req: Request, res: Response): Promise<void> {
  verifierValidation(req);
  const utilisateur = await utilisateurs.inscrire(req.body);
  await ouvrirSession(req, String(utilisateur._id));
  res.status(201).json(utilisateur);
}

/** POST /api/auth/connexion */
export async function connecter(req: Request, res: Response): Promise<void> {
  verifierValidation(req);
  const utilisateur = await utilisateurs.authentifier(req.body.email, req.body.motDePasse);
  await ouvrirSession(req, String(utilisateur._id));
  res.json(utilisateur);
}

/** POST /api/auth/deconnexion */
export async function deconnecter(req: Request, res: Response): Promise<void> {
  await fermerSession(req);
  res.clearCookie('vie-asso.sid');
  res.status(204).end();
}

/** GET /api/auth/moi */
export function moi(req: Request, res: Response): void {
  res.json(req.utilisateur);
}
