#!/usr/bin/env node

/**
 * Merge users and products from a test MongoDB database to the platform database.
 * Both databases are in the same cluster.
 * 
 * Usage:
 *   node merge-test-to-platform.mjs [--dry-run]
 * 
 * Environment variables:
 *   MONGO_URI          - Connection string (from .env, same for both databases)
 *   MONGO_TEST_DB      - Test database name (default: test)
 *   MONGO_DB_NAME      - Platform database name (from .env, default: platform)
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const dryRun = process.argv.includes('--dry-run');

const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
const testDb = process.env.MONGO_TEST_DB || 'test';
const platformDb = process.env.MONGO_DB_NAME || 'platform';

if (!uri) {
  console.error('❌ Missing MONGO_URI or DATABASE_URL in .env');
  process.exit(1);
}

console.log('📋 Merge Configuration:');
console.log(`   Cluster URI:       ${uri.replace(/mongodb\+srv:\/\/.*@/, 'mongodb+srv://***@')}`);
console.log(`   Test Database:     ${testDb}`);
console.log(`   Platform Database: ${platformDb}`);
console.log(`   Dry Run:           ${dryRun ? 'YES' : 'NO'}`);
console.log('');

let client;

function pickValue(existing, incoming) {
  if (incoming === undefined || incoming === null || (typeof incoming === 'string' && incoming.trim() === '')) {
    return existing;
  }
  if (existing === undefined || existing === null || existing === '') {
    return incoming;
  }
  if (typeof existing === 'string' && typeof incoming === 'string') {
    return existing.trim() ? existing : incoming;
  }
  if (typeof existing === 'number' && typeof incoming === 'number') {
    return existing !== 0 ? existing : incoming;
  }
  return existing;
}

async function mergeUsers(testDb, platformDb) {
  const testUsers = testDb.collection('users');
  const platformUsers = platformDb.collection('users');

  const testDocs = await testUsers.find({}).toArray();
  console.log(`📥 Found ${testDocs.length} users in test database`);

  let inserted = 0;
  let updated = 0;

  for (const testDoc of testDocs) {
    if (!testDoc.email && !testDoc.phone && !testDoc.id) {
      console.log(`   ⏭️  Skipping user (no email, phone, or id)`);
      continue;
    }

    const existing = await platformUsers.findOne({
      $or: [
        { id: testDoc.id },
        ...(testDoc.email ? [{ email: testDoc.email }] : []),
        ...(testDoc.phone ? [{ phone: testDoc.phone }] : []),
      ],
    });

    if (!existing) {
      if (!dryRun) {
        await platformUsers.insertOne(testDoc);
      }
      console.log(`   ✅ User ${testDoc.email || testDoc.phone || testDoc.id} - INSERTED`);
      inserted += 1;
    } else {
      const merged = {
        ...existing,
        fullName: pickValue(existing.fullName, testDoc.fullName),
        email: pickValue(existing.email, testDoc.email),
        username: pickValue(existing.username, testDoc.username),
        phone: pickValue(existing.phone, testDoc.phone),
        whatsapp: pickValue(existing.whatsapp, testDoc.whatsapp),
        momo: pickValue(existing.momo, testDoc.momo),
        password: pickValue(existing.password, testDoc.password),
        role: pickValue(existing.role, testDoc.role),
        network: pickValue(existing.network, testDoc.network),
        status: pickValue(existing.status, testDoc.status),
        emailVerified: existing.emailVerified || testDoc.emailVerified,
        phoneVerified: existing.phoneVerified || testDoc.phoneVerified,
        walletBalance: Number(existing.walletBalance || 0) > 0 ? Number(existing.walletBalance || 0) : Number(testDoc.walletBalance || 0),
        commissionEarned: Number(existing.commissionEarned || 0) > 0 ? Number(existing.commissionEarned || 0) : Number(testDoc.commissionEarned || 0),
        referralCode: pickValue(existing.referralCode, testDoc.referralCode),
        totalReferrals: Math.max(Number(existing.totalReferrals || 0), Number(testDoc.totalReferrals || 0)),
        referredBy: pickValue(existing.referredBy, testDoc.referredBy),
        initials: pickValue(existing.initials, testDoc.initials),
        createdAt: pickValue(existing.createdAt, testDoc.createdAt),
      };

      if (!dryRun) {
        await platformUsers.updateOne({ _id: existing._id }, { $set: merged });
      }
      console.log(`   🔄 User ${testDoc.email || testDoc.phone || testDoc.id} - MERGED`);
      updated += 1;
    }
  }

  console.log(`\n✨ Users Summary: ${inserted} inserted, ${updated} merged`);
  return { inserted, updated };
}

async function mergeProducts(testDb, platformDb) {
  const testProducts = testDb.collection('products');
  const platformProducts = platformDb.collection('products');

  const testDocs = await testProducts.find({}).toArray();
  console.log(`📥 Found ${testDocs.length} products in test database`);

  let inserted = 0;
  let updated = 0;

  for (const testDoc of testDocs) {
    if (!testDoc.name && !testDoc.size && !testDoc.id) {
      console.log(`   ⏭️  Skipping product (no name, size, or id)`);
      continue;
    }

    const existing = await platformProducts.findOne({
      $or: [
        { id: testDoc.id },
        { name: testDoc.name, size: testDoc.size, network: testDoc.network },
      ],
    });

    if (!existing) {
      if (!dryRun) {
        await platformProducts.insertOne(testDoc);
      }
      console.log(`   ✅ Product ${testDoc.name || testDoc.id} (${testDoc.network}) - INSERTED`);
      inserted += 1;
    } else {
      const merged = {
        ...existing,
        name: pickValue(existing.name, testDoc.name),
        size: pickValue(existing.size, testDoc.size),
        price: Number(existing.price || 0) > 0 ? Number(existing.price || 0) : Number(testDoc.price || 0),
        userPrice: Number(existing.userPrice || 0) > 0 ? Number(existing.userPrice || 0) : Number(testDoc.userPrice || 0),
        agentPrice: Number(existing.agentPrice || 0) > 0 ? Number(existing.agentPrice || 0) : Number(testDoc.agentPrice || 0),
        validity: pickValue(existing.validity, testDoc.validity),
        network: pickValue(existing.network, testDoc.network),
        enabled: existing.enabled !== false ? existing.enabled : testDoc.enabled,
        createdAt: pickValue(existing.createdAt, testDoc.createdAt),
      };

      if (!dryRun) {
        await platformProducts.updateOne({ _id: existing._id }, { $set: merged });
      }
      console.log(`   🔄 Product ${testDoc.name || testDoc.id} (${testDoc.network}) - MERGED`);
      updated += 1;
    }
  }

  console.log(`\n✨ Products Summary: ${inserted} inserted, ${updated} merged`);
  return { inserted, updated };
}

async function main() {
  try {
    console.log('🔗 Connecting to MongoDB cluster...');
    client = new MongoClient(uri);
    await client.connect();

    const testDbInstance = client.db(testDb);
    const platformDbInstance = client.db(platformDb);

    console.log('✅ Connected to cluster\n');

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    console.log('╔════════════════════════════════════════╗');
    console.log('║         MERGING USERS                  ║');
    console.log('╚════════════════════════════════════════╝\n');
    const userStats = await mergeUsers(testDbInstance, platformDbInstance);

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║         MERGING PRODUCTS               ║');
    console.log('╚════════════════════════════════════════╝\n');
    const productStats = await mergeProducts(testDbInstance, platformDbInstance);

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║          MERGE COMPLETE                ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`\n📊 Total Results:`);
    console.log(`   Users:    ${userStats.inserted} inserted, ${userStats.updated} merged`);
    console.log(`   Products: ${productStats.inserted} inserted, ${productStats.updated} merged`);

    if (dryRun) {
      console.log('\n💡 This was a dry run. Re-run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Merge completed successfully!');
    }
  } catch (error) {
    console.error('❌ Merge failed:', error.message);
    process.exit(1);
  } finally {
    if (client) await client.close();
  }
}

main();
