import { body, validationResult } from 'express-validator';
import { Request } from 'express';
import { MOT_DE_PASSE_MIN } from '../models/Utilisateur';

/**
 * Validation des entrées AVANT d'atteindre la base (express-validator).
 * La validation Mongoose reste la garantie finale ; ici on donne des messages clairs
 * et on rejette tôt les données mal formées.
 */
export const reglesInscription = [
  body('prenom').isString().trim().notEmpty().withMessage('Le prénom est obligatoire').isLength({ max: 50 }),
  body('nom').isString().trim().notEmpty().withMessage('Le nom est obligatoire').isLength({ max: 50 }),
  body('email').isString().trim().isEmail().withMessage('Adresse email invalide').normalizeEmail({ gmail_remove_dots: false }),
  body('motDePasse')
    .isString()
    .isLength({ min: MOT_DE_PASSE_MIN })
    .withMessage(`Le mot de passe doit contenir au moins ${MOT_DE_PASSE_MIN} caractères`)
    .matches(/[A-Za-z]/)
    .withMessage('Le mot de passe doit contenir au moins une lettre')
    .matches(/\d/)
    .withMessage('Le mot de passe doit contenir au moins un chiffre'),
];

export const reglesConnexion = [
  body('email').isString().trim().notEmpty().withMessage("L'email est obligatoire"),
  body('motDePasse').isString().notEmpty().withMessage('Le mot de passe est obligatoire'),
];

/** Renvoie les erreurs sous la forme { champ: message } (première erreur par champ), ou null. */
export function erreursDeValidation(req: Request): Record<string, string> | null {
  const resultat = validationResult(req);
  if (resultat.isEmpty()) return null;
  const details: Record<string, string> = {};
  for (const e of resultat.array()) {
    if (e.type === 'field' && !details[e.path]) details[e.path] = String(e.msg);
  }
  return details;
}
