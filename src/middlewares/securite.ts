import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ErreurHttp } from '../services/erreurs';
import type { TypeFlash } from '../types/express';

const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protection CSRF (jeton synchronisé) pour les formulaires HTML.
 * Un jeton aléatoire est stocké en session et injecté dans chaque formulaire ;
 * toute requête POST doit le renvoyer. Un site tiers ne peut pas le lire, donc ne peut pas forger la requête.
 */
export function genererJetonCsrf(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

/** Vérifie le jeton sur toute requête qui modifie des données (à placer après le parsing du corps). */
export function verifierCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (METHODES_SURES.has(req.method) || !req.session.csrfToken) {
    return next(METHODES_SURES.has(req.method) ? undefined : new ErreurHttp(403, 'Session expirée : rechargez la page'));
  }

  const recu = (req.body as Record<string, unknown> | undefined)?._csrf ?? req.get('x-csrf-token');
  const attendu = Buffer.from(req.session.csrfToken);
  const fourni = Buffer.from(typeof recu === 'string' ? recu : '');
  // Comparaison à temps constant : ne divulgue pas le jeton caractère par caractère.
  if (fourni.length === attendu.length && crypto.timingSafeEqual(fourni, attendu)) return next();
  next(new ErreurHttp(403, 'Jeton de sécurité invalide ou expiré : rechargez la page et réessayez'));
}

/**
 * L'API utilise le même cookie de session que le site. Exiger un corps JSON pour les écritures
 * empêche un formulaire HTML d'un autre site de l'appeler (un formulaire ne peut pas envoyer
 * de JSON sans déclencher une vérification CORS que le navigateur bloquera).
 */
export function exigerJsonPourEcriture(req: Request, _res: Response, next: NextFunction): void {
  if (METHODES_SURES.has(req.method) || req.method === 'DELETE' || req.is('application/json')) return next();
  next(new ErreurHttp(415, 'Le corps de la requête doit être au format JSON (Content-Type: application/json)'));
}

/** Messages flash : stockés en session, affichés une seule fois sur la page suivante. */
export function flash(req: Request, res: Response, next: NextFunction): void {
  res.locals.flash = req.session.flash ?? [];
  delete req.session.flash;
  res.flash = (type: TypeFlash, message: string) => {
    req.session.flash = [...(req.session.flash ?? []), { type, message }];
  };
  next();
}

declare global {
  namespace Express {
    interface Response {
      flash(type: TypeFlash, message: string): void;
    }
  }
}
