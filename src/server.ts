import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { env } from './config/env';
import { connecterBase } from './config/database';
import { creerApp } from './app';

/** Démarre le serveur : connexion MongoDB, sessions persistées en base, écoute HTTP. */
export async function demarrer(uri = env.mongoUri, port = env.port) {
  await connecterBase(uri);
  console.log(`MongoDB connecté (${mongoose.connection.name})`);

  const sessionStore = MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 * 7,
  });

  const app = creerApp({ sessionStore });
  const serveur = app.listen(port, () => console.log(`Serveur démarré sur http://localhost:${port}`));

  const arreter = async () => {
    serveur.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', arreter);
  process.on('SIGTERM', arreter);
  return serveur;
}

if (require.main === module) {
  demarrer().catch((err) => {
    console.error('Impossible de démarrer le serveur :', err.message);
    process.exit(1);
  });
}
