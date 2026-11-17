# Vie associative ISEN

Application web pour la vie associative et les événements de l'école. C'est le projet fil rouge
du cours de Développement Web (2026-2027), écrit en TypeScript avec Node.js, Express, MongoDB et Mongoose.

Elle se compose de trois parties :

- le site public, où l'on parcourt les associations et les événements, on filtre, on réserve sa place, on l'annule et on retrouve ses inscriptions ;
- le back-office (`/admin`), où l'on gère associations, événements, inscrits et comptes selon son rôle ;
- une API REST (`/api`) qui expose en JSON le CRUD des utilisateurs, associations, événements et inscriptions.

## Démarrage rapide

Prérequis : **Node.js 20+**.

```bash
npm install
npm run demo        # MongoDB en mémoire + données de démo, rien d'autre à installer
```

Ouvrir ensuite <http://localhost:3000>. Les comptes de démo ont tous le mot de passe `Motdepasse1` :

| Email | Rôle |
|---|---|
| `admin@isen.example` | Administrateur |
| `bde@isen.example` | Responsable du BDE |
| `sport@isen.example` | Responsable du Bureau des sports |
| `etudiant@isen.example` | Étudiant |

> Au premier lancement, `npm run demo` et `npm test` téléchargent un binaire MongoDB (~120 Mo).
> Si la distribution Linux n'est pas détectée, ajouter `MONGOMS_DISTRO=ubuntu-24.04` dans `.env`.

### Avec un vrai serveur MongoDB

```bash
cp .env.example .env   # puis renseigner MONGODB_URI et SESSION_SECRET
npm run seed           # remet la base à zéro avec les données de démo (efface tout ce qui existe)
npm run dev            # serveur avec rechargement automatique
```

Production : `npm run build && npm start` (avec `NODE_ENV=production` et un `SESSION_SECRET` d'au moins 32 caractères).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (tsx watch) |
| `npm run demo` | Serveur + MongoDB en mémoire + données de démo |
| `npm run seed` | Remplit la base `MONGODB_URI` avec les données de démo |
| `npm test` | Lance les 61 tests (Vitest + Supertest, MongoDB en mémoire) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run build` / `npm start` | Compilation dans `dist/` puis exécution |

## Architecture

Le code suit le modèle MVC, avec une couche de services en plus. Les règles métier et les droits sont
écrits une seule fois dans les services, que les contrôleurs de l'API (JSON) et des pages (EJS) appellent tous les deux.

```
src/
├── app.ts                 Assemblage Express (sécurité, sessions, routeurs), sans démarrer le serveur
├── server.ts              Connexion MongoDB + écoute HTTP
├── config/                Variables d'environnement, connexion à la base
├── models/                Schémas Mongoose : Utilisateur, Association, Evenement, Inscription
├── services/              Règles métier et droits (permissions, inscriptionService, …)
├── controllers/
│   ├── public/            Pages du site public
│   ├── admin/             Pages du back-office
│   └── api/               API REST JSON
├── routes/                publicRoutes, adminRoutes, apiRoutes (front et back-office séparés)
├── middlewares/           Auth et rôles, CSRF/flash, validation, erreurs, limitation
├── utils/                 Outils (sessions, fichiers, formats)
└── scripts/               seed, démo
views/                     Gabarits EJS : partials/, public/, admin/
public/                    CSS, JS (amélioration progressive), logos téléversés
tests/                     Tests Vitest
docs/                      Cahier des charges, modèle de données, API, feuille de route, journal
```

Chemin d'une requête : `route → middlewares (connexion, rôle, CSRF) → contrôleur → service (droits + règles) → modèle Mongoose`.

## Règles métier principales

- Pas de double inscription (index unique `utilisateur + evenement`).
- Capacité jamais dépassée, même avec des requêtes simultanées (réservation atomique, voir [docs/MODELE_DONNEES.md](docs/MODELE_DONNEES.md)).
- Inscription seulement à un événement publié, à venir, d'une association active ; l'annulation libère la place.
- Un responsable ne gère que les données de son association ; l'administrateur gère tout.

## Sécurité

| Risque | Protection |
|---|---|
| Vol de mots de passe | Hachage bcrypt, champ jamais renvoyé (`select: false` + `toJSON`) |
| Énumération des comptes | Même message et même temps de réponse si l'email est inconnu ou le mot de passe faux |
| Force brute | 20 tentatives / 15 min / IP sur connexion et inscription |
| Vol / fixation de session | Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production ; session régénérée à la connexion |
| CSRF | Jeton synchronisé sur tous les formulaires ; corps JSON obligatoire pour l'API |
| XSS | Échappement EJS systématique, CSP stricte (pas de script inline) |
| Élévation de privilèges | Liste blanche des champs modifiables ; rôle forcé à `etudiant` à l'inscription ; droits vérifiés dans les services |
| Injection NoSQL / ReDoS | Paramètres convertis en chaînes, identifiants validés, recherches échappées |
| Téléversement malveillant | Type vérifié par les octets du fichier (PNG/JPEG/WebP/GIF), 2 Mo max, nom aléatoire |
| Injection de formules CSV | Cellules commençant par `= + - @` neutralisées à l'export |
| Redirection ouverte | Redirections limitées aux chemins internes |

## Tests

```bash
npm test
```

Les 61 tests sont répartis en 5 fichiers : les droits (fonctions pures), la validation des modèles, les règles
d'inscription (avec un cas de 25 inscriptions simultanées pour 5 places), l'API (CRUD et droits pour chaque rôle),
et les pages HTML du site et du back-office (CSRF, redirections, téléversement, export CSV).

## Documentation

- [Cahier des charges](docs/CAHIER_DES_CHARGES.md)
- [Modèle de données et relations](docs/MODELE_DONNEES.md)
- [Référence de l'API](docs/API.md)
- [Feuille de route](docs/FEUILLE_DE_ROUTE.md)
- [Journal de suivi](docs/JOURNAL.md)
