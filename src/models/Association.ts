import { Schema, model, HydratedDocument } from 'mongoose';

export const STATUTS_ASSOCIATION = ['active', 'inactive'] as const;
export type StatutAssociation = (typeof STATUTS_ASSOCIATION)[number];

export interface IAssociation {
  nom: string;
  description: string;
  contact: { email: string; telephone?: string; siteWeb?: string };
  /** Chemin public du logo (ex : /uploads/abc.png), null si aucun. */
  logo?: string | null;
  statut: StatutAssociation;
  createdAt: Date;
  updatedAt: Date;
}

export type AssociationDoc = HydratedDocument<IAssociation>;

const associationSchema = new Schema<IAssociation>(
  {
    nom: {
      type: String,
      required: [true, 'Le nom est obligatoire'],
      unique: true,
      trim: true,
      maxlength: [80, 'Le nom ne doit pas dépasser 80 caractères'],
    },
    description: {
      type: String,
      required: [true, 'La description est obligatoire'],
      trim: true,
      maxlength: [2000, 'La description ne doit pas dépasser 2000 caractères'],
    },
    contact: {
      email: {
        type: String,
        required: [true, "L'email de contact est obligatoire"],
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email de contact invalide'],
      },
      telephone: {
        type: String,
        trim: true,
        match: [/^$|^[+0-9 .()-]{6,20}$/, 'Numéro de téléphone invalide'],
      },
      siteWeb: {
        type: String,
        trim: true,
        match: [/^$|^https?:\/\/\S+$/, 'Le site web doit commencer par http:// ou https://'],
      },
    },
    // Seuls les fichiers téléversés sur le serveur sont acceptés (pas d'URL externe arbitraire).
    logo: {
      type: String,
      default: null,
      match: [/^\/uploads\/[\w-]+\.(png|jpg|webp|gif)$/, 'Chemin de logo invalide'],
    },
    statut: {
      type: String,
      enum: { values: STATUTS_ASSOCIATION, message: 'Statut inconnu' },
      default: 'active',
    },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } }
);

/** Relation inverse (non stockée) : les événements organisés par l'association. */
associationSchema.virtual('evenements', {
  ref: 'Evenement',
  localField: '_id',
  foreignField: 'association',
});

export const Association = model<IAssociation>('Association', associationSchema);
