import 'express-session';
import type { UtilisateurDoc } from '../models/Utilisateur';

export type TypeFlash = 'succes' | 'erreur' | 'info';

declare module 'express-session' {
  interface SessionData {
    utilisateurId?: string;
    csrfToken?: string;
    flash?: { type: TypeFlash; message: string }[];
    /** Page demandée avant d'être redirigé vers la connexion. */
    retour?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Utilisateur connecté, rechargé depuis la base à chaque requête. */
      utilisateur?: UtilisateurDoc | null;
    }
  }
}
