# Cahier des charges — Vie associative et événements

## 1. Contexte et objectif

L'école compte plusieurs associations étudiantes (BDE, bureau des sports, clubs…) qui organisent des
événements tout au long de l'année. L'information est aujourd'hui dispersée (affiches, réseaux sociaux,
formulaires en ligne) et les inscriptions se gèrent à la main, sans contrôle des places disponibles.

L'application centralise :

- la **consultation** des associations et de leurs événements ;
- l'**inscription** des étudiants aux événements, avec respect de la capacité ;
- la **gestion** des contenus par les responsables associatifs et l'administration, depuis un back-office.

## 2. Acteurs et rôles

| Rôle | Qui | Peut… |
|---|---|---|
| Visiteur | Personne non connectée | Consulter associations et événements publiés, créer un compte |
| Étudiant (`etudiant`) | Tout compte créé via le site | + s'inscrire / annuler, voir ses inscriptions, modifier son profil |
| Responsable (`responsable`) | Membre du bureau d'**une** association | + gérer les événements **de son association**, voir leurs inscrits, modifier la fiche de son association |
| Administrateur (`admin`) | Vie étudiante de l'école | Tout gérer : associations (création, activation), tous les événements, comptes et rôles |

Un compte créé depuis le site est toujours `etudiant` ; seul un administrateur peut attribuer un autre rôle.

## 3. Besoins fonctionnels

### 3.1 Front public

| # | Besoin | Priorité |
|---|---|---|
| F1 | Créer un compte (prénom, nom, email, mot de passe) | Indispensable |
| F2 | Se connecter / se déconnecter ; session persistante 7 jours | Indispensable |
| F3 | Lister les associations actives, rechercher par nom, voir une fiche (description, contact, logo, événements à venir) | Indispensable |
| F4 | Lister les événements publiés, filtrer par texte, catégorie, association, période (à venir / passés / tous) et intervalle de dates ; pagination | Indispensable |
| F5 | Voir la fiche détaillée d'un événement avec le nombre de places restantes | Indispensable |
| F6 | S'inscrire à un événement, annuler son inscription, se réinscrire | Indispensable |
| F7 | Consulter ses inscriptions (à venir, passées, annulées) | Indispensable |
| F8 | Modifier son profil et son mot de passe | Souhaitable |

### 3.2 Back-office (`/admin`)

| # | Besoin | Rôle |
|---|---|---|
| B1 | Tableau de bord : nombre d'événements, d'inscriptions, prochains événements et taux de remplissage | Admin, responsable (périmètre de son association) |
| B2 | Associations : créer, modifier (dont logo), activer / désactiver, supprimer si vide | Admin (le responsable modifie uniquement la fiche de la sienne) |
| B3 | Événements : créer, modifier, publier / dépublier, supprimer | Admin, responsable (sa seule association) |
| B4 | Liste des inscrits d'un événement, annulation / réactivation / suppression d'une inscription, export CSV | Admin, responsable |
| B5 | Comptes : créer, modifier (rôle, association gérée), supprimer | Admin |

### 3.3 API REST (`/api`)

CRUD complet en JSON sur les quatre ressources (utilisateurs, associations, événements, inscriptions) et
routes d'authentification. Mêmes règles de droits que le back-office. Voir [API.md](API.md).

## 4. Règles métier

1. **Pas de double inscription** : un utilisateur a au plus une inscription par événement (garanti par un index unique en base, même en cas de requêtes simultanées).
2. **Capacité maximale** : le nombre d'inscriptions confirmées ne dépasse jamais la capacité (réservation atomique).
3. On ne peut s'inscrire qu'à un événement **publié**, **à venir**, dont l'association est **active**.
4. Une annulation **libère la place** ; l'inscription est conservée avec le statut `annulee` (historique) et peut être réactivée.
5. La capacité d'un événement ne peut pas descendre sous le nombre d'inscrits confirmés.
6. Un responsable ne gère **que** les données de son association ; il ne peut ni changer l'association organisatrice d'un événement, ni activer/désactiver une association.
7. Désactiver une association masque ses événements et ferme leurs inscriptions.
8. Supprimer un événement supprime ses inscriptions ; supprimer un compte supprime ses inscriptions et libère les places.
9. Une association n'est supprimable que si elle n'a ni événement ni responsable (sinon : désactivation).
10. Il reste toujours au moins un administrateur.

## 5. Exigences non fonctionnelles

- **Technique** : TypeScript, Node.js + Express 5, MongoDB + Mongoose, vues EJS, CSS sans framework.
- **Architecture** : MVC (models, views, controllers, routes) + couche *services* pour les règles métier partagées entre API et back-office ; front public, back-office et API dans des routeurs séparés.
- **Sécurité** : mots de passe hachés (bcrypt), sessions en base avec cookie `HttpOnly` + `SameSite=Lax`, jeton CSRF sur les formulaires, en-têtes de sécurité (Helmet, CSP stricte), validation des entrées, liste blanche des champs modifiables, limitation des tentatives de connexion, contrôle du type réel des fichiers téléversés.
- **Ergonomie** : interface en français, responsive (mobile → bureau), accessible au clavier, fonctionne sans JavaScript (le JS n'ajoute que des confirmations).
- **Qualité** : tests automatisés (unitaires, intégration API et pages), typage strict.

## 6. Hors périmètre (pistes d'évolution)

Liste d'attente quand un événement est complet, notifications par email, paiement en ligne,
rattachement d'un responsable à plusieurs associations, import d'événements récurrents.
