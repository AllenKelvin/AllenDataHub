#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const OLD_MONGO_URI = process.env.OLD_MONGO_URI;
const NEW_MONGO_URI = process.env.NEW_MONGO_URI || process.env.DATABASE_URL;

if (!OLD_MONGO_URI) {
  console.error('Missing OLD_MONGO_URI. Set it in the environment.');
  process.exit(1);
}
if (!NEW_MONGO_URI) {
  console.error('Missing NEW_MONGO_URI or DATABASE_URL. Set it in the environment.');
  process.exit(1);
}

async function transfer() {
  let oldConn;
  let newConn;
  try {
    console.log('Connecting to old DB...');
    oldConn = await mongoose.createConnection(OLD_MONGO_URI).asPromise();
    console.log('Connecting to new DB...');
    newConn = await mongoose.createConnection(NEW_MONGO_URI).asPromise();

    const oldColl = oldConn.db.collection('users');
    const newColl = newConn.db.collection('users');

    // Project common fields; adjust if your schema uses different names
    const cursor = oldColl.find({}, { projection: { email: 1, username: 1, password: 1, name: 1 } });

    let count = 0;
    let skipped = 0;
    for await (const doc of cursor) {
      if (!doc.email) {
        skipped++;
        console.warn('Skipping document without email _id=', doc._id);
        continue;
      }

      // Remove _id to avoid duplicate-key issues on import
      const { _id, ...rest } = doc;

      try {
        await newColl.updateOne(
          { email: doc.email },
          { $set: rest },
          { upsert: true },
        );
        count++;
      } catch (err) {
        console.error('Failed to upsert', doc.email, err.message);
      }
    }

    console.log(`Done. Upserted: ${count}, Skipped (no email): ${skipped}`);
  } catch (err) {
    console.error('Error during transfer:', err);
  } finally {
    if (oldConn) await oldConn.close();
    if (newConn) await newConn.close();
  }
}

transfer().then(() => process.exit(0)).catch(() => process.exit(1));
