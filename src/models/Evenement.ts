import { Schema, model, Types, HydratedDocument } from 'mongoose';

export const CATEGORIES = ['soiree', 'sport', 'culture', 'conference', 'atelier', 'humanitaire', 'autre'] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const LIBELLES_CATEGORIES: Record<Categorie, string> = {
  soiree: 'Soirée',
  sport: 'Sport',
  culture: 'Culture',
  conference: 'Conférence',
  atelier: 'Atelier',
  humanitaire: 'Humanitaire',
  autre: 'Autre',
};

export const STATUTS_EVENEMENT = ['brouillon', 'publie'] as const;
export type StatutEvenement = (typeof STATUTS_EVENEMENT)[number];

export interface IEvenement {
  titre: string;
  description: string;
  date: Date;
  lieu: string;
  capacite: number;
  categorie: Categorie;
  association: Types.ObjectId;
  statut: StatutEvenement;
  /**
   * Compteur dénormalisé des inscriptions confirmées.
   * Il permet de réserver une place de façon ATOMIQUE (voir inscriptionService).
   */
  nbInscrits: number;
  createdAt: Date;
  updatedAt: Date;
}

export type EvenementDoc = HydratedDocument<IEvenement>;

const evenementSchema = new Schema<IEvenement>(
  {
    titre: {
      type: String,
      required: [true, 'Le titre est obligatoire'],
      trim: true,
      maxlength: [120, 'Le titre ne doit pas dépasser 120 caractères'],
    },
    description: {
      type: String,
      required: [true, 'La description est obligatoire'],
      trim: true,
      maxlength: [5000, 'La description ne doit pas dépasser 5000 caractères'],
    },
    date: { type: Date, required: [true, 'La date est obligatoire'] },
    lieu: {
      type: String,
      required: [true, 'Le lieu est obligatoire'],
      trim: true,
      maxlength: [150, 'Le lieu ne doit pas dépasser 150 caractères'],
    },
    capacite: {
      type: Number,
      required: [true, 'La capacité est obligatoire'],
      min: [1, 'La capacité doit être au moins de 1'],
      max: [100000, 'Capacité trop élevée'],
      validate: { validator: Number.isInteger, message: 'La capacité doit être un nombre entier' },
    },
    categorie: {
      type: String,
      required: [true, 'La catégorie est obligatoire'],
      enum: { values: CATEGORIES, message: 'Catégorie inconnue' },
    },
    association: {
      type: Schema.Types.ObjectId,
      ref: 'Association',
      required: [true, "L'association organisatrice est obligatoire"],
      index: true,
    },
    statut: {
      type: String,
      enum: { values: STATUTS_EVENEMENT, message: 'Statut inconnu' },
      default: 'brouillon',
    },
    nbInscrits: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } }
);

/** Une capacité ne peut pas descendre sous le nombre d'inscrits déjà confirmés. */
evenementSchema.path('capacite').validate(function (this: EvenementDoc, capacite: number) {
  return capacite >= (this.nbInscrits ?? 0);
}, 'La capacité ne peut pas être inférieure au nombre de personnes déjà inscrites');

evenementSchema.virtual('placesRestantes').get(function () {
  return Math.max(0, this.capacite - this.nbInscrits);
});

evenementSchema.virtual('estPasse').get(function () {
  return this.date.getTime() < Date.now();
});

// Index pour la liste publique : filtre sur le statut puis tri chronologique.
evenementSchema.index({ statut: 1, date: 1 });

export const Evenement = model<IEvenement>('Evenement', evenementSchema);
