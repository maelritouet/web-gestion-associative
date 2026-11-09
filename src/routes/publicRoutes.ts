import { Router } from 'express';
import * as auth from '../controllers/public/authController';
import * as site from '../controllers/public/siteController';
import * as inscriptions from '../controllers/public/inscriptionController';
import { exigerConnexion } from '../middlewares/auth';
import { reglesConnexion, reglesInscription } from '../middlewares/validation';
import { limiteurAuth } from '../middlewares/limiteur';
import { verifierCsrf } from '../middlewares/securite';

/** Front public : consultation, compte, inscriptions aux événements. */
const router = Router();
router.use(verifierCsrf);

router.get('/', site.accueil);

// Authentification
router.get('/inscription', auth.afficherInscription);
router.post('/inscription', limiteurAuth, reglesInscription, auth.inscrire);
router.get('/connexion', auth.afficherConnexion);
router.post('/connexion', limiteurAuth, reglesConnexion, auth.connecter);
router.post('/deconnexion', auth.deconnecter);
router.get('/profil', exigerConnexion, auth.afficherProfil);
router.post('/profil', exigerConnexion, auth.modifierProfil);

// Consultation
router.get('/associations', site.listerAssociations);
router.get('/associations/:id', site.afficherAssociation);
router.get('/evenements', site.listerEvenements);
router.get('/evenements/:id', site.afficherEvenement);

// Inscriptions de l'utilisateur connecté
router.post('/evenements/:id/inscription', exigerConnexion, inscriptions.inscrire);
router.get('/mes-inscriptions', exigerConnexion, inscriptions.mesInscriptions);
router.post('/mes-inscriptions/:id/annuler', exigerConnexion, inscriptions.annuler);

export default router;
