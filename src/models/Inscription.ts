import { Schema, model, Types, HydratedDocument } from 'mongoose';

export const STATUTS_INSCRIPTION = ['confirmee', 'annulee'] as const;
export type StatutInscription = (typeof STATUTS_INSCRIPTION)[number];

export interface IInscription {
  utilisateur: Types.ObjectId;
  evenement: Types.ObjectId;
  dateInscription: Date;
  statut: StatutInscription;
  createdAt: Date;
  updatedAt: Date;
}

export type InscriptionDoc = HydratedDocument<IInscription>;

/**
 * Table de liaison N–N entre Utilisateur et Evenement.
 * Une annulation conserve le document (statut "annulee") pour garder l'historique ;
 * une réinscription réactive ce même document.
 */
const inscriptionSchema = new Schema<IInscription>(
  {
    utilisateur: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    evenement: { type: Schema.Types.ObjectId, ref: 'Evenement', required: true, index: true },
    dateInscription: { type: Date, default: Date.now },
    statut: {
      type: String,
      enum: { values: STATUTS_INSCRIPTION, message: 'Statut inconnu' },
      default: 'confirmee',
    },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

// Règle métier garantie par la base : un utilisateur = au plus UNE inscription par événement,
// même si deux requêtes arrivent exactement en même temps.
inscriptionSchema.index({ utilisateur: 1, evenement: 1 }, { unique: true });

export const Inscription = model<IInscription>('Inscription', inscriptionSchema);
