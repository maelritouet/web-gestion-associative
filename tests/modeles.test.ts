import { describe, expect, it } from 'vitest';
import { Utilisateur } from '../src/models/Utilisateur';
import { Evenement } from '../src/models/Evenement';
import { Association } from '../src/models/Association';
import { creerAssociation, creerEvenement, creerUtilisateur, MDP } from './helpers';

describe('Modèle Utilisateur', () => {
  it('hache le mot de passe et ne le renvoie jamais en JSON', async () => {
    const u = await creerUtilisateur('etudiant', 'a@isen.fr');
    const brut = await Utilisateur.findById(u._id).select('+motDePasse').lean();
    expect(brut!.motDePasse).not.toBe(MDP);
    expect(brut!.motDePasse).toMatch(/^\$2[aby]\$10\$/);
    expect(JSON.stringify(u)).not.toContain('motDePasse');
    expect(await u.verifierMotDePasse(MDP)).toBe(true);
    expect(await u.verifierMotDePasse('mauvais')).toBe(false);
  });

  it("refuse un email en double (insensible à la casse)", async () => {
    await creerUtilisateur('etudiant', 'double@isen.fr');
    await expect(creerUtilisateur('etudiant', 'DOUBLE@isen.fr')).rejects.toMatchObject({ code: 11000 });
  });

  it('exige une association pour un responsable, et seulement pour lui', async () => {
    await expect(creerUtilisateur('responsable')).rejects.toThrow(/responsable doit être rattaché/);
    const asso = await creerAssociation();
    await expect(creerUtilisateur('etudiant', undefined, asso._id)).rejects.toThrow(/responsable doit être rattaché/);
    await expect(creerUtilisateur('responsable', undefined, asso._id)).resolves.toBeTruthy();
  });

  it('refuse un mot de passe trop court', async () => {
    await expect(Utilisateur.create({ prenom: 'A', nom: 'B', email: 'c@d.fr', motDePasse: 'court' })).rejects.toThrow(
      /au moins 8/
    );
  });
});

describe('Modèle Evenement', () => {
  it('valide les champs obligatoires, la catégorie et la capacité', async () => {
    const err = await Evenement.create({ titre: '', capacite: 0, categorie: 'inconnue' }).catch((e) => e);
    expect(Object.keys(err.errors)).toEqual(
      expect.arrayContaining(['titre', 'description', 'date', 'lieu', 'capacite', 'categorie', 'association'])
    );
  });

  it("refuse une capacité inférieure au nombre d'inscrits", async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso, { capacite: 10 });
    e.nbInscrits = 5;
    await e.save();
    e.capacite = 4;
    await expect(e.save()).rejects.toThrow(/inférieure au nombre/);
  });

  it('calcule les places restantes (virtuel)', async () => {
    const asso = await creerAssociation();
    const e = await creerEvenement(asso, { capacite: 10, nbInscrits: 3 });
    expect(e.toJSON()).toMatchObject({ placesRestantes: 7 });
  });
});

describe('Modèle Association', () => {
  it("n'accepte qu'un logo téléversé sur le serveur", async () => {
    const base = { nom: 'X', description: 'Y', contact: { email: 'x@y.fr' } };
    await expect(Association.create({ ...base, logo: 'https://evil.example/pixel.png' })).rejects.toThrow(/logo invalide/);
    await expect(Association.create({ ...base, logo: '/uploads/abc-123.png' })).resolves.toBeTruthy();
  });

  it('peuple la relation inverse vers ses événements', async () => {
    const asso = await creerAssociation();
    await creerEvenement(asso);
    await creerEvenement(asso, { titre: 'Deuxième' });
    const peuplee = await Association.findById(asso._id).populate('evenements');
    expect((peuplee as unknown as { evenements: unknown[] }).evenements).toHaveLength(2);
  });
});
