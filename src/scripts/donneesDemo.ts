import { Association } from '../models/Association';
import { Evenement } from '../models/Evenement';
import { Inscription } from '../models/Inscription';
import { Utilisateur, UtilisateurDoc } from '../models/Utilisateur';

/** Mot de passe commun à tous les comptes de démonstration. */
export const MOT_DE_PASSE_DEMO = 'Motdepasse1';

/** « Le Bris » -> « lebris », « Quéré » -> « quere » */
const sansAccents = (texte: string) =>
  texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

const dans = (jours: number, heure = 19, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  d.setHours(heure, minute, 0, 0);
  return d;
};

/**
 * Vide la base puis insère un jeu de données réaliste :
 * 1 admin, 2 responsables, 8 étudiants, 5 associations (dont 1 inactive),
 * 12 événements (brouillons, passés, un presque complet) et des inscriptions.
 */
export async function remplirBase(): Promise<void> {
  await Promise.all([
    Inscription.deleteMany({}),
    Evenement.deleteMany({}),
    Utilisateur.deleteMany({}),
    Association.deleteMany({}),
  ]);

  const [bde, sport, robot, art, ancienne] = await Association.create([
    {
      nom: 'BDE ISEN',
      description:
        "Le Bureau des élèves anime la vie du campus : soirées, week-end d'intégration, gala de fin d'année et partenariats étudiants.",
      contact: { email: 'bde@isen.example', telephone: '02 98 00 00 01', siteWeb: 'https://bde.isen.example' },
    },
    {
      nom: 'Bureau des sports',
      description: 'Futsal, escalade, running du jeudi et tournois inter-écoles. Tous niveaux bienvenus.',
      contact: { email: 'bds@isen.example' },
    },
    {
      nom: 'ISEN Robotique',
      description:
        'Club de robotique : conception de robots pour la Coupe de France, ateliers soudure, impression 3D et programmation embarquée.',
      contact: { email: 'robotique@isen.example', siteWeb: 'https://robot.isen.example' },
    },
    {
      nom: 'Atelier Théâtre',
      description: "Improvisation chaque mardi et une pièce montée chaque printemps. Pas besoin d'expérience.",
      contact: { email: 'theatre@isen.example' },
    },
    {
      nom: 'Club Œnologie',
      description: 'Club en sommeil cette année.',
      contact: { email: 'oeno@isen.example' },
      statut: 'inactive',
    },
  ]);

  // create() un par un : le hook de hachage du mot de passe s'exécute pour chaque document.
  const admin = await Utilisateur.create({
    prenom: 'Alice', nom: 'Martin', email: 'admin@isen.example', motDePasse: MOT_DE_PASSE_DEMO, role: 'admin',
  });
  await Utilisateur.create({
    prenom: 'Bruno', nom: 'Le Gall', email: 'bde@isen.example', motDePasse: MOT_DE_PASSE_DEMO, role: 'responsable', association: bde._id,
  });
  await Utilisateur.create({
    prenom: 'Chloé', nom: 'Riou', email: 'sport@isen.example', motDePasse: MOT_DE_PASSE_DEMO, role: 'responsable', association: sport._id,
  });
  const etudiants: UtilisateurDoc[] = [];
  const noms = [
    ['Emma', 'Kerbrat'], ['Lucas', 'Tanguy'], ['Léa', 'Morvan'], ['Hugo', 'Quéré'],
    ['Inès', 'Guillou'], ['Nathan', 'Cariou'], ['Jade', 'Le Bris'], ['Tom', 'Prigent'],
  ];
  for (const [i, [prenom, nom]] of noms.entries()) {
    etudiants.push(
      await Utilisateur.create({
        prenom, nom, email: i === 0 ? 'etudiant@isen.example' : `${sansAccents(prenom)}.${sansAccents(nom)}@isen.example`,
        motDePasse: MOT_DE_PASSE_DEMO,
      })
    );
  }

  const evenements = await Evenement.create([
    { titre: "Soirée d'intégration", description: 'DJ set, photobooth et food trucks pour accueillir les premières années.\nNavette retour à 2 h.', date: dans(5, 21), lieu: 'Le Vauban, Brest', capacite: 250, categorie: 'soiree', association: bde._id, statut: 'publie' },
    { titre: 'Gala de fin d’année', description: 'Tenue de soirée exigée. Dîner, orchestre et remise des diplômes de la promo sortante.', date: dans(45, 20), lieu: 'Château de Brest', capacite: 400, categorie: 'soiree', association: bde._id, statut: 'publie' },
    { titre: 'Afterwork BDE', description: 'Brouillon en préparation.', date: dans(20, 18, 30), lieu: 'Foyer étudiant', capacite: 60, categorie: 'soiree', association: bde._id, statut: 'brouillon' },
    { titre: 'Tournoi de futsal inter-promos', description: 'Équipes de 5, inscription individuelle : on compose les équipes sur place.', date: dans(3, 14), lieu: 'Gymnase du campus', capacite: 40, categorie: 'sport', association: sport._id, statut: 'publie' },
    { titre: 'Initiation escalade', description: 'Matériel fourni. Places très limitées !', date: dans(8, 18), lieu: 'Salle Block’Out', capacite: 3, categorie: 'sport', association: sport._id, statut: 'publie' },
    { titre: 'Course des Capucins', description: '10 km au bord de la Penfeld, départ groupé.', date: dans(-10, 10), lieu: 'Ateliers des Capucins', capacite: 80, categorie: 'sport', association: sport._id, statut: 'publie' },
    { titre: 'Atelier soudure pour débutants', description: 'Apprenez à souder vos premiers composants. Fer et kits fournis.', date: dans(6, 17, 30), lieu: 'Fablab, bâtiment B', capacite: 12, categorie: 'atelier', association: robot._id, statut: 'publie' },
    { titre: 'Conférence : la robotique sous-marine', description: "Une ingénieure de l'Ifremer présente les drones sous-marins autonomes.", date: dans(12, 18), lieu: 'Amphi A', capacite: 150, categorie: 'conference', association: robot._id, statut: 'publie' },
    { titre: 'Impro du mardi', description: 'Séance ouverte à tous, venez tester !', date: dans(2, 19, 30), lieu: 'Salle polyvalente', capacite: 25, categorie: 'culture', association: art._id, statut: 'publie' },
    { titre: 'Représentation de printemps', description: '« Le Dîner de cons », par la troupe de l’Atelier Théâtre.', date: dans(60, 20, 30), lieu: 'Le Mac Orlan', capacite: 200, categorie: 'culture', association: art._id, statut: 'publie' },
    { titre: 'Collecte pour la Banque alimentaire', description: 'Tenez un stand de collecte avec nous au supermarché du quartier.', date: dans(15, 9), lieu: 'Carrefour Iroise', capacite: 20, categorie: 'humanitaire', association: bde._id, statut: 'publie' },
    { titre: 'Dégustation de rentrée', description: 'Association inactive : cet événement ne doit pas apparaître.', date: dans(9, 19), lieu: 'Foyer', capacite: 30, categorie: 'autre', association: ancienne._id, statut: 'publie' },
  ]);

  // Inscriptions : on passe par la même logique que l'application (compteur nbInscrits cohérent).
  const inscrire = async (u: UtilisateurDoc, e: (typeof evenements)[number], statut: 'confirmee' | 'annulee' = 'confirmee') => {
    await Inscription.create({ utilisateur: u._id, evenement: e._id, statut, dateInscription: dans(-2, 12) });
    if (statut === 'confirmee') await Evenement.updateOne({ _id: e._id }, { $inc: { nbInscrits: 1 } });
  };
  const [integration, , , futsal, escalade, course, soudure, conference, impro] = evenements;
  for (const u of etudiants.slice(0, 6)) await inscrire(u, integration);
  for (const u of etudiants.slice(1, 3)) await inscrire(u, escalade); // 2/3 : presque complet
  for (const u of etudiants.slice(0, 4)) await inscrire(u, futsal);
  for (const u of etudiants.slice(2, 7)) await inscrire(u, course);
  await inscrire(etudiants[0], soudure);
  await inscrire(etudiants[0], conference, 'annulee');
  await inscrire(etudiants[3], impro);
  await inscrire(admin, conference);
}
