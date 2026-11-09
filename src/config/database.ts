import mongoose from 'mongoose';

/** Ouvre la connexion Mongoose et s'assure que les index (unicité, etc.) existent. */
export async function connecterBase(uri: string): Promise<typeof mongoose> {
  const connexion = await mongoose.connect(uri);
  // Les index uniques portent des règles métier (ex : pas de double inscription) :
  // on attend leur création avant d'accepter des requêtes.
  await Promise.all(Object.values(mongoose.models).map((modele) => modele.syncIndexes()));
  return connexion;
}

export async function deconnecterBase(): Promise<void> {
  await mongoose.disconnect();
}
