import fs from 'fs';
import type { TestProject } from 'vitest/node';
import { MongoMemoryServer } from 'mongodb-memory-server';

/** Démarre UNE base MongoDB en mémoire pour toute la suite de tests. */
export default async function ({ provide }: TestProject) {
  // Environnements où la distribution Linux n'est pas détectable (conteneurs, Flatpak) :
  // on choisit des binaires génériques compatibles glibc / OpenSSL 3.
  if (process.platform === 'linux' && !process.env.MONGOMS_DISTRO) {
    const osRelease = fs.existsSync('/etc/os-release') ? fs.readFileSync('/etc/os-release', 'utf8') : '';
    if (!/^ID=/m.test(osRelease) || /^ID=org\.freedesktop/m.test(osRelease)) process.env.MONGOMS_DISTRO = 'ubuntu-24.04';
  }
  const mongo = await MongoMemoryServer.create();
  provide('mongoUri', mongo.getUri());
  return async () => {
    await mongo.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
