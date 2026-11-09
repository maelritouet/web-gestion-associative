import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { requeteInvalide } from '../services/erreurs';

export const DOSSIER_UPLOADS = path.join(__dirname, '..', '..', 'public', 'uploads');
const TAILLE_MAX = 2 * 1024 * 1024; // 2 Mo

/**
 * Les fichiers sont gardés en mémoire : rien n'est écrit sur le disque tant que la requête
 * n'a pas passé la vérification CSRF, les droits et la validation du contenu.
 */
export const televersementLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAILLE_MAX, files: 1 },
}).single('logo');

/**
 * On identifie le type réel par les "magic bytes" du fichier, et non par l'extension
 * ou le Content-Type envoyés par le client (facilement falsifiables).
 */
function detecterImage(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  return null;
}

/** Enregistre le logo téléversé et renvoie son chemin public (/uploads/xxx.png). */
export async function enregistrerLogo(fichier: Express.Multer.File): Promise<string> {
  const extension = detecterImage(fichier.buffer);
  if (!extension) {
    throw requeteInvalide('Logo invalide', { logo: 'Le logo doit être une image PNG, JPEG, WebP ou GIF' });
  }
  const nom = `${crypto.randomUUID()}.${extension}`;
  await fs.mkdir(DOSSIER_UPLOADS, { recursive: true });
  await fs.writeFile(path.join(DOSSIER_UPLOADS, nom), fichier.buffer);
  return `/uploads/${nom}`;
}

/** Supprime un logo précédemment téléversé (ignore tout chemin hors du dossier uploads). */
export async function supprimerLogo(cheminPublic: string): Promise<void> {
  if (!cheminPublic.startsWith('/uploads/')) return;
  const nom = path.basename(cheminPublic);
  await fs.rm(path.join(DOSSIER_UPLOADS, nom), { force: true });
}
