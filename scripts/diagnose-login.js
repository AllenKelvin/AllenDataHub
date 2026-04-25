#!/usr/bin/env node
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const uri = 'mongodb+srv://Allendatahub:Debbieallen3223@allencluster.vxjsqwa.mongodb.net/AllenCluster?appName=AllenCluster';

async function diagnose() {
  let conn;
  try {
    conn = await mongoose.createConnection(uri).asPromise();
    const users = await conn.db.collection('users').find({ username: { $regex: /^user$/i } }).limit(5).toArray();
    
    console.log('Found users:', users.length);
    for (const u of users) {
      console.log('\n--- User ---');
      console.log('username:', u.username);
      console.log('email:', u.email);
      console.log('password:', u.password);
      console.log('role:', u.role);
      
      // Test common passwords
      const testPasswords = ['password', '123456', 'user123', 'User123!', 'password123'];
      for (const pwd of testPasswords) {
        try {
          if (u.password && u.password.startsWith('$2')) {
            const match = await bcrypt.compare(pwd, u.password);
            if (match) {
              console.log(`✓ Password "${pwd}" MATCHES!`);
            }
          }
        } catch (e) {
          // skip
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (conn) await conn.close();
  }
}

diagnose().then(() => process.exit(0)).catch(() => process.exit(1));