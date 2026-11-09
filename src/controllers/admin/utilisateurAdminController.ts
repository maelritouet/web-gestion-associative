import { Request, Response } from 'express';
import * as utilisateurs from '../../services/utilisateurService';
import { Association } from '../../models/Association';
import { ROLES } from '../../models/Utilisateur';
import { choisir, texte } from '../../utils/outils';
import { traiterAction, traiterFormulaire } from './outilsAdmin';

const champsFormulaire = (body: Record<string, unknown>) =>
  choisir(body ?? {}, ['prenom', 'nom', 'email', 'motDePasse', 'role', 'association']);

async function contexteFormulaire() {
  return { roles: ROLES, associations: await Association.find().select('nom').sort({ nom: 1 }) };
}

export async function lister(req: Request, res: Response): Promise<void> {
  const filtres = { q: texte(req.query.q), role: texte(req.query.role) };
  res.render('admin/utilisateurs', {
    titre: 'Utilisateurs',
    utilisateurs: await utilisateurs.lister(req.utilisateur!, filtres),
    filtres,
    roles: ROLES,
  });
}

export async function formulaireCreation(_req: Request, res: Response): Promise<void> {
  res.render('admin/utilisateur-form', {
    titre: 'Nouvel utilisateur',
    cible: null,
    valeurs: { role: 'etudiant' },
    erreurs: {},
    ...(await contexteFormulaire()),
  });
}

export async function creer(req: Request, res: Response): Promise<void> {
  await traiterFormulaire(
    res,
    async () => {
      const u = await utilisateurs.creer(req.utilisateur!, champsFormulaire(req.body));
      return { message: `Compte de ${u.prenom} ${u.nom} créé.`, redirection: '/admin/utilisateurs' };
    },
    async (erreurs, status) => {
      res.status(status).render('admin/utilisateur-form', {
        titre: 'Nouvel utilisateur',
        cible: null,
        valeurs: { ...req.body, motDePasse: '' },
        erreurs,
        ...(await contexteFormulaire()),
      });
    }
  );
}

export async function formulaireModification(req: Request, res: Response): Promise<void> {
  const cible = await utilisateurs.chargerAccessible(req.utilisateur!, String(req.params.id));
  res.render('admin/utilisateur-form', {
    titre: `Modifier ${cible.prenom} ${cible.nom}`,
    cible,
    valeurs: {
      prenom: cible.prenom,
      nom: cible.nom,
      email: cible.email,
      role: cible.role,
      association: cible.association?._id?.toString() ?? '',
    },
    erreurs: {},
    ...(await contexteFormulaire()),
  });
}

export async function modifier(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const cible = await utilisateurs.chargerAccessible(req.utilisateur!, id);
  await traiterFormulaire(
    res,
    async () => {
      const u = await utilisateurs.modifier(req.utilisateur!, id, champsFormulaire(req.body));
      return { message: `Compte de ${u.prenom} ${u.nom} mis à jour.`, redirection: '/admin/utilisateurs' };
    },
    async (erreurs, status) => {
      res.status(status).render('admin/utilisateur-form', {
        titre: `Modifier ${cible.prenom} ${cible.nom}`,
        cible,
        valeurs: { ...req.body, motDePasse: '' },
        erreurs,
        ...(await contexteFormulaire()),
      });
    }
  );
}

export async function supprimer(req: Request, res: Response): Promise<void> {
  await traiterAction(req, res, '/admin/utilisateurs', async () => {
    await utilisateurs.supprimer(req.utilisateur!, String(req.params.id));
    return 'Compte supprimé (ainsi que ses inscriptions).';
  });
}
