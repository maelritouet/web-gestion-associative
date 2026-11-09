import { Router } from 'express';
import * as auth from '../controllers/api/authApiController';
import {
  associationsApi,
  evenementsApi,
  index,
  inscriptionsApi,
  utilisateursApi,
} from '../controllers/api/ressourcesApiController';
import { exigerConnexion } from '../middlewares/auth';
import { exigerJsonPourEcriture } from '../middlewares/securite';
import { reglesConnexion, reglesInscription } from '../middlewares/validation';
import { limiteurAuth } from '../middlewares/limiteur';

/** API REST JSON (/api) : CRUD complet sur les 4 ressources. */
const router = Router();
router.use(exigerJsonPourEcriture);

router.get('/', index);

router.post('/auth/inscription', limiteurAuth, reglesInscription, auth.inscrire);
router.post('/auth/connexion', limiteurAuth, reglesConnexion, auth.connecter);
router.post('/auth/deconnexion', auth.deconnecter);
router.get('/auth/moi', exigerConnexion, auth.moi);

router.get('/utilisateurs', exigerConnexion, utilisateursApi.lister);
router.post('/utilisateurs', exigerConnexion, utilisateursApi.creer);
router.get('/utilisateurs/:id', exigerConnexion, utilisateursApi.lire);
router.patch('/utilisateurs/:id', exigerConnexion, utilisateursApi.modifier);
router.delete('/utilisateurs/:id', exigerConnexion, utilisateursApi.supprimer);

router.get('/associations', associationsApi.lister);
router.post('/associations', exigerConnexion, associationsApi.creer);
router.get('/associations/:id', associationsApi.lire);
router.patch('/associations/:id', exigerConnexion, associationsApi.modifier);
router.delete('/associations/:id', exigerConnexion, associationsApi.supprimer);

router.get('/evenements', evenementsApi.lister);
router.post('/evenements', exigerConnexion, evenementsApi.creer);
router.get('/evenements/:id', evenementsApi.lire);
router.patch('/evenements/:id', exigerConnexion, evenementsApi.modifier);
router.delete('/evenements/:id', exigerConnexion, evenementsApi.supprimer);
router.get('/evenements/:id/inscrits', exigerConnexion, evenementsApi.inscrits);

router.get('/inscriptions', exigerConnexion, inscriptionsApi.lister);
router.post('/inscriptions', exigerConnexion, inscriptionsApi.creer);
router.get('/inscriptions/:id', exigerConnexion, inscriptionsApi.lire);
router.patch('/inscriptions/:id', exigerConnexion, inscriptionsApi.modifier);
router.delete('/inscriptions/:id', exigerConnexion, inscriptionsApi.supprimer);

export default router;
