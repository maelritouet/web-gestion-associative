import { Request, Response } from 'express';
import * as utilisateurs from '../../services/utilisateurService';
import { erreursDeValidation } from '../../middlewares/validation';
import { normaliserErreur, choisir } from '../../utils/outils';
import { ouvrirSession, fermerSession, cheminInterne } from '../../utils/session';
import { ErreurHttp } from '../../services/erreurs';

const valeursSansMotDePasse = (req: Request) => choisir(req.body ?? {}, ['prenom', 'nom', 'email']);

export function afficherInscription(req: Request, res: Response): void {
  if (req.utilisateur) return res.redirect('/');
  res.render('public/inscription', { titre: 'Créer un compte', valeurs: {}, erreurs: {} });
}

export async function inscrire(req: Request, res: Response): Promise<void> {
  const erreurs = erreursDeValidation(req);
  if (erreurs) {
    res.status(400).render('public/inscription', { titre: 'Créer un compte', valeurs: valeursSansMotDePasse(req), erreurs });
    return;
  }
  try {
    const utilisateur = await utilisateurs.inscrire(req.body);
    await ouvrirSession(req, String(utilisateur._id));
    res.flash('succes', `Bienvenue ${utilisateur.prenom} ! Votre compte a été créé.`);
    res.redirect('/evenements');
  } catch (err) {
    const e = normaliserErreur(err);
    if (e.status >= 500) throw err;
    res.status(e.status).render('public/inscription', {
      titre: 'Créer un compte',
      valeurs: valeursSansMotDePasse(req),
      erreurs: e.details ?? { general: e.message },
    });
  }
}

export function afficherConnexion(req: Request, res: Response): void {
  if (req.utilisateur) return res.redirect('/');
  res.render('public/connexion', { titre: 'Connexion', valeurs: {}, erreurs: {} });
}

export async function connecter(req: Request, res: Response): Promise<void> {
  const erreurs = erreursDeValidation(req);
  const valeurs = { email: req.body?.email ?? '' };
  if (erreurs) {
    res.status(400).render('public/connexion', { titre: 'Connexion', valeurs, erreurs });
    return;
  }
  try {
    const utilisateur = await utilisateurs.authentifier(req.body.email, req.body.motDePasse);
    const retour = await ouvrirSession(req, String(utilisateur._id));
    res.flash('succes', `Bonjour ${utilisateur.prenom} !`);
    res.redirect(cheminInterne(retour, utilisateur.role === 'etudiant' ? '/' : '/admin'));
  } catch (err) {
    if (!(err instanceof ErreurHttp) || err.status !== 401) throw err;
    res.status(401).render('public/connexion', { titre: 'Connexion', valeurs, erreurs: { general: err.message } });
  }
}

export async function deconnecter(req: Request, res: Response): Promise<void> {
  await fermerSession(req);
  res.clearCookie('vie-asso.sid');
  res.redirect('/');
}

export function afficherProfil(req: Request, res: Response): void {
  const u = req.utilisateur!;
  res.render('public/profil', {
    titre: 'Mon profil',
    valeurs: { prenom: u.prenom, nom: u.nom, email: u.email },
    erreurs: {},
  });
}

export async function modifierProfil(req: Request, res: Response): Promise<void> {
  try {
    const donnees = choisir(req.body ?? {}, ['prenom', 'nom', 'email', 'motDePasse']);
    await utilisateurs.modifier(req.utilisateur!, String(req.utilisateur!._id), donnees);
    res.flash('succes', 'Profil mis à jour.');
    res.redirect('/profil');
  } catch (err) {
    const e = normaliserErreur(err);
    if (e.status >= 500) throw err;
    res.status(e.status).render('public/profil', {
      titre: 'Mon profil',
      valeurs: valeursSansMotDePasse(req),
      erreurs: e.details ?? { general: e.message },
    });
  }
}
