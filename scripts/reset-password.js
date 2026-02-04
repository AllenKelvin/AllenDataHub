#!/usr/bin/env node
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const uri = 'mongodb+srv://Allendatahub:Debbieallen3223@allencluster.vxjsqwa.mongodb.net/AllenCluster?appName=AllenCluster';
const plainPassword = '123456';

(async () => {
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    const hash = await bcrypt.hash(plainPassword, 10);
    const result = await conn.db.collection('users').updateOne(
      { username: 'allen_kelvin' },
      { $set: { password: hash } }
    );
    console.log(`Updated password for allen_kelvin`);
    console.log(`New hash: ${hash}`);
    await conn.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
