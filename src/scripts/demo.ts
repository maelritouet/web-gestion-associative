import { MongoMemoryServer } from 'mongodb-memory-server';
import { demarrer } from '../server';
import { remplirBase, MOT_DE_PASSE_DEMO } from './donneesDemo';
import { env } from '../config/env';

/**
 * npm run demo : lance l'application SANS installer MongoDB.
 * Une base MongoDB temporaire (en mémoire) est créée, remplie, puis détruite à l'arrêt.
 */
async function main() {
  console.log('Démarrage d’une base MongoDB en mémoire (premier lancement : téléchargement ~120 Mo)…');
  const mongo = await MongoMemoryServer.create();
  await demarrer(mongo.getUri('vie-associative-demo'), env.port);
  await remplirBase();
  console.log(`\nDonnées de démonstration chargées. Mot de passe de tous les comptes : ${MOT_DE_PASSE_DEMO}`);
  console.log('  admin@isen.example      administrateur');
  console.log('  bde@isen.example        responsable du BDE');
  console.log('  sport@isen.example      responsable du Bureau des sports');
  console.log('  etudiant@isen.example   étudiant\n');
  process.on('exit', () => void mongo.stop());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
