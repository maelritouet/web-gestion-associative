import { Router } from 'express';
import { tableauDeBord } from '../controllers/admin/tableauDeBordController';
import * as associations from '../controllers/admin/associationAdminController';
import * as evenements from '../controllers/admin/evenementAdminController';
import * as utilisateurs from '../controllers/admin/utilisateurAdminController';
import { exigerAdmin, exigerBackOffice, exigerConnexion } from '../middlewares/auth';
import { verifierCsrf } from '../middlewares/securite';
import { televersementLogo } from '../utils/fichiers';

/**
 * Back-office (/admin). Toutes les routes exigent d'être connecté avec le rôle
 * responsable ou admin ; les droits fins (« son » association) sont vérifiés dans les services.
 */
const router = Router();

router.use(exigerConnexion, exigerBackOffice);
// Les formulaires avec logo sont en multipart : multer doit lire le corps AVANT la vérification CSRF.
router.use(televersementLogo, verifierCsrf);

router.get('/', tableauDeBord);

// Associations (création / statut / suppression réservés à l'admin)
router.get('/associations', associations.lister);
router.get('/associations/nouvelle', exigerAdmin, associations.formulaireCreation);
router.post('/associations', exigerAdmin, associations.creer);
router.get('/associations/:id/modifier', associations.formulaireModification);
router.post('/associations/:id', associations.modifier);
router.post('/associations/:id/statut', exigerAdmin, associations.changerStatut);
router.post('/associations/:id/supprimer', exigerAdmin, associations.supprimer);

// Événements
router.get('/evenements', evenements.lister);
router.get('/evenements/nouveau', evenements.formulaireCreation);
router.post('/evenements', evenements.creer);
router.get('/evenements/:id/modifier', evenements.formulaireModification);
router.post('/evenements/:id', evenements.modifier);
router.post('/evenements/:id/statut', evenements.changerStatut);
router.post('/evenements/:id/supprimer', evenements.supprimer);
router.get('/evenements/:id/inscrits', evenements.inscrits);
router.get('/evenements/:id/inscrits.csv', evenements.exporterCsv);
router.post('/inscriptions/:id/:action', evenements.actionInscription);

// Utilisateurs (admin uniquement)
router.get('/utilisateurs', exigerAdmin, utilisateurs.lister);
router.get('/utilisateurs/nouveau', exigerAdmin, utilisateurs.formulaireCreation);
router.post('/utilisateurs', exigerAdmin, utilisateurs.creer);
router.get('/utilisateurs/:id/modifier', exigerAdmin, utilisateurs.formulaireModification);
router.post('/utilisateurs/:id', exigerAdmin, utilisateurs.modifier);
router.post('/utilisateurs/:id/supprimer', exigerAdmin, utilisateurs.supprimer);

export default router;
