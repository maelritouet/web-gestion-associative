# Feuille de route

Les tâches sont à reporter en *issues* GitHub/GitLab (une case = une issue), regroupées par *milestone*.
Répartition proposée pour un groupe de trois : **A** = données & API, **B** = front public, **C** = back-office.

## Jalon 1 — Fondations ✅

- [x] Cahier des charges, rôles et règles métier (tous)
- [x] Initialisation du dépôt, TypeScript strict, Express 5, structure MVC (A)
- [x] Modèles Mongoose : Utilisateur, Association, Evenement, Inscription + index (A)
- [x] Connexion MongoDB, sessions stockées en base (A)

## Jalon 2 — Authentification et droits ✅

- [x] Inscription / connexion / déconnexion, hachage bcrypt, régénération de session (A)
- [x] Middlewares `exigerConnexion`, `exigerBackOffice`, `exigerAdmin` (A)
- [x] Module `permissions` centralisé (admin / responsable de *son* association / étudiant) (A)
- [x] Protection CSRF des formulaires, Helmet + CSP, limitation des tentatives (A)

## Jalon 3 — Front public ✅

- [x] Gabarit commun, feuille de style, design « ticket » responsive (B)
- [x] Accueil, liste et fiche des associations (B)
- [x] Liste des événements : recherche, filtres, pagination ; fiche détaillée (B)
- [x] Inscription / annulation / réinscription ; page « Mes inscriptions » ; profil (B)

## Jalon 4 — Back-office ✅

- [x] Tableau de bord (C)
- [x] CRUD associations avec téléversement de logo, activation / désactivation (C)
- [x] CRUD événements, publication (C)
- [x] Liste des inscrits, actions sur les inscriptions, export CSV (C)
- [x] Gestion des comptes et des rôles (C)

## Jalon 5 — API REST ✅

- [x] CRUD JSON des 4 ressources + authentification (A)
- [x] Documentation de l'API (A)

## Jalon 6 — Qualité ✅

- [x] Tests : règles de droits, modèles, règles métier (dont concurrence), API, pages HTML (tous)
- [x] Données de démonstration (`npm run seed`) et mode démo sans MongoDB (`npm run demo`) (A)
- [x] README, schéma des données, journal de suivi (tous)

## Jalon 7 — Évolutions possibles (backlog)

- [ ] Liste d'attente automatique quand un événement est complet
- [ ] Email de confirmation d'inscription / rappel la veille
- [ ] Mot de passe oublié (lien de réinitialisation)
- [ ] Image de couverture pour les événements
- [ ] Un responsable pour plusieurs associations
- [ ] Intégration continue (GitHub Actions : `npm run typecheck && npm test`)
- [ ] Déploiement (Render / Railway + MongoDB Atlas)
