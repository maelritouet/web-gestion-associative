# API REST

Base : `/api`. Corps et réponses en JSON. L'authentification utilise le **même cookie de session** que le
site : après `POST /api/auth/connexion`, renvoyer le cookie `vie-asso.sid` à chaque requête.

Les requêtes d'écriture (`POST`, `PATCH`) doivent avoir l'en-tête `Content-Type: application/json`
(sinon `415`) : c'est ce qui empêche un formulaire d'un autre site d'appeler l'API avec le cookie de
l'utilisateur.

## Codes de réponse

| Code | Sens |
|---|---|
| 200 / 201 / 204 | Succès / ressource créée / supprimée (pas de corps) |
| 400 | Données invalides : `{ "erreur": "...", "details": { "champ": "message" } }` |
| 401 | Non connecté |
| 403 | Connecté mais pas les droits |
| 404 | Introuvable (ou non visible pour vous, ex. un brouillon) |
| 409 | Conflit métier : déjà inscrit, complet, email déjà utilisé… |
| 415 | Corps non JSON |

## Authentification

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/auth/inscription` | `{ prenom, nom, email, motDePasse }` | 201 + utilisateur (rôle toujours `etudiant`) |
| POST | `/auth/connexion` | `{ email, motDePasse }` | 200 + utilisateur |
| POST | `/auth/deconnexion` | — | 204 |
| GET | `/auth/moi` | — | utilisateur connecté |

## Utilisateurs

| Méthode | Route | Droits |
|---|---|---|
| GET | `/utilisateurs?q=&role=` | admin |
| POST | `/utilisateurs` `{ prenom, nom, email, motDePasse, role, association }` | admin |
| GET | `/utilisateurs/:id` | admin ou soi-même |
| PATCH | `/utilisateurs/:id` | admin (tous champs) ou soi-même (`prenom, nom, email, motDePasse` uniquement) |
| DELETE | `/utilisateurs/:id` | admin (supprime aussi ses inscriptions) |

## Associations

| Méthode | Route | Droits |
|---|---|---|
| GET | `/associations?q=` | public (actives) ; `?gestion=1` : celles que vous gérez |
| POST | `/associations` `{ nom, description, contact: { email, telephone, siteWeb }, statut }` | admin |
| GET | `/associations/:id` | public (active, avec ses événements à venir) ; gestionnaire (même inactive) |
| PATCH | `/associations/:id` | admin ; responsable de l'association (sauf `statut`) |
| DELETE | `/associations/:id` | admin, si aucun événement ni responsable (sinon 409) |

## Événements

| Méthode | Route | Droits |
|---|---|---|
| GET | `/evenements?q=&categorie=&association=&quand=a-venir\|passes\|tous&du=AAAA-MM-JJ&au=&page=` | public (publiés) ; `?gestion=1&statut=` : ceux que vous gérez |
| POST | `/evenements` `{ titre, description, date, lieu, capacite, categorie, association, statut }` | admin ; responsable (association forcée à la sienne) |
| GET | `/evenements/:id` | public si publié ; gestionnaire sinon |
| PATCH | `/evenements/:id` | gestionnaire de l'association (changer d'association : admin) |
| DELETE | `/evenements/:id` | gestionnaire (supprime aussi les inscriptions) |
| GET | `/evenements/:id/inscrits?statut=` | gestionnaire |

Réponse de la liste : `{ "donnees": [...], "total": 12, "page": 1, "pages": 2 }`.
`nbInscrits` n'est jamais modifiable directement.

## Inscriptions

| Méthode | Route | Droits |
|---|---|---|
| GET | `/inscriptions?evenement=&statut=` | les siennes ; admin : toutes ; gestionnaire : celles de ses événements avec `?evenement=` |
| POST | `/inscriptions` `{ evenement }` | connecté (s'inscrit soi-même) |
| GET | `/inscriptions/:id` | propriétaire ou gestionnaire |
| PATCH | `/inscriptions/:id` `{ statut: "annulee" \| "confirmee" }` | propriétaire ou gestionnaire |
| DELETE | `/inscriptions/:id` | propriétaire ou gestionnaire (libère la place) |

## Exemple avec curl

```bash
# Connexion (le cookie est stocké dans cookies.txt)
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"etudiant@isen.example","motDePasse":"Motdepasse1"}' http://localhost:3000/api/auth/connexion

# Événements sportifs à venir
curl 'http://localhost:3000/api/evenements?categorie=sport'

# S'inscrire
curl -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"evenement":"<id>"}' http://localhost:3000/api/inscriptions
```
