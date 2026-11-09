import { describe, expect, it } from 'vitest';
import * as service from '../src/services/inscriptionService';
import { Evenement } from '../src/models/Evenement';
import { Inscription } from '../src/models/Inscription';
import { creerAssociation, creerEvenement, creerUtilisateur, dansJours } from './helpers';

const nbInscrits = async (id: unknown) => (await Evenement.findById(id))!.nbInscrits;

describe('Règles métier des inscriptions', () => {
  it('inscrit un utilisateur et incrémente le compteur', async () => {
    const [asso, u] = await Promise.all([creerAssociation(), creerUtilisateur()]);
    const e = await creerEvenement(asso);
    const i = await service.inscrire(u._id, e._id);
    expect(i.statut).toBe('confirmee');
    expect(await nbInscrits(e._id)).toBe(1);
  });

  it('empêche la double inscription', async () => {
    const [asso, u] = await Promise.all([creerAssociation(), creerUtilisateur()]);
    const e = await creerEvenement(asso);
    await service.inscrire(u._id, e._id);
    await expect(service.inscrire(u._id, e._id)).rejects.toMatchObject({ status: 409 });
    expect(await nbInscrits(e._id)).toBe(1);
  });

  it('empêche la double inscription même avec des requêtes simultanées', async () => {
    const [asso, u] = await Promise.all([creerAssociation(), creerUtilisateur()]);
    const e = await creerEvenement(asso);
    const resultats = await Promise.allSettled(Array.from({ length: 10 }, () => service.inscrire(u._id, e._id)));
    expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await Inscription.countDocuments({ evenement: e._id })).toBe(1);
    expect(await nbInscrits(e._id)).toBe(1); // la place des tentatives refusées a bien été rendue
  });

  it('respecte la capacité maximale', async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso, { capacite: 2 });
    const [a, b, c] = await Promise.all([creerUtilisateur(), creerUtilisateur(), creerUtilisateur()]);
    await service.inscrire(a._id, e._id);
    await service.inscrire(b._id, e._id);
    await expect(service.inscrire(c._id, e._id)).rejects.toThrow(/complet/);
  });

  it('ne dépasse jamais la capacité sous forte concurrence', async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso, { capacite: 5 });
    const etudiants = await Promise.all(Array.from({ length: 25 }, () => creerUtilisateur()));
    const resultats = await Promise.allSettled(etudiants.map((u) => service.inscrire(u._id, e._id)));
    expect(resultats.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    expect(await nbInscrits(e._id)).toBe(5);
    expect(await Inscription.countDocuments({ evenement: e._id, statut: 'confirmee' })).toBe(5);
  });

  it("l'annulation libère la place et la réinscription réactive la même inscription", async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso, { capacite: 1 });
    const [a, b] = await Promise.all([creerUtilisateur(), creerUtilisateur()]);
    const i = await service.inscrire(a._id, e._id);
    await expect(service.inscrire(b._id, e._id)).rejects.toThrow(/complet/);

    await service.annuler(i);
    expect(await nbInscrits(e._id)).toBe(0);
    await expect(service.annuler(i)).rejects.toMatchObject({ status: 409 }); // pas de double annulation

    await service.inscrire(b._id, e._id); // la place libérée profite à B
    await expect(service.inscrire(a._id, e._id)).rejects.toThrow(/complet/);

    const autre = await creerEvenement(asso);
    const i2 = await service.inscrire(a._id, autre._id);
    await service.annuler(i2);
    const reactivee = await service.inscrire(a._id, autre._id);
    expect(String(reactivee._id)).toBe(String(i2._id));
    expect(reactivee.statut).toBe('confirmee');
  });

  it('refuse un événement brouillon, passé ou dont l’association est inactive', async () => {
    const [asso, inactive, u] = await Promise.all([creerAssociation('A'), creerAssociation('B', 'inactive'), creerUtilisateur()]);
    const brouillon = await creerEvenement(asso, { statut: 'brouillon' });
    const passe = await creerEvenement(asso, { date: dansJours(-1) });
    const orphelin = await creerEvenement(inactive);
    await expect(service.inscrire(u._id, brouillon._id)).rejects.toMatchObject({ status: 404 });
    await expect(service.inscrire(u._id, passe._id)).rejects.toThrow(/déjà passé/);
    await expect(service.inscrire(u._id, orphelin._id)).rejects.toThrow(/plus active/);
    await expect(service.inscrire(u._id, 'pas-un-id')).rejects.toMatchObject({ status: 404 });
  });

  it('la suppression définitive libère la place', async () => {
    const [asso, u] = await Promise.all([creerAssociation(), creerUtilisateur()]);
    const e = await creerEvenement(asso);
    const i = await service.inscrire(u._id, e._id);
    await service.supprimer(i);
    expect(await nbInscrits(e._id)).toBe(0);
    expect(await Inscription.countDocuments()).toBe(0);
  });
});
