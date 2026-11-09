import { Request, Response } from 'express';
import * as associations from '../../services/associationService';
import { enregistrerLogo, supprimerLogo } from '../../utils/fichiers';
import { texte } from '../../utils/outils';
import { traiterAction, traiterFormulaire } from './outilsAdmin';
import type { StatutAssociation } from '../../models/Association';

/** Convertit les champs à plat du formulaire HTML en objet attendu par le modèle. */
function donneesFormulaire(body: Record<string, unknown>) {
  return {
    nom: texte(body.nom),
    description: texte(body.description),
    contact: {
      email: texte(body.contactEmail),
      telephone: texte(body.contactTelephone) ?? '',
      siteWeb: texte(body.contactSiteWeb) ?? '',
    },
    ...(body.statut !== undefined ? { statut: texte(body.statut) } : {}),
  };
}

function valeursDepuis(association: Record<string, any>) {
  return {
    nom: association.nom,
    description: association.description,
    contactEmail: association.contact?.email,
    contactTelephone: association.contact?.telephone,
    contactSiteWeb: association.contact?.siteWeb,
    statut: association.statut,
    logo: association.logo,
  };
}

export async function lister(req: Request, res: Response): Promise<void> {
  res.render('admin/associations', {
    titre: 'Associations',
    associations: await associations.listerPourGestion(req.utilisateur!),
  });
}

export function formulaireCreation(_req: Request, res: Response): void {
  res.render('admin/association-form', { titre: 'Nouvelle association', association: null, valeurs: { statut: 'active' }, erreurs: {} });
}

export async function creer(req: Request, res: Response): Promise<void> {
  let logo: string | null = null;
  await traiterFormulaire(
    res,
    async () => {
      if (req.file) logo = await enregistrerLogo(req.file);
      const association = await associations.creer(req.utilisateur!, { ...donneesFormulaire(req.body), logo });
      return { message: `Association « ${association.nom} » créée.`, redirection: '/admin/associations' };
    },
    async (erreurs, status) => {
      if (logo) await supprimerLogo(logo); // pas de fichier orphelin si la validation échoue
      res.status(status).render('admin/association-form', { titre: 'Nouvelle association', association: null, valeurs: req.body, erreurs });
    }
  );
}

export async function formulaireModification(req: Request, res: Response): Promise<void> {
  const association = await associations.chargerModifiable(req.utilisateur!, String(req.params.id));
  res.render('admin/association-form', {
    titre: `Modifier ${association.nom}`,
    association,
    valeurs: valeursDepuis(association.toObject()),
    erreurs: {},
  });
}

export async function modifier(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const association = await associations.chargerModifiable(req.utilisateur!, id);
  let logo: string | null = null;
  await traiterFormulaire(
    res,
    async () => {
      const donnees: Record<string, unknown> = donneesFormulaire(req.body);
      if (req.file) donnees.logo = logo = await enregistrerLogo(req.file);
      else if (req.body.retirerLogo === 'on') donnees.logo = null;
      const modifiee = await associations.modifier(req.utilisateur!, id, donnees);
      return { message: `Association « ${modifiee.nom} » mise à jour.`, redirection: '/admin/associations' };
    },
    async (erreurs, status) => {
      if (logo) await supprimerLogo(logo);
      res.status(status).render('admin/association-form', {
        titre: `Modifier ${association.nom}`,
        association,
        valeurs: { ...req.body, logo: association.logo },
        erreurs,
      });
    }
  );
}

export async function changerStatut(req: Request, res: Response): Promise<void> {
  const statut = texte(req.body.statut) as StatutAssociation;
  await traiterAction(req, res, '/admin/associations', async () => {
    const association = await associations.changerStatut(req.utilisateur!, String(req.params.id), statut);
    return `Association « ${association.nom} » ${statut === 'active' ? 'activée' : 'désactivée'}.`;
  });
}

export async function supprimer(req: Request, res: Response): Promise<void> {
  await traiterAction(req, res, '/admin/associations', async () => {
    await associations.supprimer(req.utilisateur!, String(req.params.id));
    return 'Association supprimée.';
  });
}
