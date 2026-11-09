import { Request, Response } from 'express';
import * as utilisateurs from '../../services/utilisateurService';
import * as associations from '../../services/associationService';
import * as evenements from '../../services/evenementService';
import * as inscriptions from '../../services/inscriptionService';
import { Association } from '../../models/Association';
import { accedeAuBackOffice } from '../../services/permissions';
import { requeteInvalide } from '../../services/erreurs';
import { texte } from '../../utils/outils';
import type { StatutInscription } from '../../models/Inscription';

/**
 * Contrôleurs de l'API REST. Chaque fonction se contente de traduire HTTP <-> service ;
 * les règles métier et les droits sont dans les services (partagés avec le back-office).
 * Les erreurs levées sont converties en JSON par le gestionnaire d'erreurs global.
 */

const id = (req: Request) => String(req.params.id);
const corps = (req: Request): Record<string, unknown> => (req.body && typeof req.body === 'object' ? req.body : {});

/* ---------------------------- Utilisateurs ---------------------------- */

export const utilisateursApi = {
  async lister(req: Request, res: Response) {
    res.json(await utilisateurs.lister(req.utilisateur!, { q: texte(req.query.q), role: texte(req.query.role) }));
  },
  async lire(req: Request, res: Response) {
    res.json(await utilisateurs.chargerAccessible(req.utilisateur!, id(req)));
  },
  async creer(req: Request, res: Response) {
    res.status(201).json(await utilisateurs.creer(req.utilisateur!, corps(req)));
  },
  async modifier(req: Request, res: Response) {
    res.json(await utilisateurs.modifier(req.utilisateur!, id(req), corps(req)));
  },
  async supprimer(req: Request, res: Response) {
    await utilisateurs.supprimer(req.utilisateur!, id(req));
    res.status(204).end();
  },
};

/* ---------------------------- Associations ---------------------------- */

export const associationsApi = {
  /** Public : associations actives. Gestionnaire avec ?gestion=1 : toutes celles qu'il gère. */
  async lister(req: Request, res: Response) {
    if (req.query.gestion && accedeAuBackOffice(req.utilisateur)) {
      res.json(await associations.listerPourGestion(req.utilisateur!));
      return;
    }
    res.json(await associations.listerActives(texte(req.query.q)));
  },
  async lire(req: Request, res: Response) {
    // Un gestionnaire peut lire son association même inactive.
    if (req.utilisateur && accedeAuBackOffice(req.utilisateur)) {
      try {
        res.json(await associations.chargerModifiable(req.utilisateur, id(req)));
        return;
      } catch {
        /* pas gestionnaire de celle-ci : on retombe sur la vue publique */
      }
    }
    const { association, evenements: aVenir } = await associations.trouverPublique(id(req));
    res.json({ ...association.toJSON(), evenements: aVenir });
  },
  async creer(req: Request, res: Response) {
    res.status(201).json(await associations.creer(req.utilisateur!, corps(req)));
  },
  async modifier(req: Request, res: Response) {
    res.json(await associations.modifier(req.utilisateur!, id(req), corps(req)));
  },
  async supprimer(req: Request, res: Response) {
    await associations.supprimer(req.utilisateur!, id(req));
    res.status(204).end();
  },
};

/* ----------------------------- Événements ----------------------------- */

const filtresDepuis = (req: Request) => ({
  q: texte(req.query.q),
  categorie: texte(req.query.categorie),
  association: texte(req.query.association),
  quand: texte(req.query.quand),
  du: texte(req.query.du),
  au: texte(req.query.au),
  statut: texte(req.query.statut),
  page: req.query.page,
});

export const evenementsApi = {
  /** Public : événements publiés. Gestionnaire avec ?gestion=1 : tous ceux qu'il gère (brouillons inclus). */
  async lister(req: Request, res: Response) {
    const resultat =
      req.query.gestion && accedeAuBackOffice(req.utilisateur)
        ? await evenements.listerPourGestion(req.utilisateur!, filtresDepuis(req))
        : await evenements.rechercherPublics(filtresDepuis(req));
    res.json({ donnees: resultat.evenements, total: resultat.total, page: resultat.page, pages: resultat.pages });
  },
  async lire(req: Request, res: Response) {
    if (req.utilisateur && accedeAuBackOffice(req.utilisateur)) {
      try {
        const evenement = await evenements.chargerGerable(req.utilisateur, id(req));
        res.json(await evenement.populate('association', 'nom logo statut'));
        return;
      } catch {
        /* non gestionnaire : vue publique */
      }
    }
    res.json(await evenements.trouverPublic(id(req)));
  },
  async creer(req: Request, res: Response) {
    res.status(201).json(await evenements.creer(req.utilisateur!, corps(req)));
  },
  async modifier(req: Request, res: Response) {
    res.json(await evenements.modifier(req.utilisateur!, id(req), corps(req)));
  },
  async supprimer(req: Request, res: Response) {
    await evenements.supprimer(req.utilisateur!, id(req));
    res.status(204).end();
  },
  async inscrits(req: Request, res: Response) {
    const statut = texte(req.query.statut) as StatutInscription | undefined;
    const { inscriptions: liste } = await inscriptions.listerInscrits(req.utilisateur!, id(req), statut);
    res.json(liste);
  },
};

/* ---------------------------- Inscriptions ---------------------------- */

export const inscriptionsApi = {
  async lister(req: Request, res: Response) {
    res.json(
      await inscriptions.listerPourApi(req.utilisateur!, {
        evenement: texte(req.query.evenement),
        statut: texte(req.query.statut),
      })
    );
  },
  async lire(req: Request, res: Response) {
    const inscription = await inscriptions.chargerAutorisee(req.utilisateur!, id(req));
    res.json(await inscription.populate([
      { path: 'utilisateur', select: 'prenom nom email' },
      { path: 'evenement', select: 'titre date lieu' },
    ]));
  },
  /** POST { evenement } : l'utilisateur connecté s'inscrit lui-même. */
  async creer(req: Request, res: Response) {
    const evenement = texte(corps(req).evenement);
    if (!evenement) throw requeteInvalide('Le champ « evenement » est obligatoire', { evenement: 'Obligatoire' });
    res.status(201).json(await inscriptions.inscrire(req.utilisateur!._id, evenement));
  },
  /** PATCH { statut: "annulee" | "confirmee" } */
  async modifier(req: Request, res: Response) {
    const statut = texte(corps(req).statut);
    if (statut !== 'annulee' && statut !== 'confirmee') {
      throw requeteInvalide('Statut invalide', { statut: 'Valeurs possibles : confirmee, annulee' });
    }
    const inscription = await inscriptions.chargerAutorisee(req.utilisateur!, id(req));
    res.json(await inscriptions.changerStatut(inscription, statut));
  },
  async supprimer(req: Request, res: Response) {
    const inscription = await inscriptions.chargerAutorisee(req.utilisateur!, id(req));
    await inscriptions.supprimer(inscription);
    res.status(204).end();
  },
};

/** GET /api : petite page d'aide listant les routes disponibles. */
export async function index(_req: Request, res: Response): Promise<void> {
  res.json({
    nom: 'API Vie associative',
    associationsActives: await Association.countDocuments({ statut: 'active' }),
    routes: {
      auth: ['POST /api/auth/inscription', 'POST /api/auth/connexion', 'POST /api/auth/deconnexion', 'GET /api/auth/moi'],
      utilisateurs: ['GET /api/utilisateurs', 'GET|PATCH|DELETE /api/utilisateurs/:id', 'POST /api/utilisateurs'],
      associations: ['GET /api/associations', 'GET|PATCH|DELETE /api/associations/:id', 'POST /api/associations'],
      evenements: [
        'GET /api/evenements?q=&categorie=&association=&quand=&du=&au=&page=',
        'GET|PATCH|DELETE /api/evenements/:id',
        'POST /api/evenements',
        'GET /api/evenements/:id/inscrits',
      ],
      inscriptions: ['GET /api/inscriptions', 'POST /api/inscriptions', 'GET|PATCH|DELETE /api/inscriptions/:id'],
    },
  });
}
