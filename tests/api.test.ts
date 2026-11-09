import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Evenement } from '../src/models/Evenement';
import { Inscription } from '../src/models/Inscription';
import { Utilisateur } from '../src/models/Utilisateur';
import { agentApi, app, creerAssociation, creerEvenement, creerUtilisateur, MDP } from './helpers';

describe('API — authentification', () => {
  it("inscrit un étudiant en ignorant toute tentative d'élévation de rôle", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/inscription')
      .send({ prenom: 'Eve', nom: 'Pirate', email: 'eve@isen.fr', motDePasse: 'Motdepasse1', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('etudiant');
    expect(res.body).not.toHaveProperty('motDePasse');
    const moi = await agent.get('/api/auth/moi');
    expect(moi.body.email).toBe('eve@isen.fr');
  });

  it('valide les données d’inscription', async () => {
    const res = await request(app).post('/api/auth/inscription').send({ prenom: '', email: 'pasunemail', motDePasse: 'court' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('email');
    expect(res.body.details).toHaveProperty('motDePasse');
    expect(res.body.details).toHaveProperty('prenom');
  });

  it('refuse un email déjà utilisé (409)', async () => {
    await creerUtilisateur('etudiant', 'pris@isen.fr');
    const res = await request(app)
      .post('/api/auth/inscription')
      .send({ prenom: 'A', nom: 'B', email: 'pris@isen.fr', motDePasse: 'Motdepasse1' });
    expect(res.status).toBe(409);
  });

  it('renvoie le même message pour un email inconnu ou un mauvais mot de passe', async () => {
    await creerUtilisateur('etudiant', 'connu@isen.fr');
    const a = await request(app).post('/api/auth/connexion').send({ email: 'connu@isen.fr', motDePasse: 'mauvais1' });
    const b = await request(app).post('/api/auth/connexion').send({ email: 'inconnu@isen.fr', motDePasse: MDP });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.erreur).toBe(b.body.erreur);
  });

  it('protège les routes et gère la déconnexion', async () => {
    expect((await request(app).get('/api/auth/moi')).status).toBe(401);
    await creerUtilisateur('etudiant', 'x@isen.fr');
    const agent = await agentApi('x@isen.fr');
    expect((await agent.get('/api/auth/moi')).status).toBe(200);
    expect((await agent.post('/api/auth/deconnexion').send({})).status).toBe(204);
    expect((await agent.get('/api/auth/moi')).status).toBe(401);
  });

  it('exige du JSON pour les écritures (protection CSRF de l’API)', async () => {
    const res = await request(app).post('/api/auth/connexion').type('form').send({ email: 'a@b.fr', motDePasse: 'x' });
    expect(res.status).toBe(415);
  });
});

describe('API — événements', () => {
  it('liste publique : seulement publiés, à venir, d’associations actives, avec filtres', async () => {
    const [active, inactive] = await Promise.all([creerAssociation('Active'), creerAssociation('Inactive', 'inactive')]);
    await creerEvenement(active, { titre: 'Concert rock', categorie: 'culture' });
    await creerEvenement(active, { titre: 'Match de foot', categorie: 'sport' });
    await creerEvenement(active, { titre: 'Brouillon', statut: 'brouillon' });
    await creerEvenement(inactive, { titre: 'Caché' });

    const tous = await request(app).get('/api/evenements');
    expect(tous.body.donnees.map((e: { titre: string }) => e.titre).sort()).toEqual(['Concert rock', 'Match de foot']);

    const recherche = await request(app).get('/api/evenements').query({ q: 'conc' });
    expect(recherche.body.total).toBe(1);
    const parCategorie = await request(app).get('/api/evenements').query({ categorie: 'sport' });
    expect(parCategorie.body.donnees[0].titre).toBe('Match de foot');
    // Une regex malveillante est échappée, pas exécutée
    expect((await request(app).get('/api/evenements').query({ q: '(a+)+$' })).status).toBe(200);
  });

  it("un brouillon n'est pas visible publiquement (404)", async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso, { statut: 'brouillon' });
    expect((await request(app).get(`/api/evenements/${e._id}`)).status).toBe(404);
    expect((await request(app).get('/api/evenements/nimportequoi')).status).toBe(404);
  });

  it('CRUD complet par un responsable, limité à son association', async () => {
    const [mienne, autre] = await Promise.all([creerAssociation('Mienne'), creerAssociation('Autre')]);
    await creerUtilisateur('responsable', 'resp@isen.fr', mienne._id);
    const agent = await agentApi('resp@isen.fr');

    // Create : l'association est forcée à la sienne même s'il en envoie une autre
    const cree = await agent.post('/api/evenements').send({
      titre: 'Atelier', description: 'Desc', date: new Date(Date.now() + 864e5), lieu: 'Salle', capacite: 20,
      categorie: 'atelier', association: String(autre._id),
    });
    expect(cree.status).toBe(403);

    const ok = await agent.post('/api/evenements').send({
      titre: 'Atelier', description: 'Desc', date: new Date(Date.now() + 864e5), lieu: 'Salle', capacite: 20, categorie: 'atelier',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.association).toBe(String(mienne._id));
    expect(ok.body.statut).toBe('brouillon');

    // Read (brouillon visible pour son gestionnaire)
    expect((await agent.get(`/api/evenements/${ok.body._id}`)).status).toBe(200);
    // Update + publication
    const maj = await agent.patch(`/api/evenements/${ok.body._id}`).send({ titre: 'Atelier v2', statut: 'publie', nbInscrits: 999 });
    expect(maj.body).toMatchObject({ titre: 'Atelier v2', statut: 'publie', nbInscrits: 0 }); // nbInscrits non modifiable
    // Événement d'une autre association : interdit
    const etranger = await creerEvenement(autre);
    expect((await agent.patch(`/api/evenements/${etranger._id}`).send({ titre: 'Piraté' })).status).toBe(403);
    expect((await agent.delete(`/api/evenements/${etranger._id}`)).status).toBe(403);
    // Delete
    expect((await agent.delete(`/api/evenements/${ok.body._id}`)).status).toBe(204);
    expect(await Evenement.exists({ _id: ok.body._id })).toBeNull();
  });

  it('un étudiant ne peut pas créer d’événement', async () => {
    const asso = await creerAssociation();
    await creerUtilisateur('etudiant', 'etu@isen.fr');
    const agent = await agentApi('etu@isen.fr');
    const res = await agent.post('/api/evenements').send({ titre: 'X', association: String(asso._id) });
    expect(res.status).toBe(403);
  });

  it('renvoie les erreurs de validation par champ', async () => {
    const asso = await creerAssociation();
    await creerUtilisateur('admin', 'admin@isen.fr');
    const agent = await agentApi('admin@isen.fr');
    const res = await agent.post('/api/evenements').send({ association: String(asso._id), capacite: -3, categorie: 'zzz' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('capacite');
    expect(res.body.details).toHaveProperty('categorie');
    expect(res.body.details).toHaveProperty('titre');
  });

  it('supprimer un événement supprime ses inscriptions (cascade)', async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso);
    const u = await creerUtilisateur();
    await Inscription.create({ utilisateur: u._id, evenement: e._id });
    await creerUtilisateur('admin', 'admin@isen.fr');
    const agent = await agentApi('admin@isen.fr');
    expect((await agent.delete(`/api/evenements/${e._id}`)).status).toBe(204);
    expect(await Inscription.countDocuments()).toBe(0);
  });
});

describe('API — inscriptions', () => {
  it('parcours complet : s’inscrire, lister, annuler, se réinscrire, supprimer', async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso, { capacite: 1 });
    await creerUtilisateur('etudiant', 'etu@isen.fr');
    const agent = await agentApi('etu@isen.fr');

    const cree = await agent.post('/api/inscriptions').send({ evenement: String(e._id) });
    expect(cree.status).toBe(201);
    expect((await agent.post('/api/inscriptions').send({ evenement: String(e._id) })).status).toBe(409);

    const liste = await agent.get('/api/inscriptions');
    expect(liste.body).toHaveLength(1);
    expect(liste.body[0].evenement.titre).toBe(e.titre);

    const annulee = await agent.patch(`/api/inscriptions/${cree.body._id}`).send({ statut: 'annulee' });
    expect(annulee.body.statut).toBe('annulee');
    expect((await Evenement.findById(e._id))!.nbInscrits).toBe(0);

    const reactivee = await agent.patch(`/api/inscriptions/${cree.body._id}`).send({ statut: 'confirmee' });
    expect(reactivee.body.statut).toBe('confirmee');

    expect((await agent.delete(`/api/inscriptions/${cree.body._id}`)).status).toBe(204);
    expect((await Evenement.findById(e._id))!.nbInscrits).toBe(0);
  });

  it("un étudiant ne voit ni ne modifie l'inscription d'un autre", async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso);
    const autre = await creerUtilisateur();
    const sienne = await Inscription.create({ utilisateur: autre._id, evenement: e._id });
    await creerUtilisateur('etudiant', 'curieux@isen.fr');
    const agent = await agentApi('curieux@isen.fr');
    expect((await agent.get(`/api/inscriptions/${sienne._id}`)).status).toBe(403);
    expect((await agent.delete(`/api/inscriptions/${sienne._id}`)).status).toBe(403);
    expect((await agent.get('/api/inscriptions').query({ evenement: String(e._id) })).body).toHaveLength(0);
    expect((await agent.get(`/api/evenements/${e._id}/inscrits`)).status).toBe(403);
  });

  it('le responsable voit la liste des inscrits de ses événements uniquement', async () => {
    const [mienne, autre] = await Promise.all([creerAssociation('M'), creerAssociation('A')]);
    const [e1, e2] = await Promise.all([creerEvenement(mienne), creerEvenement(autre)]);
    const u = await creerUtilisateur();
    await Inscription.create({ utilisateur: u._id, evenement: e1._id });
    await creerUtilisateur('responsable', 'resp@isen.fr', mienne._id);
    const agent = await agentApi('resp@isen.fr');
    const res = await agent.get(`/api/evenements/${e1._id}/inscrits`);
    expect(res.status).toBe(200);
    expect(res.body[0].utilisateur.email).toBe(u.email);
    expect((await agent.get(`/api/evenements/${e2._id}/inscrits`)).status).toBe(403);
  });
});

describe('API — associations et utilisateurs', () => {
  it("seul l'admin crée, (dés)active et supprime une association ; le responsable modifie la sienne", async () => {
    const asso = await creerAssociation('Club');
    await creerUtilisateur('admin', 'admin@isen.fr');
    await creerUtilisateur('responsable', 'resp@isen.fr', asso._id);
    const admin = await agentApi('admin@isen.fr');
    const resp = await agentApi('resp@isen.fr');

    expect((await resp.post('/api/associations').send({ nom: 'X', description: 'Y', contact: { email: 'a@b.fr' } })).status).toBe(403);
    const creee = await admin.post('/api/associations').send({ nom: 'Nouvelle', description: 'Desc', contact: { email: 'n@b.fr' } });
    expect(creee.status).toBe(201);

    expect((await resp.patch(`/api/associations/${asso._id}`).send({ description: 'Mise à jour' })).body.description).toBe('Mise à jour');
    expect((await resp.patch(`/api/associations/${asso._id}`).send({ statut: 'inactive' })).status).toBe(403);
    expect((await resp.patch(`/api/associations/${creee.body._id}`).send({ description: 'Piratage' })).status).toBe(403);

    expect((await admin.patch(`/api/associations/${asso._id}`).send({ statut: 'inactive' })).body.statut).toBe('inactive');
    expect((await request(app).get('/api/associations')).body.map((a: { nom: string }) => a.nom)).toEqual(['Nouvelle']);

    // Suppression refusée tant qu'un responsable y est rattaché
    expect((await admin.delete(`/api/associations/${asso._id}`)).status).toBe(409);
    expect((await admin.delete(`/api/associations/${creee.body._id}`)).status).toBe(204);
  });

  it('CRUD utilisateurs réservé à l’admin, chacun peut modifier son profil (pas son rôle)', async () => {
    const asso = await creerAssociation();
    await creerUtilisateur('admin', 'admin@isen.fr');
    const etu = await creerUtilisateur('etudiant', 'etu@isen.fr');
    const admin = await agentApi('admin@isen.fr');
    const agentEtu = await agentApi('etu@isen.fr');

    expect((await agentEtu.get('/api/utilisateurs')).status).toBe(403);
    const profil = await agentEtu.patch(`/api/utilisateurs/${etu._id}`).send({ prenom: 'Nouveau', role: 'admin' });
    expect(profil.body).toMatchObject({ prenom: 'Nouveau', role: 'etudiant' });

    const cree = await admin.post('/api/utilisateurs').send({
      prenom: 'R', nom: 'Esp', email: 'r@isen.fr', motDePasse: 'Motdepasse1', role: 'responsable', association: String(asso._id),
    });
    expect(cree.status).toBe(201);
    expect((await admin.get('/api/utilisateurs')).body).toHaveLength(3);
    const promu = await admin.patch(`/api/utilisateurs/${etu._id}`).send({ role: 'responsable', association: String(asso._id) });
    expect(promu.body.role).toBe('responsable');
    expect((await admin.delete(`/api/utilisateurs/${cree.body._id}`)).status).toBe(204);
  });

  it('empêche de retirer le dernier administrateur', async () => {
    const admin = await creerUtilisateur('admin', 'admin@isen.fr');
    const agent = await agentApi('admin@isen.fr');
    expect((await agent.patch(`/api/utilisateurs/${admin._id}`).send({ role: 'etudiant' })).status).toBe(409);
    expect((await agent.delete(`/api/utilisateurs/${admin._id}`)).status).toBe(409);
  });

  it("supprimer un utilisateur supprime ses inscriptions et libère les places", async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso, { nbInscrits: 1 });
    const u = await creerUtilisateur();
    await Inscription.create({ utilisateur: u._id, evenement: e._id });
    await creerUtilisateur('admin', 'admin@isen.fr');
    const agent = await agentApi('admin@isen.fr');
    expect((await agent.delete(`/api/utilisateurs/${u._id}`)).status).toBe(204);
    expect(await Utilisateur.exists({ _id: u._id })).toBeNull();
    expect(await Inscription.countDocuments()).toBe(0);
    expect((await Evenement.findById(e._id))!.nbInscrits).toBe(0);
  });

  it('un compte supprimé perd immédiatement sa session', async () => {
    const u = await creerUtilisateur('etudiant', 'parti@isen.fr');
    const agent = await agentApi('parti@isen.fr');
    await Utilisateur.deleteOne({ _id: u._id });
    expect((await agent.get('/api/auth/moi')).status).toBe(401);
  });
});
