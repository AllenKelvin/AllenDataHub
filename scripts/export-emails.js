#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises';
dotenv.config();

const argv = process.argv.slice(2);
const uriArgIndex = argv.findIndex(a => a.startsWith('--uri='));
const uri = uriArgIndex >= 0 ? argv[uriArgIndex].split('=')[1] : process.env.OLD_MONGO_URI || process.env.NEW_MONGO_URI || process.env.DATABASE_URL;

if (!uri) {
  console.error('Usage: OLD_MONGO_URI=... node scripts/export-emails.js  OR  node scripts/export-emails.js --uri="<MONGO_URI>"');
  process.exit(1);
}

async function exportEmails() {
  let conn;
  try {
    conn = await mongoose.createConnection(uri).asPromise();
    const cursor = conn.db.collection('users').find({}, { projection: { email: 1 } });
    const emails = [];
    await cursor.forEach(doc => {
      if (doc && doc.email) emails.push(String(doc.email).trim().toLowerCase());
    });
    const unique = Array.from(new Set(emails));
    const outPath = 'emails.txt';
    await fs.writeFile(outPath, unique.join('\n'));
    console.log(`Wrote ${unique.length} emails to ${outPath}`);
  } catch (err) {
    console.error('Export error:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.close();
  }
}

exportEmails().then(() => process.exit(0)).catch(() => process.exit(1));
