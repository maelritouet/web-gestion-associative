import path from 'path';
import express, { Express } from 'express';
import session, { Store } from 'express-session';
import helmet from 'helmet';
import { env } from './config/env';
import { chargerUtilisateur } from './middlewares/auth';
import { flash, genererJetonCsrf } from './middlewares/securite';
import { gestionnaireErreurs, routeIntrouvable } from './middlewares/erreurs';
import publicRoutes from './routes/publicRoutes';
import adminRoutes from './routes/adminRoutes';
import apiRoutes from './routes/apiRoutes';
import { LIBELLES_CATEGORIES } from './models/Evenement';
import { formaterDate, versInputDate } from './utils/outils';

const RACINE = path.join(__dirname, '..');

/**
 * Fabrique l'application Express sans la démarrer : server.ts l'écoute sur un port,
 * les tests l'utilisent directement avec Supertest.
 */
export function creerApp(options: { sessionStore?: Store } = {}): Express {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(RACINE, 'views'));
  app.set('trust proxy', 1); // derrière un reverse-proxy (HTTPS terminé en amont)
  app.disable('x-powered-by');

  // En-têtes de sécurité HTTP (CSP, anti-clickjacking, nosniff…)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'style-src': ["'self'", 'https://fonts.googleapis.com'],
          // Attributs style="" autorisés (jauges de remplissage) : ils ne peuvent pas exécuter de script.
          'style-src-attr': ["'unsafe-inline'"],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'script-src': ["'self'"],
          'form-action': ["'self'"],
          'upgrade-insecure-requests': env.isProd ? [] : null,
        },
      },
    })
  );

  app.use(express.static(path.join(RACINE, 'public'), { maxAge: env.isProd ? '1d' : 0 }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use(
    session({
      name: 'vie-asso.sid',
      secret: env.sessionSecret,
      store: options.sessionStore, // MongoStore en production, mémoire en test
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true, // inaccessible au JavaScript de la page (limite l'impact d'une XSS)
        sameSite: 'lax', // non envoyé sur les POST venant d'autres sites (anti-CSRF)
        secure: env.isProd,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  // Variables disponibles dans toutes les vues EJS
  app.locals.formaterDate = formaterDate;
  app.locals.versInputDate = versInputDate;
  app.locals.categories = LIBELLES_CATEGORIES;
  app.use((req, res, next) => {
    res.locals.cheminCourant = req.originalUrl.split('?')[0];
    /** Lien vers une autre page de résultats en conservant les filtres actuels. */
    res.locals.lienPage = (page: number) => {
      const params = new URLSearchParams();
      for (const [cle, valeur] of Object.entries(req.query)) {
        if (typeof valeur === 'string' && valeur && cle !== 'page') params.set(cle, valeur);
      }
      params.set('page', String(page));
      return `?${params.toString()}`;
    };
    next();
  });

  app.use(chargerUtilisateur);
  app.use(genererJetonCsrf);

  app.use('/api', apiRoutes);
  app.use(flash);
  app.use('/admin', adminRoutes);
  app.use('/', publicRoutes);

  app.use(routeIntrouvable);
  app.use(gestionnaireErreurs);

  return app;
}
