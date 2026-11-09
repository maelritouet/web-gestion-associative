import { afterAll, afterEach, beforeAll, inject } from 'vitest';
import mongoose from 'mongoose';
import { connecterBase } from '../src/config/database';

// Chaque fichier de test utilise sa propre base pour rester indépendant des autres.
beforeAll(async () => {
  const nomBase = `test-${Math.random().toString(36).slice(2, 10)}`;
  await connecterBase(inject('mongoUri').replace(/\/?$/, `/${nomBase}`));
});

afterEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
