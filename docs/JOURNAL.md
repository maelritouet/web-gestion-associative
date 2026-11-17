# Journal de suivi

Format : date, ce qui a été fait, problèmes rencontrés et décisions prises.

## 2026-11-09 — Mise en place complète

**Réalisé**

- Analyse du sujet, rédaction du cahier des charges et des règles métier.
- Choix techniques alignés sur les TP MVC : TypeScript (strict), Express 5, Mongoose 9, EJS, express-validator.
- Modèles et index, couche services (droits + règles métier), contrôleurs et routes séparés pour le front, le back-office et l'API.
- Vues EJS et feuille de style (concept graphique « ticket » : talon de date détachable + jauge de places).
- Suite de tests Vitest + Supertest sur une vraie base MongoDB en mémoire (61 tests).
- Données de démonstration, mode `npm run demo`, documentation.

**Problèmes rencontrés et corrections**

| Problème | Cause | Correction |
|---|---|---|
| Un mot de passe trop court était accepté | `this.invalidate()` dans un hook `pre('save')` arrive **après** la validation | Règle `minlength` dans le schéma (la validation précède le hachage) — détecté par un test |
| Les responsables recevaient « 403 » sur leurs propres événements | L'utilisateur connecté est chargé avec `populate('association')` : `String(document)` ne donne pas l'identifiant | Fonction `idDe()` qui accepte id, chaîne ou document peuplé + test de non-régression |
| Formulaire d'événement : une seule erreur affichée | L'association manquante levait une erreur avant la validation Mongoose | On laisse Mongoose valider tous les champs ensemble |
| Route `/:action(annuler\|...)` refusée | Express 5 (path-to-regexp v8) ne supporte plus les regex dans les chemins | Paramètre simple, validé dans le contrôleur |
| Filtres affichés en colonne sur ordinateur | `grid-template-columns: 2fr repeat(auto-fit, …)` est invalide (auto-fit + `fr`) | Mise en page flex avec retour à la ligne |
| Largeur de police (axe `wdth`) sans effet | `font-variation-settings` sur `body` écrasait `font-stretch` | Suppression de la règle |

**Décisions**

- Compteur `nbInscrits` dénormalisé pour une réservation de place atomique (pas de transaction nécessaire, donc pas besoin de replica set).
- Les annulations conservent l'inscription (`statut: annulee`) pour l'historique ; une réinscription la réactive.
- L'API partage la session du site ; la protection CSRF de l'API repose sur `SameSite=Lax` + l'obligation d'un corps JSON.

## 2026-11-17 — Dépôt GitHub et base MongoDB locale

**Réalisé**

- Publication du dépôt sur GitHub (`maelritouet/web-gestion-associative`).
- Relecture du README pour le rendre plus lisible ; ajout de l'équipe (Mael, Thibault, Shahan).
- Installation de MongoDB et de Compass en local ; `.env` pointe sur `mongodb://127.0.0.1:27017/vie-associative`.
- Vérification point par point de l'application par rapport au sujet.

**Problèmes / décisions**

- Les tests et `npm run demo` gardent une base en mémoire, pour ne jamais écraser la base locale.

**Prochaine étape** : reporter la feuille de route en issues GitHub, répartir les tâches entre les trois membres et préparer la présentation.

## Modèle pour les prochaines entrées

```
## AAAA-MM-JJ — Titre
**Réalisé** : …
**Problèmes / décisions** : …
**Prochaine étape** : …
```
