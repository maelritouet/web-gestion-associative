/**
 * Erreur métier portant un code HTTP. Les services la lèvent ; le middleware d'erreurs
 * la traduit en JSON (API) ou en page / message flash (front et back-office).
 */
export class ErreurHttp extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, string>
  ) {
    super(message);
    this.name = 'ErreurHttp';
  }
}

export const nonTrouve = (quoi = 'Ressource') => new ErreurHttp(404, `${quoi} introuvable`);
export const interdit = (message = "Vous n'avez pas les droits pour effectuer cette action") =>
  new ErreurHttp(403, message);
export const conflit = (message: string) => new ErreurHttp(409, message);
export const requeteInvalide = (message: string, details?: Record<string, string>) =>
  new ErreurHttp(400, message, details);
