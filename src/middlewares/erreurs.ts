import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ErreurHttp } from '../services/erreurs';
import { normaliserErreur } from '../utils/outils';
import { env } from '../config/env';

/** 404 pour toute route non déclarée. */
export function routeIntrouvable(_req: Request, _res: Response, next: NextFunction): void {
  next(new ErreurHttp(404, 'Page introuvable'));
}

/**
 * Gestionnaire d'erreurs unique (Express 5 y transmet aussi les erreurs des fonctions async).
 * - /api/*  : réponse JSON { erreur, details }
 * - sinon   : page d'erreur HTML
 */
export function gestionnaireErreurs(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let erreur: ErreurHttp;
  if (err instanceof multer.MulterError) {
    erreur = new ErreurHttp(400, err.code === 'LIMIT_FILE_SIZE' ? 'Le fichier dépasse 2 Mo' : 'Fichier refusé');
  } else if ((err as { type?: string })?.type === 'entity.parse.failed') {
    erreur = new ErreurHttp(400, 'Corps JSON mal formé');
  } else {
    erreur = normaliserErreur(err);
  }

  if (erreur.status >= 500 && !env.isTest) console.error(err);

  res.status(erreur.status);
  if (req.originalUrl.startsWith('/api')) {
    res.json({ erreur: erreur.message, ...(erreur.details ? { details: erreur.details } : {}) });
    return;
  }
  res.render('erreur', { titre: `Erreur ${erreur.status}`, status: erreur.status, message: erreur.message });
}
