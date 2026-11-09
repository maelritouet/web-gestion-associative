import { Request } from 'express';

/**
 * Connecte l'utilisateur en RÉGÉNÉRANT l'identifiant de session :
 * protège contre la fixation de session (un attaquant qui aurait imposé un id avant la connexion).
 */
export function ouvrirSession(req: Request, utilisateurId: string): Promise<string | undefined> {
  const retour = req.session.retour;
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.utilisateurId = utilisateurId;
      req.session.save((e) => (e ? reject(e) : resolve(retour)));
    });
  });
}

export function fermerSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

/** N'accepte qu'un chemin interne comme destination de redirection (évite les "open redirects"). */
export function cheminInterne(cible: unknown, defaut = '/'): string {
  return typeof cible === 'string' && cible.startsWith('/') && !cible.startsWith('//') && !cible.includes('\\')
    ? cible
    : defaut;
}
