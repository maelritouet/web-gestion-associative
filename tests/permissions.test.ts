import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  accedeAuBackOffice,
  peutAccederAuCompte,
  peutAdministrerAssociations,
  peutGererEvenementsDe,
  peutGererInscription,
  peutModifierAssociation,
} from '../src/services/permissions';

const assoA = new Types.ObjectId();
const assoB = new Types.ObjectId();
const admin = { _id: new Types.ObjectId(), role: 'admin' as const };
const respA = { _id: new Types.ObjectId(), role: 'responsable' as const, association: assoA };
const etudiant = { _id: new Types.ObjectId(), role: 'etudiant' as const };

describe('Règles de droits (fonctions pures)', () => {
  it("l'admin peut tout gérer", () => {
    expect(peutModifierAssociation(admin, assoB)).toBe(true);
    expect(peutGererEvenementsDe(admin, assoA)).toBe(true);
    expect(peutAdministrerAssociations(admin)).toBe(true);
    expect(peutAccederAuCompte(admin, etudiant._id)).toBe(true);
  });

  it('un responsable ne gère que son association', () => {
    expect(peutGererEvenementsDe(respA, assoA)).toBe(true);
    expect(peutGererEvenementsDe(respA, String(assoA))).toBe(true); // string ou ObjectId
    expect(peutGererEvenementsDe(respA, assoB)).toBe(false);
    expect(peutAdministrerAssociations(respA)).toBe(false);
  });

  it('compare correctement une association PEUPLÉE (document) à un identifiant', () => {
    // Régression : après populate('association'), String(doc) ne donne pas l'id.
    const respPeuple = { ...respA, association: { _id: assoA, nom: 'Asso A' } };
    expect(peutGererEvenementsDe(respPeuple, assoA)).toBe(true);
    expect(peutGererEvenementsDe(respPeuple, String(assoA))).toBe(true);
    expect(peutGererEvenementsDe(respPeuple, { _id: assoB })).toBe(false);
  });

  it("un étudiant n'a pas accès au back-office", () => {
    expect(accedeAuBackOffice(etudiant)).toBe(false);
    expect(accedeAuBackOffice(respA)).toBe(true);
    expect(peutGererEvenementsDe(etudiant, assoA)).toBe(false);
    expect(peutModifierAssociation(null, assoA)).toBe(false);
  });

  it('une inscription est gérable par son propriétaire ou un gestionnaire de l’association', () => {
    const inscription = { utilisateur: etudiant._id };
    expect(peutGererInscription(etudiant, inscription, assoA)).toBe(true);
    expect(peutGererInscription(respA, inscription, assoA)).toBe(true);
    expect(peutGererInscription(respA, inscription, assoB)).toBe(false);
    const autre = { _id: new Types.ObjectId(), role: 'etudiant' as const };
    expect(peutGererInscription(autre, inscription, assoA)).toBe(false);
  });

  it('chacun accède à son propre compte, pas à celui des autres', () => {
    expect(peutAccederAuCompte(etudiant, etudiant._id)).toBe(true);
    expect(peutAccederAuCompte(etudiant, respA._id)).toBe(false);
  });
});
