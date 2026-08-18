import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI;
const mongoDbName = process.env.MONGO_DB_NAME || 'AllenDataHub02';

async function testConnection() {
  console.log('\n🧪 Testing MongoDB Connection...\n');
  console.log(`📡 URI: ${mongoUri?.replace(/:[^:]*@/, ':***@')}`);
  console.log(`📊 Database: ${mongoDbName}\n`);

  try {
    const client = new MongoClient(mongoUri);
    console.log('⏳ Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const db = client.db(mongoDbName);
    
    // List existing databases
    const admin = client.db().admin();
    const databases = await admin.listDatabases();
    console.log('📚 Available databases:');
    databases.databases.forEach(d => {
      console.log(`   - ${d.name}`);
    });

    console.log('\n✨ Connection test passed!');
    console.log('💡 Tip: AllenDataHub02 will appear after collections are created.\n');
    
    await client.close();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check your IP is whitelisted in MongoDB Atlas');
    console.log('2. Go to: Security → Network Access');
    console.log('3. Add your current IP address');
    console.log('4. Wait 1-2 minutes for changes to propagate\n');
    process.exit(1);
  }
}

testConnection();
