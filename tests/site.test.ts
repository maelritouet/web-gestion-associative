import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { Association } from '../src/models/Association';
import { Evenement } from '../src/models/Evenement';
import { Inscription } from '../src/models/Inscription';
import { Utilisateur } from '../src/models/Utilisateur';
import { agentNavigateur, app, creerAssociation, creerEvenement, creerUtilisateur, extraireCsrf } from './helpers';

describe('Front public', () => {
  it('affiche les pages de consultation', async () => {
    const asso = await creerAssociation('Club Photo');
    const e = await creerEvenement(asso, { titre: 'Expo <script>alert(1)</script>' });
    for (const url of ['/', '/evenements', '/associations', `/associations/${asso._id}`, `/evenements/${e._id}`]) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(200);
    }
    const page = await request(app).get(`/evenements/${e._id}`);
    // Échappement EJS : le contenu saisi ne peut pas injecter de script (XSS)
    expect(page.text).not.toContain('<script>alert(1)</script>');
    expect(page.text).toContain('&lt;script&gt;');
  });

  it('envoie des en-têtes de sécurité', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('page 404 en HTML et JSON', async () => {
    expect((await request(app).get('/inexistant')).status).toBe(404);
    const api = await request(app).get('/api/inexistant');
    expect(api.status).toBe(404);
    expect(api.body.erreur).toBeTruthy();
  });

  it('création de compte par formulaire avec jeton CSRF, puis session ouverte', async () => {
    const agent = request.agent(app);
    const csrf = extraireCsrf((await agent.get('/inscription')).text);
    const res = await agent
      .post('/inscription')
      .type('form')
      .send({ _csrf: csrf, prenom: 'Zoé', nom: 'Le Goff', email: 'zoe@isen.fr', motDePasse: 'Motdepasse1' });
    expect(res.status).toBe(302);
    expect((await agent.get('/mes-inscriptions')).status).toBe(200);
  });

  it('ré-affiche le formulaire avec les erreurs, sans perdre la saisie', async () => {
    const agent = request.agent(app);
    const csrf = extraireCsrf((await agent.get('/inscription')).text);
    const res = await agent.post('/inscription').type('form').send({ _csrf: csrf, prenom: 'Zoé', nom: '', email: 'x', motDePasse: '1' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Adresse email invalide');
    expect(res.text).toContain('value="Zoé"');
  });

  it('refuse un formulaire sans jeton CSRF (403)', async () => {
    const res = await request(app).post('/connexion').type('form').send({ email: 'a@b.fr', motDePasse: 'x' });
    expect(res.status).toBe(403);
  });

  it("redirige vers la connexion puis vers la page demandée", async () => {
    await creerUtilisateur('etudiant', 'etu@isen.fr');
    const agent = request.agent(app);
    const redir = await agent.get('/mes-inscriptions');
    expect(redir.status).toBe(302);
    expect(redir.headers.location).toBe('/connexion');
    const csrf = extraireCsrf((await agent.get('/connexion')).text);
    const res = await agent.post('/connexion').type('form').send({ _csrf: csrf, email: 'etu@isen.fr', motDePasse: 'Motdepasse1' });
    expect(res.headers.location).toBe('/mes-inscriptions');
  });

  it('régénère la session à la connexion (anti fixation de session)', async () => {
    await creerUtilisateur('etudiant', 'etu@isen.fr');
    const agent = request.agent(app);
    const avant = await agent.get('/connexion');
    const cookieAvant = String(avant.headers['set-cookie']);
    const res = await agent
      .post('/connexion')
      .type('form')
      .send({ _csrf: extraireCsrf(avant.text), email: 'etu@isen.fr', motDePasse: 'Motdepasse1' });
    expect(String(res.headers['set-cookie'])).not.toBe(cookieAvant);
    expect(String(res.headers['set-cookie'])).toMatch(/HttpOnly/i);
    expect(String(res.headers['set-cookie'])).toMatch(/SameSite=Lax/i);
  });

  it('inscription et annulation depuis la fiche événement', async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso);
    await creerUtilisateur('etudiant', 'etu@isen.fr');
    const { agent, csrf } = await agentNavigateur('etu@isen.fr');

    const res = await agent.post(`/evenements/${e._id}/inscription`).type('form').send({ _csrf: csrf });
    expect(res.status).toBe(302);
    const fiche = await agent.get(`/evenements/${e._id}`);
    expect(fiche.text).toContain('Inscription confirmée');
    expect(fiche.text).toContain('Annuler mon inscription');

    // Double inscription : message d'erreur, pas de doublon
    await agent.post(`/evenements/${e._id}/inscription`).type('form').send({ _csrf: csrf });
    expect((await agent.get(`/evenements/${e._id}`)).text).toContain('déjà inscrit');
    expect(await Inscription.countDocuments()).toBe(1);

    const inscription = await Inscription.findOne();
    await agent.post(`/mes-inscriptions/${inscription!._id}/annuler`).type('form').send({ _csrf: csrf });
    expect((await Inscription.findOne())!.statut).toBe('annulee');
    const mes = await agent.get('/mes-inscriptions');
    expect(mes.text).toContain('Annulées');
  });

  it("refuse d'utiliser un lien de retour externe (open redirect)", async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso);
    await creerUtilisateur('etudiant', 'etu@isen.fr');
    const { agent, csrf } = await agentNavigateur('etu@isen.fr');
    const res = await agent
      .post(`/evenements/${e._id}/inscription`)
      .type('form')
      .send({ _csrf: csrf, retour: '//evil.example' });
    expect(res.headers.location).toBe(`/evenements/${e._id}`);
  });
});

describe('Back-office', () => {
  it('est inaccessible aux visiteurs et aux étudiants', async () => {
    expect((await request(app).get('/admin')).status).toBe(302);
    await creerUtilisateur('etudiant', 'etu@isen.fr');
    const { agent } = await agentNavigateur('etu@isen.fr');
    expect((await agent.get('/admin')).status).toBe(403);
  });

  it("le responsable ne voit et ne gère que les événements de son association", async () => {
    const [mienne, autre] = await Promise.all([creerAssociation('Mienne'), creerAssociation('Autre')]);
    await creerEvenement(mienne, { titre: 'Mon événement' });
    const etranger = await creerEvenement(autre, { titre: 'Événement étranger' });
    await creerUtilisateur('responsable', 'resp@isen.fr', mienne._id);
    const { agent, csrf } = await agentNavigateur('resp@isen.fr');

    const liste = await agent.get('/admin/evenements');
    expect(liste.text).toContain('Mon événement');
    expect(liste.text).not.toContain('Événement étranger');
    expect((await agent.get(`/admin/evenements/${etranger._id}/modifier`)).status).toBe(403);
    expect((await agent.get(`/admin/evenements/${etranger._id}/inscrits`)).status).toBe(403);
    expect((await agent.post(`/admin/evenements/${etranger._id}/supprimer`).type('form').send({ _csrf: csrf })).status).toBe(403);
    expect((await agent.get('/admin/utilisateurs')).status).toBe(403);
    expect((await agent.get('/admin/associations/nouvelle')).status).toBe(403);
  });

  it('création, publication et suppression d’un événement par formulaire', async () => {
    const asso = await creerAssociation();
    await creerUtilisateur('responsable', 'resp@isen.fr', asso._id);
    const { agent, csrf } = await agentNavigateur('resp@isen.fr');

    const invalide = await agent.post('/admin/evenements').type('form').send({ _csrf: csrf, titre: '', capacite: '0' });
    expect(invalide.status).toBe(400);
    expect(invalide.text).toContain('Le titre est obligatoire');

    const res = await agent.post('/admin/evenements').type('form').send({
      _csrf: csrf, titre: 'Tournoi', description: 'Desc', date: '2099-05-01T14:00', lieu: 'Gymnase', capacite: '16',
      categorie: 'sport', statut: 'brouillon',
    });
    expect(res.status).toBe(302);
    const e = await Evenement.findOne({ titre: 'Tournoi' });
    expect(String(e!.association)).toBe(String(asso._id));

    await agent.post(`/admin/evenements/${e!._id}/statut`).type('form').send({ _csrf: csrf, statut: 'publie' });
    expect((await Evenement.findById(e!._id))!.statut).toBe('publie');

    await agent.post(`/admin/evenements/${e!._id}/supprimer`).type('form').send({ _csrf: csrf });
    expect(await Evenement.countDocuments()).toBe(0);
  });

  it('liste des inscrits et export CSV protégé contre l’injection de formules', async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso);
    const u = await Utilisateur.create({ prenom: '=HYPERLINK("http://x")', nom: 'Pirate', email: 'p@isen.fr', motDePasse: 'Motdepasse1' });
    await Inscription.create({ utilisateur: u._id, evenement: e._id });
    await creerUtilisateur('admin', 'admin@isen.fr');
    const { agent } = await agentNavigateur('admin@isen.fr');

    const page = await agent.get(`/admin/evenements/${e._id}/inscrits`);
    expect(page.text).toContain('p@isen.fr');
    const csv = await agent.get(`/admin/evenements/${e._id}/inscrits.csv`);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("l'admin gère les associations : création avec logo, désactivation", async () => {
    await creerUtilisateur('admin', 'admin@isen.fr');
    const { agent, csrf } = await agentNavigateur('admin@isen.fr');
    // PNG minimal (en-tête valide)
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

    const res = await agent
      .post('/admin/associations')
      .field('_csrf', csrf)
      .field('nom', 'Club Échecs')
      .field('description', 'On joue aux échecs')
      .field('contactEmail', 'echecs@isen.fr')
      .attach('logo', png, 'logo.png');
    expect(res.status).toBe(302);
    const asso = await Association.findOne({ nom: 'Club Échecs' });
    expect(asso!.logo).toMatch(/^\/uploads\/[\w-]+\.png$/);
    expect((await request(app).get(asso!.logo!)).status).toBe(200);

    await agent.post(`/admin/associations/${asso!._id}/statut`).type('form').send({ _csrf: csrf, statut: 'inactive' });
    expect((await Association.findById(asso!._id))!.statut).toBe('inactive');

    // Nettoyage du fichier créé
    await agent.post(`/admin/associations/${asso!._id}/supprimer`).type('form').send({ _csrf: csrf });
    expect((await request(app).get(asso!.logo!)).status).toBe(404);
  });

  it('refuse un faux logo (fichier qui n’est pas une image)', async () => {
    await creerUtilisateur('admin', 'admin@isen.fr');
    const { agent, csrf } = await agentNavigateur('admin@isen.fr');
    const res = await agent
      .post('/admin/associations')
      .field('_csrf', csrf)
      .field('nom', 'Club')
      .field('description', 'Desc')
      .field('contactEmail', 'c@isen.fr')
      .attach('logo', Buffer.from('<?php echo "hack"; ?>'), 'logo.png');
    expect(res.status).toBe(400);
    expect(res.text).toContain('Le logo doit être une image');
    expect(await Association.countDocuments()).toBe(0);
  });

  it("l'admin gère les comptes utilisateurs", async () => {
    const asso = await creerAssociation();
    await creerUtilisateur('admin', 'admin@isen.fr');
    const { agent, csrf } = await agentNavigateur('admin@isen.fr');

    const res = await agent.post('/admin/utilisateurs').type('form').send({
      _csrf: csrf, prenom: 'Paul', nom: 'Resp', email: 'paul@isen.fr', motDePasse: 'Motdepasse1', role: 'responsable', association: String(asso._id),
    });
    expect(res.status).toBe(302);
    const paul = await Utilisateur.findOne({ email: 'paul@isen.fr' });
    expect(paul!.role).toBe('responsable');

    const sansAsso = await agent.post(`/admin/utilisateurs/${paul!._id}`).type('form').send({
      _csrf: csrf, prenom: 'Paul', nom: 'Resp', email: 'paul@isen.fr', role: 'responsable', association: '',
    });
    expect(sansAsso.status).toBe(400);

    expect((await agent.get('/admin/utilisateurs')).text).toContain('paul@isen.fr');
    await agent.post(`/admin/utilisateurs/${paul!._id}/supprimer`).type('form').send({ _csrf: csrf });
    expect(await Utilisateur.exists({ email: 'paul@isen.fr' })).toBeNull();
  });

  it('toutes les pages du back-office se rendent pour un admin', async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso);
    const admin = await creerUtilisateur('admin', 'admin@isen.fr');
    const { agent } = await agentNavigateur('admin@isen.fr');
    const pages = [
      '/admin', '/admin/evenements', '/admin/evenements/nouveau', `/admin/evenements/${e._id}/modifier`,
      `/admin/evenements/${e._id}/inscrits`, '/admin/associations', '/admin/associations/nouvelle',
      `/admin/associations/${asso._id}/modifier`, '/admin/utilisateurs', '/admin/utilisateurs/nouveau',
      `/admin/utilisateurs/${admin._id}/modifier`,
    ];
    for (const url of pages) expect((await agent.get(url)).status, url).toBe(200);
  });
});
