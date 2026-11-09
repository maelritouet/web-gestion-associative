import request from 'supertest';
import { creerApp } from '../src/app';
import { Association } from '../src/models/Association';
import { Evenement, IEvenement } from '../src/models/Evenement';
import { Utilisateur, Role } from '../src/models/Utilisateur';

export const MDP = 'Motdepasse1';
export const app = creerApp();

export const dansJours = (jours: number) => new Date(Date.now() + jours * 24 * 3600 * 1000);

export async function creerAssociation(nom = 'BDE', statut: 'active' | 'inactive' = 'active') {
  return Association.create({ nom, description: `Description de ${nom}`, contact: { email: 'contact@asso.fr' }, statut });
}

export async function creerUtilisateur(role: Role = 'etudiant', email?: string, association?: unknown) {
  return Utilisateur.create({
    prenom: 'Prénom',
    nom: role,
    email: email ?? `${role}-${Math.random().toString(36).slice(2, 8)}@isen.fr`,
    motDePasse: MDP,
    role,
    association: association ?? null,
  });
}

export async function creerEvenement(association: { _id: unknown }, champs: Partial<IEvenement> = {}) {
  return Evenement.create({
    titre: 'Soirée test',
    description: 'Un événement de test',
    date: dansJours(7),
    lieu: 'Campus',
    capacite: 10,
    categorie: 'soiree',
    association: association._id,
    statut: 'publie',
    ...champs,
  });
}

/** Agent API déjà connecté (le cookie de session est conservé entre les requêtes). */
export async function agentApi(email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/connexion').send({ email, motDePasse: MDP });
  if (res.status !== 200) throw new Error(`Connexion impossible pour ${email} : ${res.status}`);
  return agent;
}

/** Lit le jeton CSRF injecté dans une page HTML. */
export function extraireCsrf(html: string): string {
  const m = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  if (!m) throw new Error('Jeton CSRF introuvable dans la page');
  return m[1];
}

/** Agent « navigateur » connecté via le formulaire HTML ; renvoie aussi un jeton CSRF valide. */
export async function agentNavigateur(email: string) {
  const agent = request.agent(app);
  const page = await agent.get('/connexion');
  const csrf = extraireCsrf(page.text);
  const res = await agent.post('/connexion').type('form').send({ _csrf: csrf, email, motDePasse: MDP });
  if (res.status !== 302) throw new Error(`Connexion HTML impossible pour ${email} : ${res.status}`);
  // La session est régénérée à la connexion : on récupère le nouveau jeton.
  const accueil = await agent.get('/profil');
  return { agent, csrf: extraireCsrf(accueil.text) };
}
