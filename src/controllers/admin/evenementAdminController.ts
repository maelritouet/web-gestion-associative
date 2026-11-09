import { Request, Response } from 'express';
import * as evenements from '../../services/evenementService';
import * as associations from '../../services/associationService';
import * as inscriptions from '../../services/inscriptionService';
import type { StatutEvenement } from '../../models/Evenement';
import { texte, versInputDate } from '../../utils/outils';
import { estAdmin } from '../../services/permissions';
import { traiterAction, traiterFormulaire } from './outilsAdmin';
import { cheminInterne } from '../../utils/session';
import { ErreurHttp } from '../../services/erreurs';

function donneesFormulaire(body: Record<string, unknown>) {
  const date = texte(body.date);
  return {
    titre: texte(body.titre),
    description: texte(body.description),
    date: date ? new Date(date) : undefined,
    lieu: texte(body.lieu),
    capacite: texte(body.capacite),
    categorie: texte(body.categorie),
    statut: body.statut === 'publie' ? 'publie' : 'brouillon',
    ...(body.association !== undefined ? { association: texte(body.association) } : {}),
  };
}

async function contexteFormulaire(req: Request) {
  return { associations: await associations.listerPourGestion(req.utilisateur!) };
}

export async function lister(req: Request, res: Response): Promise<void> {
  const filtres = {
    q: texte(req.query.q),
    statut: texte(req.query.statut),
    association: texte(req.query.association),
    quand: texte(req.query.quand) ?? 'tous',
    page: req.query.page,
  };
  const [resultat, listeAssociations] = await Promise.all([
    evenements.listerPourGestion(req.utilisateur!, filtres),
    estAdmin(req.utilisateur) ? associations.listerPourGestion(req.utilisateur!) : Promise.resolve([]),
  ]);
  res.render('admin/evenements', { titre: 'Événements', ...resultat, filtres, associations: listeAssociations });
}

export async function formulaireCreation(req: Request, res: Response): Promise<void> {
  res.render('admin/evenement-form', {
    titre: 'Nouvel événement',
    evenement: null,
    valeurs: { statut: 'brouillon', capacite: 50, association: req.utilisateur!.association?._id?.toString() },
    erreurs: {},
    ...(await contexteFormulaire(req)),
  });
}

export async function creer(req: Request, res: Response): Promise<void> {
  await traiterFormulaire(
    res,
    async () => {
      const evenement = await evenements.creer(req.utilisateur!, donneesFormulaire(req.body));
      return { message: `Événement « ${evenement.titre} » créé.`, redirection: '/admin/evenements' };
    },
    async (erreurs, status) => {
      res.status(status).render('admin/evenement-form', {
        titre: 'Nouvel événement',
        evenement: null,
        valeurs: req.body,
        erreurs,
        ...(await contexteFormulaire(req)),
      });
    }
  );
}

export async function formulaireModification(req: Request, res: Response): Promise<void> {
  const evenement = await evenements.chargerGerable(req.utilisateur!, String(req.params.id));
  res.render('admin/evenement-form', {
    titre: `Modifier « ${evenement.titre} »`,
    evenement,
    valeurs: { ...evenement.toObject(), date: versInputDate(evenement.date), association: String(evenement.association) },
    erreurs: {},
    ...(await contexteFormulaire(req)),
  });
}

export async function modifier(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const evenement = await evenements.chargerGerable(req.utilisateur!, id);
  await traiterFormulaire(
    res,
    async () => {
      const modifie = await evenements.modifier(req.utilisateur!, id, donneesFormulaire(req.body));
      return { message: `Événement « ${modifie.titre} » mis à jour.`, redirection: '/admin/evenements' };
    },
    async (erreurs, status) => {
      res.status(status).render('admin/evenement-form', {
        titre: `Modifier « ${evenement.titre} »`,
        evenement,
        valeurs: req.body,
        erreurs,
        ...(await contexteFormulaire(req)),
      });
    }
  );
}

export async function changerStatut(req: Request, res: Response): Promise<void> {
  const statut = texte(req.body.statut) as StatutEvenement;
  await traiterAction(req, res, cheminInterne(req.body.retour, '/admin/evenements'), async () => {
    const evenement = await evenements.changerStatut(req.utilisateur!, String(req.params.id), statut);
    return `Événement « ${evenement.titre} » ${statut === 'publie' ? 'publié' : 'repassé en brouillon'}.`;
  });
}

export async function supprimer(req: Request, res: Response): Promise<void> {
  await traiterAction(req, res, '/admin/evenements', async () => {
    await evenements.supprimer(req.utilisateur!, String(req.params.id));
    return 'Événement et inscriptions associées supprimés.';
  });
}

export async function inscrits(req: Request, res: Response): Promise<void> {
  const { evenement, inscriptions: liste } = await inscriptions.listerInscrits(req.utilisateur!, String(req.params.id));
  res.render('admin/inscrits', { titre: `Inscrits — ${evenement.titre}`, evenement, inscriptions: liste });
}

/**
 * Neutralise l'injection de formules CSV : une cellule commençant par = + - @ serait exécutée
 * comme formule par Excel/LibreOffice. On la préfixe d'une apostrophe et on échappe les guillemets.
 */
function celluleCsv(valeur: unknown): string {
  let s = String(valeur ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function exporterCsv(req: Request, res: Response): Promise<void> {
  const { evenement, inscriptions: liste } = await inscriptions.listerInscrits(req.utilisateur!, String(req.params.id), 'confirmee');
  const lignes = [['Prénom', 'Nom', 'Email', "Date d'inscription"].map(celluleCsv).join(';')];
  for (const i of liste) {
    const u = i.utilisateur as unknown as { prenom: string; nom: string; email: string } | null;
    if (!u) continue;
    lignes.push([u.prenom, u.nom, u.email, i.dateInscription.toISOString()].map(celluleCsv).join(';'));
  }
  const nomFichier = `inscrits-${evenement._id}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  res.send('﻿' + lignes.join('\r\n')); // BOM : accents corrects à l'ouverture dans Excel
}

/** Actions d'un gestionnaire sur une inscription (annuler, réactiver, supprimer). */
export async function actionInscription(req: Request, res: Response): Promise<void> {
  const action = String(req.params.action);
  if (!['annuler', 'reactiver', 'supprimer'].includes(action)) throw new ErreurHttp(404, 'Action inconnue');
  const inscription = await inscriptions.chargerAutorisee(req.utilisateur!, String(req.params.id));
  const retour = `/admin/evenements/${inscription.evenement}/inscrits`;
  await traiterAction(req, res, retour, async () => {
    if (action === 'annuler') {
      await inscriptions.annuler(inscription);
      return 'Inscription annulée.';
    }
    if (action === 'reactiver') {
      await inscriptions.changerStatut(inscription, 'confirmee');
      return 'Inscription réactivée.';
    }
    await inscriptions.supprimer(inscription);
    return 'Inscription supprimée.';
  });
}
