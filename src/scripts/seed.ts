import { env } from '../config/env';
import { connecterBase, deconnecterBase } from '../config/database';
import { remplirBase, MOT_DE_PASSE_DEMO } from './donneesDemo';

/** npm run seed : (ré)initialise la base MONGODB_URI avec les données de démonstration. */
async function main() {
  await connecterBase(env.mongoUri);
  console.log(`Remplissage de ${env.mongoUri} …`);
  await remplirBase();
  console.log('Base initialisée. Comptes (mot de passe « %s ») :', MOT_DE_PASSE_DEMO);
  console.log('  admin@isen.example (admin), bde@isen.example / sport@isen.example (responsables), etudiant@isen.example');
  await deconnecterBase();
}

main().catch(async (err) => {
  console.error(err);
  await deconnecterBase();
  process.exit(1);
});
