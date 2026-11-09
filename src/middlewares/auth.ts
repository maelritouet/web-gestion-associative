import { Request, Response, NextFunction } from 'express';
import { Utilisateur } from '../models/Utilisateur';
import { accedeAuBackOffice, estAdmin } from '../services/permissions';
import { ErreurHttp } from '../services/erreurs';

const estApi = (req: Request) => req.originalUrl.startsWith('/api');

/**
 * Recharge l'utilisateur depuis la base à chaque requête : un changement de rôle
 * ou une suppression de compte prend effet immédiatement, sans attendre la reconnexion.
 */
export async function chargerUtilisateur(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.utilisateur = null;
  const id = req.session.utilisateurId;
  if (id) {
    req.utilisateur = await Utilisateur.findById(id).populate('association', 'nom statut');
    if (!req.utilisateur) delete req.session.utilisateurId; // compte supprimé entre-temps
  }
  res.locals.utilisateur = req.utilisateur;
  res.locals.estAdmin = estAdmin(req.utilisateur);
  res.locals.accedeAuBackOffice = accedeAuBackOffice(req.utilisateur);
  next();
}

/** Bloque les visiteurs non connectés (redirection vers /connexion ou 401 JSON). */
export function exigerConnexion(req: Request, res: Response, next: NextFunction): void {
  if (req.utilisateur) return next();
  if (estApi(req)) return next(new ErreurHttp(401, 'Authentification requise'));
  if (req.method === 'GET') req.session.retour = req.originalUrl;
  req.session.flash = [...(req.session.flash ?? []), { type: 'info', message: 'Connectez-vous pour continuer.' }];
  res.redirect('/connexion');
}

/** Fabrique un garde-fou de rôle (à placer APRÈS exigerConnexion). */
function exiger(condition: (req: Request) => boolean, message: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    next(condition(req) ? undefined : new ErreurHttp(403, message));
  };
}

export const exigerBackOffice = exiger(
  (req) => accedeAuBackOffice(req.utilisateur),
  'Le back-office est réservé aux responsables associatifs et aux administrateurs'
);

export const exigerAdmin = exiger((req) => estAdmin(req.utilisateur), 'Action réservée aux administrateurs');
