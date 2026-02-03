#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const argv = process.argv.slice(2);
const uriArgIndex = argv.findIndex(a => a.startsWith('--uri='));
const uri = uriArgIndex >= 0 ? argv[uriArgIndex].split('=')[1] : process.env.OLD_MONGO_URI || process.env.NEW_MONGO_URI || process.env.DATABASE_URL;

if (!uri) {
  console.error('Usage: OLD_MONGO_URI=... node scripts/preview-users.js  OR  node scripts/preview-users.js --uri="<MONGO_URI>"');
  process.exit(1);
}

async function preview() {
  let conn;
  try {
    conn = await mongoose.createConnection(uri).asPromise();
    const docs = await conn.db.collection('users').find().limit(5).toArray();
    console.log('First', docs.length, 'documents from', uri.split('@').pop());
    for (const d of docs) {
      console.log('--- doc _id:', d._id, '---');
      console.log(Object.keys(d).sort().join(', '));
      console.dir(d, { depth: 2 });
    }
  } catch (err) {
    console.error('Preview error:', err.message);
  } finally {
    if (conn) await conn.close();
  }
}

preview().then(() => process.exit(0)).catch(() => process.exit(1));
