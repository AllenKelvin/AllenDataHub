import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
const dbName = process.env.MONGO_DB_NAME || 'platform';

if (!uri) {
  console.error('Missing MONGO_URI or DATABASE_URL in .env');
  process.exit(1);
}

const client = new MongoClient(uri);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function getInitials(fullName) {
  const safeName = String(fullName || '').trim();
  if (!safeName) return 'U';
  const initials = safeName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
  return initials || 'U';
}

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

function normalizeLegacyUser(doc = {}) {
  const fullName = String(doc.fullName || doc.name || doc.displayName || doc.username || 'User').trim();
  const email = normalizeEmail(doc.email || doc.emailAddress || doc.userEmail || '');
  const phone = normalizePhone(doc.phone || doc.phoneNumber || doc.mobile || doc.whatsapp || doc.momo || '');
  const username = String(doc.username || doc.userName || (email ? `@${fullName.replace(/\s+/g, '').slice(0, 8) || 'user'}` : '')).trim();
  const referralCode = String(doc.referralCode || doc.referral_code || doc.refCode || '').trim() || `${fullName.split(' ').map((p) => p[0]).join('').slice(0, 4).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

  return {
    id: String(doc.id || doc.userId || doc._id?.toString?.() || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    fullName,
    email,
    username,
    phone,
    whatsapp: String(doc.whatsapp || doc.whatsApp || '').trim(),
    momo: String(doc.momo || doc.mobileMoney || '').trim(),
    password: doc.password || '',
    role: ['admin', 'agent', 'dealer', 'user'].includes(doc.role) ? doc.role : (doc.isAdmin ? 'admin' : 'user'),
    network: doc.network || 'MTN',
    status: ['pending', 'rejected'].includes(String(doc.status || '').toLowerCase()) ? String(doc.status).toLowerCase() : 'approved',
    emailVerified: !!doc.emailVerified || !!doc.isVerified || !!doc.verified,
    phoneVerified: !!doc.phoneVerified || !!doc.phone_verified,
    walletBalance: Number(doc.walletBalance ?? doc.balance ?? 0),
    commissionEarned: Number(doc.commissionEarned ?? 0),
    referralCode,
    totalReferrals: Number(doc.totalReferrals ?? 0),
    referredBy: doc.referredBy || doc.referred_by || undefined,
    initials: String(doc.initials || getInitials(fullName)).toUpperCase(),
    createdAt: doc.createdAt || doc.created_at || new Date().toISOString(),
  };
}

function normalizeLegacyProduct(doc = {}) {
  const network = String(doc.network || doc.operator || 'MTN').trim();
  const name = String(doc.name || doc.label || doc.productName || `${doc.size || 'Bundle'} Bundle`).trim();
  const size = String(doc.size || doc.bundle || doc.packageSize || doc.label || '1GB').trim();
  const price = Number(doc.price ?? doc.userPrice ?? doc.amount ?? 0);
  const userPrice = Number(doc.userPrice ?? doc.price ?? doc.amount ?? 0);
  const agentPrice = Number(doc.agentPrice ?? doc.price ?? 0);

  return {
    id: String(doc.id || doc.productId || doc._id?.toString?.() || `${network.toLowerCase()}_${size.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`),
    name,
    size,
    price,
    userPrice,
    agentPrice,
    validity: String(doc.validity || doc.duration || '30 Days').trim(),
    network,
    enabled: doc.enabled !== false,
    createdAt: doc.createdAt || doc.created_at || new Date().toISOString(),
  };
}

async function mergeUsers(db) {
  const target = db.collection('users');
  const legacyCollections = ['legacy_users', 'users_legacy', 'migrated_users', 'user'];
  let mergedCount = 0;

  for (const name of legacyCollections) {
    if (!(await db.listCollections({ name }).hasNext())) continue;
    const source = db.collection(name);
    const docs = await source.find({}).toArray();

    for (const doc of docs) {
      const normalized = normalizeLegacyUser(doc);
      if (!normalized.email && !normalized.phone && !normalized.id) continue;

      const existing = await target.findOne({
        $or: [
          { id: normalized.id },
          ...(normalized.email ? [{ email: normalized.email }] : []),
          ...(normalized.phone ? [{ phone: normalized.phone }] : []),
        ],
      });

      if (!existing) {
        await target.insertOne(normalized);
        mergedCount += 1;
        continue;
      }

      const merged = {
        ...existing,
        fullName: pickValue(existing.fullName, normalized.fullName),
        email: pickValue(existing.email, normalized.email),
        username: pickValue(existing.username, normalized.username),
        phone: pickValue(existing.phone, normalized.phone),
        whatsapp: pickValue(existing.whatsapp, normalized.whatsapp),
        momo: pickValue(existing.momo, normalized.momo),
        password: pickValue(existing.password, normalized.password),
        role: pickValue(existing.role, normalized.role),
        network: pickValue(existing.network, normalized.network),
        status: pickValue(existing.status, normalized.status),
        emailVerified: existing.emailVerified || normalized.emailVerified,
        phoneVerified: existing.phoneVerified || normalized.phoneVerified,
        walletBalance: Number(existing.walletBalance || 0) > 0 ? Number(existing.walletBalance || 0) : Number(normalized.walletBalance || 0),
        commissionEarned: Number(existing.commissionEarned || 0) > 0 ? Number(existing.commissionEarned || 0) : Number(normalized.commissionEarned || 0),
        referralCode: pickValue(existing.referralCode, normalized.referralCode),
        totalReferrals: Math.max(Number(existing.totalReferrals || 0), Number(normalized.totalReferrals || 0)),
        referredBy: pickValue(existing.referredBy, normalized.referredBy),
        initials: pickValue(existing.initials, normalized.initials),
        createdAt: pickValue(existing.createdAt, normalized.createdAt),
      };

      await target.updateOne({ _id: existing._id }, { $set: merged });
      mergedCount += 1;
    }
  }

  return mergedCount;
}

async function mergeProducts(db) {
  const target = db.collection('products');
  const legacyCollections = ['legacy_products', 'products_legacy', 'migrated_products', 'product'];
  let mergedCount = 0;

  for (const name of legacyCollections) {
    if (!(await db.listCollections({ name }).hasNext())) continue;
    const source = db.collection(name);
    const docs = await source.find({}).toArray();

    for (const doc of docs) {
      const normalized = normalizeLegacyProduct(doc);
      if (!normalized.name && !normalized.size && !normalized.id) continue;

      const existing = await target.findOne({
        $or: [
          { id: normalized.id },
          { name: normalized.name, size: normalized.size, network: normalized.network },
        ],
      });

      if (!existing) {
        await target.insertOne(normalized);
        mergedCount += 1;
        continue;
      }

      const merged = {
        ...existing,
        name: pickValue(existing.name, normalized.name),
        size: pickValue(existing.size, normalized.size),
        price: Number(existing.price || 0) > 0 ? Number(existing.price || 0) : Number(normalized.price || 0),
        userPrice: Number(existing.userPrice || 0) > 0 ? Number(existing.userPrice || 0) : Number(normalized.userPrice || 0),
        agentPrice: Number(existing.agentPrice || 0) > 0 ? Number(existing.agentPrice || 0) : Number(normalized.agentPrice || 0),
        validity: pickValue(existing.validity, normalized.validity),
        network: pickValue(existing.network, normalized.network),
        enabled: existing.enabled !== false ? existing.enabled : normalized.enabled,
        createdAt: pickValue(existing.createdAt, normalized.createdAt),
      };

      await target.updateOne({ _id: existing._id }, { $set: merged });
      mergedCount += 1;
    }
  }

  return mergedCount;
}

async function main() {
  await client.connect();
  const db = client.db(dbName);
  const userMerged = await mergeUsers(db);
  const productMerged = await mergeProducts(db);

  console.log(`Migration complete. Users merged: ${userMerged}. Products merged: ${productMerged}.`);
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
}).finally(async () => {
  await client.close();
});
