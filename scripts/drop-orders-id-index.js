#!/usr/bin/env node
import mongoose from 'mongoose';

const uri = process.env.NEW_MONGO_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error('Set NEW_MONGO_URI or DATABASE_URL environment variable');
  process.exit(1);
}

(async () => {
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    const coll = conn.db.collection('orders');

    const indexesBefore = await coll.indexes();
    console.log('Indexes before:');
    console.dir(indexesBefore, { depth: 4 });

    const hasIdIndex = indexesBefore.find(i => i.name === 'id_1' || (i.key && i.key.id === 1));
    if (!hasIdIndex) {
      console.log('No id_1 index found; nothing to drop.');
      await conn.close();
      process.exit(0);
    }

    console.log('Dropping id_1 index...');
    await coll.dropIndex('id_1');

    const indexesAfter = await coll.indexes();
    console.log('Indexes after:');
    console.dir(indexesAfter, { depth: 4 });

    await conn.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
