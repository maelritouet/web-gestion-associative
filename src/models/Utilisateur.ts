import { Schema, model, Types, HydratedDocument, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['etudiant', 'responsable', 'admin'] as const;
export type Role = (typeof ROLES)[number];
export const MOT_DE_PASSE_MIN = 8;

export interface IUtilisateur {
  prenom: string;
  nom: string;
  email: string;
  motDePasse: string;
  role: Role;
  /** Association gérée : obligatoire pour un responsable, interdite sinon. */
  association?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

interface IUtilisateurMethodes {
  verifierMotDePasse(candidat: string): Promise<boolean>;
}

type UtilisateurModel = Model<IUtilisateur, object, IUtilisateurMethodes>;
export type UtilisateurDoc = HydratedDocument<IUtilisateur, IUtilisateurMethodes>;

const utilisateurSchema = new Schema<IUtilisateur, UtilisateurModel, IUtilisateurMethodes>(
  {
    prenom: { type: String, required: [true, 'Le prénom est obligatoire'], trim: true, maxlength: 50 },
    nom: { type: String, required: [true, 'Le nom est obligatoire'], trim: true, maxlength: 50 },
    email: {
      type: String,
      required: [true, "L'email est obligatoire"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse email invalide'],
    },
    // select: false => jamais renvoyé par défaut (ni dans l'API, ni dans les vues)
    // La validation s'exécute AVANT le hook de hachage : minlength porte sur le mot de passe en clair.
    motDePasse: {
      type: String,
      required: [true, 'Le mot de passe est obligatoire'],
      minlength: [MOT_DE_PASSE_MIN, `Le mot de passe doit contenir au moins ${MOT_DE_PASSE_MIN} caractères`],
      select: false,
    },
    role: { type: String, enum: { values: ROLES, message: 'Rôle inconnu' }, default: 'etudiant' },
    association: { type: Schema.Types.ObjectId, ref: 'Association', default: null },
  },
  { timestamps: true }
);

/** Validation croisée : l'association dépend du rôle. */
utilisateurSchema.path('association').validate(function (this: { role?: Role }, valeur: unknown) {
  return this.role === 'responsable' ? Boolean(valeur) : !valeur;
}, 'Un responsable doit être rattaché à une association (et seulement un responsable)');

/** Hachage du mot de passe avant enregistrement (uniquement s'il a changé). */
utilisateurSchema.pre('save', async function () {
  if (!this.isModified('motDePasse')) return;
  this.motDePasse = await bcrypt.hash(this.motDePasse, 10);
});

utilisateurSchema.method('verifierMotDePasse', function (this: UtilisateurDoc, candidat: string) {
  return bcrypt.compare(candidat, this.motDePasse);
});

utilisateurSchema.virtual('nomComplet').get(function () {
  return `${this.prenom} ${this.nom}`;
});

/** Sérialisation JSON (API) : on masque toujours le hash et la clé interne __v. */
utilisateurSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    const { motDePasse: _hash, __v: _version, ...publicables } = ret as typeof ret & { motDePasse?: string };
    return publicables;
  },
});

export const Utilisateur = model<IUtilisateur, UtilisateurModel>('Utilisateur', utilisateurSchema);
