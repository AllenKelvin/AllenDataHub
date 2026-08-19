import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL || '';
const mongoDbName = process.env.MONGO_DB_NAME || 'platform';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_KEY || '';
const INTERNAL_BRIDGE_SECRET = process.env.INTERNAL_BRIDGE_SECRET || '';
const ALLENDAHUB_FRONTEND_URL = process.env.ALLENDAHUB_FRONTEND_URL || process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'https://allendatahub.com';
const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || `${ALLENDAHUB_FRONTEND_URL.replace(/\/$/, '')}/payment-return`;
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'allendatahub@gmail.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'AllenDataHub';
const PORTAL02_API_KEY = process.env.PORTAL02_API_KEY || process.env.VITE_PORTAL02_API_KEY || '';
const PORTAL02_BASE_URL = process.env.PORTAL02_BASE_URL || process.env.VITE_PORTAL02_BASE_URL || 'https://www.portal-02.com/api/v1';
const PORTAL02_CANCEL_URL = process.env.PORTAL02_CANCEL_URL || '';
const PORTAL02_BACKEND_URL = process.env.BACKEND_URL || process.env.PUBLIC_BACKEND_URL || process.env.VITE_API_URL || 'https://allen-data-hub-backend.onrender.com';
const REFERRAL_COMMISSION_RATE = 0.01;

app.use(cors());
app.use(express.json({
  verify: (req, _res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  },
}));

async function sendBrevoEmail({ toEmail, toName = '', subject, htmlContent, textContent = '', replyTo = '' }) {
  if (!BREVO_API_KEY) {
    return { ok: false, error: 'BREVO_API_KEY is not configured.' };
  }

  if (!toEmail || !subject) {
    return { ok: false, error: 'Recipient email and subject are required.' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to: [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent: htmlContent || `<p>${textContent || 'AllenDataHub Notification'}</p>`,
        textContent: textContent || htmlContent?.replace(/<[^>]+>/g, '') || 'AllenDataHub Notification',
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.message || data.error || 'Brevo email request failed.',
        details: data,
      };
    }

    return {
      ok: true,
      messageId: data.messageId || data.id || null,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to send email.',
    };
  }
}

const DEFAULT_NETWORK_SETTINGS = [
  { network: 'MTN', enabled: true },
  { network: 'AirtelTigo', enabled: true },
  { network: 'Telecel', enabled: true },
];

const DEFAULT_API_CONFIG = { enabled: true, note: 'API access active' };

let client;
let db;

const PORTAL02_OFFER_SLUGS = {
  MTN: 'master_beneficiary_data_bundle',
  Telecel: 'telecel_expiry_bundle',
  AirtelTigo: 'ishare_data_bundle',
};

const PORTAL02_NETWORK_ENDPOINTS = {
  MTN: 'mtn',
  Telecel: 'telecel',
  AirtelTigo: 'at',
};

function normalizePortalNetwork(network) {
  const value = String(network || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (value === 'mtn') return 'MTN';
  if (value === 'telecel' || value === 'vodafone') return 'Telecel';
  if (value === 'airteltigo' || value === 'airtel' || value === 'tigo' || value === 'at') return 'AirtelTigo';
  return String(network || '').trim();
}

const PORTAL02_AVAILABLE_VOLUMES = {
  MTN: [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
  Telecel: [5, 10, 15, 20, 25, 30, 40, 50, 100],
  AirtelTigo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20],
};

function makeId(prefix) {
  const randomPart = crypto.randomBytes(10).toString('hex');
  if (prefix === 'ord') {
    return `${prefix}_${Date.now().toString(36).slice(-6)}_${randomPart}`;
  }
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function normalizePortalPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.startsWith('+233')) return digits.replace(/^\+/, '');
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

function extractPortalVolume(size) {
  const numeric = Number(String(size || '').match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function purchaseWithPortal02({ phone, size, network, reference, webhookUrl }) {
  if (!PORTAL02_API_KEY) {
    return { success: false, error: 'PORTAL02_API_KEY is not configured.' };
  }

  const normalizedNetwork = normalizePortalNetwork(network);
  const offerSlug = PORTAL02_OFFER_SLUGS[normalizedNetwork];
  const endpoint = PORTAL02_NETWORK_ENDPOINTS[normalizedNetwork];
  const volume = extractPortalVolume(size);
  const phoneNumber = normalizePortalPhone(phone);

  if (!offerSlug || !endpoint) {
    return { success: false, error: `Unsupported Portal-02 network: ${network}` };
  }

  if (!phoneNumber || phoneNumber.length < 10) {
    return { success: false, error: 'Phone number is invalid for Portal-02 purchase.' };
  }

  if (!PORTAL02_AVAILABLE_VOLUMES[normalizedNetwork]?.includes(volume)) {
    return { success: false, error: `${volume}GB is not available for ${network}.` };
  }

  const url = `${String(PORTAL02_BASE_URL).replace(/\/$/, '')}/order/${endpoint}`;
  const payload = {
    type: 'single',
    volume,
    phone: phoneNumber,
    offerSlug,
    webhookUrl: webhookUrl || `${PORTAL02_BACKEND_URL.replace(/\/$/, '')}/api/webhooks/portal02`,
    reference: reference || makeId('ord'),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': PORTAL02_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `Portal-02 request failed with status ${response.status}`,
        statusCode: response.status,
        details: data,
      };
    }

    return {
      success: true,
      transactionId: data.orderId || data.id || payload.reference,
      reference: data.reference || payload.reference,
      status: data.status || 'pending',
      raw: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Portal-02 network error.',
      details: null,
    };
  }
}

async function cancelPortal02Order({ network, orderId, reference }) {
  if (!PORTAL02_API_KEY) {
    return { success: false, error: 'PORTAL02_API_KEY is not configured.' };
  }

  const normalizedNetwork = normalizePortalNetwork(network);
  const endpoint = PORTAL02_NETWORK_ENDPOINTS[normalizedNetwork] || String(normalizedNetwork || '').toLowerCase();
  const baseUrl = String(PORTAL02_BASE_URL).replace(/\/$/, '');
  const vendorId = String(orderId || '').trim();
  const vendorReference = String(reference || '').trim();
  if (!vendorId && !vendorReference) {
    return { success: false, error: 'No Portal-02 order identifier was found for cancellation.' };
  }

  const requestBodies = [
    { orderId: vendorId || vendorReference, reference: vendorReference || vendorId, network: normalizedNetwork },
    { order_id: vendorId || vendorReference, clientReference: vendorReference || vendorId, network: normalizedNetwork },
    { orderId: vendorId || vendorReference, reference: vendorReference || vendorId, network: endpoint },
  ];
  const candidateRequests = [
    ...(PORTAL02_CANCEL_URL ? [{ url: PORTAL02_CANCEL_URL, method: 'POST' }] : []),
    { url: `${baseUrl}/order/${endpoint}/cancel`, method: 'POST' },
    { url: `${baseUrl}/order/cancel`, method: 'POST' },
    { url: `${baseUrl}/cancel/${endpoint}`, method: 'POST' },
    { url: `${baseUrl}/order/${endpoint}`, method: 'DELETE' },
  ].filter(Boolean);

  for (const candidate of candidateRequests) {
    for (const requestBody of requestBodies) {
      console.log(JSON.stringify({
        tag: 'PORTAL02_CANCEL_ATTEMPT',
        url: candidate.url,
        method: candidate.method,
        network: normalizedNetwork,
        orderId: vendorId,
        reference: vendorReference,
      }));
      try {
        const response = await fetch(candidate.url, {
          method: candidate.method,
          headers: {
            'x-api-key': PORTAL02_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json().catch(() => ({}));
        const status = String(data.status || data.state || '').toLowerCase();
        const explicitlyFailed = data.success === false || ['failed', 'error', 'rejected'].includes(status);
        const cancellationConfirmed = ['cancelled', 'canceled', 'refunded', 'success', 'completed'].includes(status)
          || data.cancelled === true
          || data.canceled === true
          || data.success === true;

        if (response.ok && !explicitlyFailed && cancellationConfirmed) {
          const result = {
            success: true,
            status: status || 'cancelled',
            orderId: data.orderId || data.id || vendorId,
            reference: data.reference || vendorReference || vendorId,
            raw: data,
          };
          console.log(JSON.stringify({ tag: 'PORTAL02_CANCEL_CONFIRMED', ...result, url: candidate.url }));
          return result;
        }

        const errorText = data.message || data.error || `Cancellation request failed with status ${response.status}`;
        console.error(JSON.stringify({
          tag: 'PORTAL02_CANCEL_FAILED',
          url: candidate.url,
          statusCode: response.status,
          vendorStatus: status,
          error: errorText,
          orderId: vendorId,
          reference: vendorReference,
        }));
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Cancellation network error.';
        console.error(JSON.stringify({ tag: 'PORTAL02_CANCEL_NETWORK_ERROR', url: candidate.url, error: errMessage }));
      }
    }
  }

  return { success: false, error: 'Portal-02 cancellation endpoint was not available for this order.' };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2_sha512$${salt}$${hash}`;
}

function isHexHash(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
}

function isLegacyShaHash(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{128,}$/.test(value);
}

function isBcryptHash(value) {
  return typeof value === 'string' && (value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$'));
}

function comparePassword(candidatePassword, storedPassword) {
  if (!candidatePassword || !storedPassword) return false;
  const raw = String(candidatePassword);
  const stored = String(storedPassword);

  if (stored === raw) return true;

  if (stored.startsWith('pbkdf2_sha512$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const expected = crypto.pbkdf2Sync(raw, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash, 'hex'));
  }

  if (stored.startsWith('pbkdf2_sha256$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const expected = crypto.pbkdf2Sync(raw, salt, 100000, 32, 'sha256').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash, 'hex'));
  }

  if (isHexHash(stored)) return crypto.createHash('sha256').update(raw).digest('hex') === stored;
  if (isLegacyShaHash(stored)) return crypto.createHash('sha256').update(raw).digest('hex') === stored.slice(-64);

  if (stored.includes('.')) {
    const [lhs, rhs] = stored.split('.');
    if (lhs && rhs && lhs.length === 64 && rhs.length === 64) {
      return (
        crypto.createHash('sha256').update(`${rhs}${raw}`).digest('hex') === lhs ||
        crypto.createHash('sha256').update(`${raw}${rhs}`).digest('hex') === lhs ||
        crypto.createHash('sha256').update(raw).digest('hex') === lhs
      );
    }
  }

  return false;
}

async function getCollectionByNames(names) {
  if (!db) return null;
  const existing = await db.listCollections().toArray();
  const foundName = names.find((name) => existing.some((item) => item.name === name));
  return foundName ? db.collection(foundName) : db.collection(names[0]);
}

async function collectionExists(name) {
  if (!db) return false;
  const collections = await db.listCollections().toArray();
  return collections.some((item) => item.name === name);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits;
}

function getInitials(fullName) {
  const safeName = String(fullName || '').trim();
  if (!safeName) return 'U';
  return safeName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
}

function pickValue(existing, incoming) {
  if (incoming === undefined || incoming === null) return existing;
  if (typeof incoming === 'string' && incoming.trim() === '') return existing;
  if (typeof incoming === 'number' && Number.isNaN(incoming)) return existing;

  if (existing === undefined || existing === null || existing === '') {
    return incoming;
  }

  if (typeof existing === 'number' && typeof incoming === 'number') {
    if (existing === 0 && incoming !== 0) return incoming;
    return existing;
  }

  if (typeof existing === 'string' && typeof incoming === 'string') {
    if (!String(existing).trim()) return incoming;
    return existing;
  }

  return existing;
}

function normalizeLegacyUser(doc = {}) {
  const fullName = String(doc.fullName || doc.name || doc.displayName || doc.username || 'User').trim();
  const email = normalizeEmail(doc.email || doc.emailAddress || doc.userEmail);
  const phone = normalizePhone(doc.phone || doc.phoneNumber || doc.mobile || doc.whatsapp || doc.momo || '');
  const username = doc.username || doc.userName || (email ? `@${fullName.replace(/\s+/g, '').slice(0, 8) || 'user'}` : '');
  const referralCode = String(doc.referralCode || doc.referral_code || doc.refCode || '').trim() || `${fullName.split(' ').map((p) => p[0]).join('').slice(0, 4).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

  return {
    id: String(doc.id || doc.userId || doc._id?.toString?.() || makeId('usr')),
    fullName,
    email,
    username,
    phone,
    whatsapp: String(doc.whatsapp || doc.whatsApp || '').trim(),
    momo: String(doc.momo || doc.mobileMoney || '').trim(),
    password: doc.password || '',
    role: ['admin', 'agent', 'dealer', 'user'].includes(doc.role) ? doc.role : (doc.isAdmin ? 'admin' : 'user'),
    network: doc.network || 'MTN',
    status: doc.status === 'pending' || doc.status === 'rejected' ? doc.status : 'approved',
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

async function mergeLegacyCollections() {
  if (!db) return;

  const legacyUserCollections = ['legacy_users', 'user', 'users_legacy', 'migrated_users'];
  const legacyProductCollections = ['legacy_products', 'product', 'products_legacy', 'migrated_products'];

  const userNames = await db.listCollections().toArray();
  const userSources = legacyUserCollections.filter((name) => userNames.some((entry) => entry.name === name));
  if (userSources.length > 0) {
    const targetUsers = db.collection('users');
    for (const sourceName of userSources) {
      const source = db.collection(sourceName);
      const docs = await source.find({}).toArray();
      for (const doc of docs) {
        const normalized = normalizeLegacyUser(doc);
        if (!normalized.email && !normalized.phone && !normalized.id) continue;

        const existing = await targetUsers.findOne({
          $or: [
            { id: normalized.id },
            ...(normalized.email ? [{ email: normalized.email }] : []),
            ...(normalized.phone ? [{ phone: normalized.phone }] : []),
          ],
        });

        if (!existing) {
          await targetUsers.insertOne(normalized);
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

        await targetUsers.updateOne({ _id: existing._id }, { $set: merged });
      }
    }
  }

  const productNames = await db.listCollections().toArray();
  const productSources = legacyProductCollections.filter((name) => productNames.some((entry) => entry.name === name));
  if (productSources.length > 0) {
    const targetProducts = db.collection('products');
    for (const sourceName of productSources) {
      const source = db.collection(sourceName);
      const docs = await source.find({}).toArray();
      for (const doc of docs) {
        const normalized = normalizeLegacyProduct(doc);
        if (!normalized.name && !normalized.size && !normalized.id) continue;

        const existing = await targetProducts.findOne({
          $or: [
            { id: normalized.id },
            { name: normalized.name, size: normalized.size, network: normalized.network },
          ],
        });

        if (!existing) {
          await targetProducts.insertOne(normalized);
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

        await targetProducts.updateOne({ _id: existing._id }, { $set: merged });
      }
    }
  }
}

async function startMongo() {
  if (!mongoUri) {
    console.warn('⚠️  MONGO_URI is not set. MongoDB is disabled for now.');
    return;
  }

  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db(mongoDbName);
    await ensureSeedData();
    console.log(`✅ MongoDB connected to database: ${mongoDbName}`);
  } catch (error) {
    console.error('❌ Mongo connection failed:', error.message);
  }
}

async function ensureSeedData() {
  if (!db) return;

  const requiredCollections = [
    'users',
    'orders',
    'refunds',
    'deposits',
    'notifications',
    'api-keys',
    'products',
    'packages',
    'network_settings',
    'api_config',
  ];

  for (const collectionName of requiredCollections) {
    const exists = await collectionExists(collectionName);
    if (!exists) {
      await db.createCollection(collectionName);
      console.log(`✅ created collection: ${collectionName}`);
    }
  }

  // TODO: Enable merge after network connectivity is restored
  // await mergeLegacyCollections();

  const seeds = [
    ['network_settings', DEFAULT_NETWORK_SETTINGS],
    ['api_config', [DEFAULT_API_CONFIG]],
  ];

  for (const [collectionName, items] of seeds) {
    const collection = db.collection(collectionName);
    if (!Array.isArray(items) || items.length === 0) continue;

    for (const item of items) {
      const filter = item.id ? { id: item.id } : { name: item.name, size: item.size, network: item.network };
      await collection.updateOne(
        filter,
        { $set: { ...item, createdAt: item.createdAt || new Date().toISOString() } },
        { upsert: true }
      );
    }

    const total = await collection.countDocuments();
    console.log(`✅ ${collectionName}: ensured ${total} document(s) in MongoDB`);
  }

  const adminUser = await db.collection('users').findOne({ role: 'admin' });
  if (!adminUser) {
    await db.collection('users').insertOne({
      id: 'admin_default',
      fullName: 'Admin User',
      email: 'admin@allendatahub.local',
      username: '@Admin001',
      phone: '0000000000',
      whatsapp: '',
      momo: '',
      password: hashPassword('Password100'),
      role: 'admin',
      network: 'MTN',
      status: 'approved',
      emailVerified: true,
      phoneVerified: true,
      walletBalance: 0,
      commissionEarned: 0,
      referralCode: 'ADMIN001',
      totalReferrals: 0,
      initials: 'AU',
      createdAt: new Date().toISOString(),
    });
    console.log('✅ default admin account seeded: @Admin001 / Password100');
  }
}

async function getUserById(userId) {
  if (!db || !userId) return null;
  return db.collection('users').findOne({ id: userId });
}

function getPaystackReferenceForUser(userId) {
  return `ALLEN_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function getPaystackEmailForUser(user) {
  if (user?.email && String(user.email).trim()) return String(user.email).trim();
  const identifier = user?.id || user?.phone || 'user';
  const safeIdentifier = String(identifier).replace(/[^a-zA-Z0-9._@-]/g, '').slice(0, 40) || 'user';
  return `${safeIdentifier}@allendatahub.com`;
}

function toMainCurrencyFromPesewas(value) {
  const amount = Number(value || 0);
  return Number((amount / 100).toFixed(2));
}

function getApiPriceForProduct(user, product, config = DEFAULT_API_CONFIG) {
  const overrides = user?.apiPricing && typeof user.apiPricing === 'object' ? user.apiPricing : {};
  const override = Number(overrides[product.id]);
  if (Number.isFinite(override) && override >= 0) return Number(override.toFixed(2));

  const isAgent = String(user?.role || '').trim().toLowerCase() === 'agent';
  const selectedPrice = Number(isAgent ? product?.agentPrice : product?.userPrice);
  if (Number.isFinite(selectedPrice) && selectedPrice >= 0) return Number(selectedPrice.toFixed(2));

  return Number(product?.price ?? 0);
}

async function creditWalletForPaystackSuccess({ userId, amount, reference, source = 'paystack', metadata = {} }) {
  if (!db || !userId) {
    return { ok: false, error: 'Missing userId for wallet credit.' };
  }

  const user = await getUserById(String(userId));
  if (!user) {
    return { ok: false, error: `User ${userId} not found.` };
  }

  const existing = await db.collection('deposits').findOne({ reference });
  if (existing?.status === 'Credited') {
    return {
      ok: true,
      alreadyProcessed: true,
      reference,
      userId,
      balBefore: Number(existing.balBefore ?? user.walletBalance ?? 0),
      balAfter: Number(existing.balAfter ?? user.walletBalance ?? 0),
      creditAmount: Number(existing.amount || 0),
    };
  }

  const amountValue = Number(amount || 0);
  const balBefore = Number(user.walletBalance || 0);
  const balAfter = Number((balBefore + amountValue).toFixed(2));

  await db.collection('users').updateOne({ id: user.id }, { $set: { walletBalance: balAfter } });

  const depositRecord = {
    id: makeId('dep'),
    userId: user.id,
    amount: amountValue,
    fee: 0,
    totalPay: amountValue,
    method: 'card',
    platform: 'paystack',
    reference,
    status: 'Credited',
    balBefore,
    balAfter,
    handledBy: source,
    metadata: {
      project: 'NEW_APP',
      userId: user.id,
      ...metadata,
    },
    source,
    date: new Date().toISOString(),
    creditedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  if (existing) {
    await db.collection('deposits').updateOne({ reference }, { $set: depositRecord });
  } else {
    await db.collection('deposits').insertOne(depositRecord);
  }

  await createNotification(user.id, 'Wallet credited', `GHS ${amountValue.toFixed(2)} added to your wallet.`, 'deposit');

  return {
    ok: true,
    alreadyProcessed: false,
    reference,
    userId,
    balBefore,
    balAfter,
    creditAmount: amountValue,
    deposit: depositRecord,
  };
}

async function requireUser(req, res, next) {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ ok: false, error: 'Authentication required.' });

  const user = await getUserById(String(userId));
  if (!user) return res.status(401).json({ ok: false, error: 'Invalid session.' });

  req.user = user;
  next();
}

async function requireAdmin(req, res, next) {
  await requireUser(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required.' });
    }
    next();
  });
}

async function requireApiKey(req, res, next) {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });
  const authorization = String(req.headers.authorization || '');
  const apiKey = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : String(req.headers['x-api-key'] || '').trim();
  if (!apiKey) return res.status(401).json({ ok: false, error: 'Bearer API key is required.' });

  const config = await db.collection('api_config').findOne({}) || DEFAULT_API_CONFIG;
  if (!config.enabled) return res.status(403).json({ ok: false, error: 'API access is currently disabled.' });

  const key = await db.collection('api-keys').findOne({ key: apiKey, status: 'Active' });
  if (!key) return res.status(401).json({ ok: false, error: 'Invalid or revoked API key.' });
  const user = await getUserById(key.userId);
  if (!user) return res.status(401).json({ ok: false, error: 'API account was not found.' });

  await db.collection('api-keys').updateOne(
    { id: key.id },
    { $set: { lastUsed: new Date().toISOString() } }
  );
  req.user = user;
  req.apiKey = key;
  req.apiConfig = config;
  next();
}

async function createNotification(userId, title, message, type = 'info') {
  if (!db) return;
  await db.collection('notifications').insertOne({
    id: makeId('ntf'),
    userId,
    title,
    message,
    type,
    read: false,
    time: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
}

async function applyReferralCommission(referredByCode, orderAmount) {
  if (!db || !referredByCode) return;
  const referrer = await db.collection('users').findOne({
    referralCode: { $regex: `^${String(referredByCode).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });
  if (!referrer) return;

  const commission = Number((orderAmount * REFERRAL_COMMISSION_RATE).toFixed(2));
  await db.collection('users').updateOne(
    { id: referrer.id },
    { $inc: { commissionEarned: commission } }
  );
  await createNotification(
    referrer.id,
    'Referral commission',
    `You earned GHS ${commission.toFixed(2)} from a referred purchase.`,
    'commission'
  );
}

async function isNetworkEnabled(network) {
  if (!db) return true;
  const setting = await db.collection('network_settings').findOne({ network });
  return setting ? setting.enabled !== false : true;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password: _password, ...safe } = user;
  return safe;
}

app.get('/api/health', async (_req, res) => {
  if (!db) return res.status(503).json({ ok: false, message: 'MongoDB not connected' });
  try {
    const ping = await db.command({ ping: 1 });
    res.json({ ok: true, ping, database: mongoDbName });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/diagnostic', async (_req, res) => {
  if (!db) return res.status(503).json({ ok: false, message: 'MongoDB not connected' });
  try {
    const collections = await db.listCollections().toArray();
    const stats = {};
    for (const collection of collections) {
      const col = db.collection(collection.name);
      stats[collection.name] = { count: await col.countDocuments() };
    }
    res.json({ ok: true, database: mongoDbName, collections: stats });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// ─── Auth ───────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });

  const identifier = String(req.body?.identifier ?? req.body?.email ?? req.body?.username ?? '').trim();
  const password = req.body?.password;
  if (!identifier || !password) {
    return res.status(400).json({ ok: false, error: 'Email/username and password are required.' });
  }

  const user = await db.collection('users').findOne({
    $or: [
      { email: { $regex: `^${String(identifier).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      { username: { $regex: `^${String(identifier).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
    ],
  });

  if (!user) return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
  const validPassword = comparePassword(password, user.password);
  if (!validPassword) return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
  if (!user.emailVerified) {
    return res.status(403).json({ ok: false, error: 'Please verify your email before logging in.' });
  }

  if (user.password && !isBcryptHash(String(user.password))) {
    await db.collection('users').updateOne({ id: user.id }, { $set: { password: hashPassword(String(password)) } });
  }

  return res.json({ ok: true, user: sanitizeUser(user) });
});

app.post('/api/auth/register', async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });

  const payload = req.body || {};
  const fullName = payload.fullName?.trim();
  const email = payload.email?.trim();
  const username = payload.username?.trim() || `@${(fullName || '').replace(/\s+/g, '').slice(0, 8) || 'user'}`;
  const phone = payload.phone?.trim();
  const password = payload.password;
  const role = payload.role === 'agent' ? 'agent' : 'user';

  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ ok: false, error: 'Please complete all required fields.' });
  }

  const existing = await db.collection('users').findOne({
    $or: [
      { email: { $regex: `^${String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      { username: { $regex: `^${String(username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
    ],
  });
  if (existing) {
    return res.status(409).json({ ok: false, error: 'An account with this email or username already exists.' });
  }

  const nextReferral = `${fullName.split(' ').map((p) => p[0]).join('').slice(0, 4).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

  let referredBy = payload.referredBy?.trim() || undefined;
  if (referredBy) {
    const referrer = await db.collection('users').findOne({
      referralCode: { $regex: `^${String(referredBy).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (referrer) {
      referredBy = referrer.referralCode;
      await db.collection('users').updateOne({ id: referrer.id }, { $inc: { totalReferrals: 1 } });
      await createNotification(referrer.id, 'New referral', `${fullName} signed up using your referral code.`, 'referral');
    } else {
      referredBy = undefined;
    }
  }

  const newUser = {
    id: makeId('usr'),
    fullName,
    email,
    username,
    phone,
    whatsapp: payload.whatsapp || '',
    momo: payload.momo || '',
    password: hashPassword(String(password)),
    role,
    network: 'MTN',
    status: 'approved',
    emailVerified: true,
    phoneVerified: false,
    walletBalance: 0,
    commissionEarned: 0,
    referralCode: nextReferral,
    totalReferrals: 0,
    initials: fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    referredBy,
    createdAt: new Date().toISOString(),
  };

  await db.collection('users').insertOne(newUser);

  return res.status(201).json({
    ok: true,
    user: sanitizeUser(newUser),
  });
});

app.post('/api/auth/verify-email', async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ ok: false, error: 'Verification token is missing.' });

  const result = await db.collection('users').findOneAndUpdate(
    { emailVerificationToken: token },
    { $set: { emailVerified: true }, $unset: { emailVerificationToken: '' } },
    { returnDocument: 'after' }
  );

  const updatedUser = result && result.value ? result.value : null;
  if (!updatedUser) return res.status(404).json({ ok: false, error: 'Unable to verify this email link.' });
  return res.json({ ok: true, user: sanitizeUser(updatedUser) });
});

// ─── Users ──────────────────────────────────────────────────────────────────

app.get('/api/users/me', requireUser, async (req, res) => {
  res.json({ ok: true, user: sanitizeUser(req.user) });
});

app.put('/api/users/:id', requireUser, async (req, res) => {
  const { id } = req.params;
  if (req.user.id !== id && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Not allowed.' });
  }

  const allowed = ['fullName', 'email', 'phone', 'whatsapp', 'momo', 'initials', 'network', 'walletBalance', 'commissionEarned'];
  const patch = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  }

  const result = await db.collection('users').findOneAndUpdate(
    { id },
    { $set: patch },
    { returnDocument: 'after' }
  );

  if (!result.value) return res.status(404).json({ ok: false, error: 'User not found.' });
  return res.json({ ok: true, user: sanitizeUser(result.value) });
});

app.get('/api/users', requireAdmin, async (_req, res) => {
  const users = await db.collection('users').find({}).toArray();
  res.json({ ok: true, users: users.map(sanitizeUser) });
});

app.get('/api/referrals', requireUser, async (req, res) => {
  const referred = await db.collection('users').find({ referredBy: req.user.referralCode }).toArray();
  res.json({ ok: true, referrals: referred.map(sanitizeUser) });
});

// ─── Packages & Network Settings ────────────────────────────────────────────

app.get('/api/products', async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });
  const products = await db.collection('products').find({ enabled: { $ne: false } }).toArray();
  const userId = String(req.headers['x-user-id'] || '');
  const account = userId ? await getUserById(userId) : null;
  res.json({
    ok: true,
    products: products.map((product) => ({
      ...product,
      userPrice: Number(product.userPrice ?? product.price ?? 0),
      agentPrice: Number(product.agentPrice ?? product.price ?? 0),
      accountPrice: account ? getApiPriceForProduct(account, product) : null,
      price: account ? getApiPriceForProduct(account, product) : Number(product.userPrice ?? product.price ?? 0),
    })),
  });
});

app.get('/api/network-settings', async (_req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });
  const settings = await db.collection('network_settings').find({}).toArray();
  const merged = DEFAULT_NETWORK_SETTINGS.map((defaultSetting) => {
    const saved = settings.find((entry) => entry.network === defaultSetting.network);
    return saved ? { ...defaultSetting, ...saved } : defaultSetting;
  });
  res.json({ ok: true, settings: merged });
});

app.put('/api/admin/network-settings/:network', requireAdmin, async (req, res) => {
  const { network } = req.params;
  const { enabled } = req.body || {};
  const normalized = String(network || '').trim();
  if (!normalized) return res.status(400).json({ ok: false, error: 'Network is required.' });

  const defaultSettings = DEFAULT_NETWORK_SETTINGS.map((item) => ({ ...item, enabled: item.enabled !== false }));
  const nextValue = { network: normalized, enabled: !!enabled };
  const result = await db.collection('network_settings').findOneAndUpdate(
    { network: normalized },
    { $set: nextValue },
    { upsert: true, returnDocument: 'after' }
  );

  for (const fallback of defaultSettings.filter((item) => item.network !== normalized)) {
    await db.collection('network_settings').updateOne(
      { network: fallback.network },
      { $setOnInsert: fallback },
      { upsert: true }
    );
  }

  res.json({ ok: true, setting: result.value || nextValue });
});

app.post('/api/admin/packages', requireAdmin, async (req, res) => {
  const { network, label, size, userPrice, agentPrice, validity } = req.body || {};
  if (!network || !label) {
    return res.status(400).json({ ok: false, error: 'Network and package label are required.' });
  }

  const doc = {
    id: makeId(String(network).toLowerCase().slice(0, 2)),
    name: `${label} Bundle`,
    size: size || label,
    price: Number(userPrice || 0),
    userPrice: Number(userPrice || 0),
    agentPrice: Number(agentPrice || 0),
    validity: validity || '30 Days',
    network,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  await db.collection('products').insertOne(doc);
  res.status(201).json({ ok: true, package: doc });
});

// ─── Orders ─────────────────────────────────────────────────────────────────

app.get('/api/orders', requireUser, async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
  const orders = await db.collection('orders').find(filter).sort({ date: -1, createdAt: -1 }).toArray();
  if (req.user.role === 'admin') {
    const users = await db.collection('users').find({}, { projection: { id: 1, username: 1, fullName: 1, email: 1 } }).toArray();
    const usersById = new Map(users.map((entry) => [entry.id, entry]));
    return res.json({
      ok: true,
      orders: orders.map((order) => {
        const owner = usersById.get(order.userId);
        return {
          ...order,
          username: owner?.username || owner?.fullName || owner?.email || order.userId,
          createdAt: order.createdAt || order.date,
        };
      }),
    });
  }
  res.json({ ok: true, orders });
});

// ─── Public dealer API ─────────────────────────────────────────────────────

app.get('/api/v1/wallet', requireApiKey, async (req, res) => {
  const deposits = await db.collection('deposits')
    .find({ userId: req.user.id })
    .sort({ date: -1 })
    .limit(10)
    .toArray();
  res.json({
    ok: true,
    walletBalance: Number(req.user.walletBalance || 0),
    recentDeposits: deposits,
  });
});

app.get('/api/v1/packages', requireApiKey, async (req, res) => {
  const filter = { enabled: { $ne: false }, ...(req.query.network ? { network: String(req.query.network) } : {}) };
  const products = await db.collection('products')
    .find(filter)
    .sort({ network: 1, size: 1 })
    .toArray();
  res.json({
    ok: true,
    packages: products.map((product) => ({
      id: product.id,
      name: product.name,
      network: product.network,
      size: product.size,
      validity: product.validity,
      price: getApiPriceForProduct(req.user, product, req.apiConfig),
      basePrice: Number(product[req.user.role === 'agent' ? 'agentPrice' : 'userPrice'] ?? product.price ?? 0),
    })),
  });
});

app.post('/api/v1/orders', requireApiKey, async (req, res) => {
  const { network, size, recipient, packageName } = req.body || {};
  if (!network || !size || !recipient) {
    return res.status(422).json({ ok: false, error: 'network, size, and recipient are required.' });
  }

  const product = await db.collection('products').findOne({
    network: String(network),
    size: String(size).trim(),
    enabled: { $ne: false },
  });
  if (!product) return res.status(404).json({ ok: false, error: 'Package not found.' });

  const orderPrice = getApiPriceForProduct(req.user, product, req.apiConfig);
  const apiRequest = {
    ...req,
    body: {
      ...req.body,
      amount: orderPrice,
      packageName: packageName || product.name,
      source: 'api',
    },
  };
  return createSingleOrder(apiRequest, res);
});

app.get('/api/v1/orders/:id', requireApiKey, async (req, res) => {
  const order = await db.collection('orders').findOne({ id: req.params.id, userId: req.user.id, source: 'api' });
  if (!order) return res.status(404).json({ ok: false, error: 'API order not found.' });
  res.json({ ok: true, order });
});

async function createSingleOrder(req, res) {
  const { recipient, size, amount, network, packageName, source = 'web' } = req.body || {};
  const orderAmount = Number(amount || 0);

  if (!recipient || !network || orderAmount <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid order details.' });
  }

  if (!(await isNetworkEnabled(network))) {
    return res.status(403).json({ ok: false, error: `${network} is currently disabled.` });
  }

  const productExists = await db.collection('products').findOne({
    network,
    size: String(size || '').trim(),
    enabled: { $ne: false },
  });

  if (!productExists) {
    return res.status(404).json({ ok: false, error: 'Product not found for this network.' });
  }

  const user = await getUserById(req.user.id);
  const accountPrice = getApiPriceForProduct(user, productExists);
  const chargedAmount = user.apiPricing?.[productExists.id] !== undefined
    ? accountPrice
    : orderAmount;

  const balBefore = Number(user.walletBalance || 0);

  if (balBefore < chargedAmount) {
    return res.status(400).json({ ok: false, error: 'Insufficient wallet balance.' });
  }

  const balAfter = Number((balBefore - chargedAmount).toFixed(2));
  const orderId = makeId('ord');
  const vendorReference = `${network}-${orderId}`;

  await db.collection('users').updateOne({ id: user.id }, { $set: { walletBalance: balAfter } });

  const order = {
    id: orderId,
    size: size || '',
    recipient,
    network,
    status: 'Pending',
    source: source === 'api' ? 'api' : 'web',
    paid: true,
    amount: chargedAmount,
    balBefore,
    balAfter,
    date: new Date().toISOString(),
    userId: user.id,
    packageName: packageName || '',
    reference: vendorReference,
    createdAt: new Date().toISOString(),
  };

  await db.collection('orders').insertOne(order);

  const portalResult = await purchaseWithPortal02({
    phone: recipient,
    size,
    network,
    reference: vendorReference,
    webhookUrl: `${PORTAL02_BACKEND_URL.replace(/\/$/, '')}/api/webhooks/portal02`,
  });

  if (!portalResult.success) {
    await db.collection('orders').updateOne({ id: orderId }, { $set: { status: 'Failed', portalError: portalResult.error, vendorStatus: 'failed', updatedAt: new Date().toISOString() } });
    return res.status(502).json({ ok: false, error: portalResult.error, portalResult });
  }

  await db.collection('orders').updateOne(
    { id: orderId },
    {
      $set: {
        portalOrderId: portalResult.transactionId,
        portalReference: portalResult.reference,
        portalStatus: portalResult.status,
        portalResponse: portalResult.raw,
        status: 'Pending',
        updatedAt: new Date().toISOString(),
      },
    }
  );

  await createNotification(user.id, 'Order placed', `${size} for ${recipient} on ${network}.`, 'order');

  if (user.referredBy) {
    await applyReferralCommission(user.referredBy, chargedAmount);
  }

  return res.status(201).json({ ok: true, order: { ...order, portalOrderId: portalResult.transactionId, portalStatus: portalResult.status }, walletBalance: balAfter, portalResult });
}

app.post('/api/orders', requireUser, async (req, res) => {
  return createSingleOrder(req, res);
});

app.post('/api/orders/place', requireUser, async (req, res) => {
  return createSingleOrder(req, res);
});

app.post('/api/cart/checkout', requireUser, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ ok: false, error: 'Cart is empty.' });
  }

  const total = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const user = await getUserById(req.user.id);
  const balBefore = Number(user.walletBalance || 0);

  if (balBefore < total) {
    return res.status(400).json({ ok: false, error: 'Insufficient wallet balance.' });
  }

  for (const item of items) {
    if (!(await isNetworkEnabled(item.network))) {
      return res.status(403).json({ ok: false, error: `${item.network} is currently disabled.` });
    }
  }

  let runningBalance = balBefore;
  const orders = [];

  for (const item of items) {
    const orderAmount = Number(item.price || 0);
    const balAfter = Number((runningBalance - orderAmount).toFixed(2));
    const order = {
      id: makeId('ord'),
      size: item.size || '',
      recipient: item.recipient || '',
      network: item.network || 'MTN',
      status: 'Pending',
      source: 'web',
      paid: true,
      amount: orderAmount,
      balBefore: runningBalance,
      balAfter,
      date: new Date().toISOString(),
      userId: user.id,
      packageName: item.packageName || '',
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    runningBalance = balAfter;
  }

  await db.collection('orders').insertMany(orders);
  await db.collection('users').updateOne({ id: user.id }, { $set: { walletBalance: runningBalance } });
  await createNotification(user.id, 'Cart checkout', `${orders.length} order(s) placed from cart.`, 'order');

  if (user.referredBy) {
    await applyReferralCommission(user.referredBy, total);
  }

  res.status(201).json({ ok: true, orders, walletBalance: runningBalance });
});

app.post('/api/orders/:id/cancel', requireUser, async (req, res) => {
  const { id } = req.params;
  const order = await db.collection('orders').findOne({ id });
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found.' });
  if (order.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Not allowed.' });
  }

  const normalizedStatus = String(order.status || '').toLowerCase();
  if (normalizedStatus === 'refunded' || normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
    return res.status(400).json({ ok: false, error: 'Order already cancelled.' });
  }

  const user = await getUserById(order.userId);
  const refundAmount = Number(order.amount || 0);
  const balBefore = Number(user?.walletBalance || 0);
  const balAfter = Number((balBefore + refundAmount).toFixed(2));

  const portalCancelResult = await cancelPortal02Order({
    network: order.network,
    orderId: order.portalOrderId || order.reference || order.id,
    reference: order.portalReference || order.reference || order.id,
  });

  if (!portalCancelResult.success) {
    console.error(JSON.stringify({
      tag: 'ALLENDAHUB_CANCEL_BLOCKED',
      orderId: id,
      portalOrderId: order.portalOrderId || null,
      portalReference: order.portalReference || order.reference || null,
      reason: portalCancelResult.error,
    }));
    return res.status(502).json({
      ok: false,
      error: 'Unable to cancel this order right now. Please try again.',
      portalCancelResult,
    });
  }

  await db.collection('users').updateOne({ id: user.id }, { $set: { walletBalance: balAfter } });
  await db.collection('orders').updateOne({ id }, {
    $set: {
      status: 'Cancelled',
      balAfter,
      portalCancelStatus: 'cancelled',
      portalCancelResponse: portalCancelResult,
      portalCancelError: null,
      updatedAt: new Date().toISOString(),
    },
  });

  const refund = {
    id: makeId('rfnd'),
    orderId: id,
    userId: user.id,
    recipient: order.recipient,
    bundle: order.size,
    amount: refundAmount,
    method: 'wallet',
    status: 'Refunded',
    balBefore,
    balAfter,
    source: order.source || 'web',
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await db.collection('refunds').insertOne(refund);
  await createNotification(user.id, 'Order refunded', `GHS ${refundAmount.toFixed(2)} returned to your wallet for order ${id}.`, 'refund');

  res.json({
    ok: true,
    refund,
    walletBalance: balAfter,
    orderStatus: 'Cancelled',
    portalCancelResult,
  });
});

app.post('/api/orders/:id/refund', requireUser, async (req, res) => {
  const { id } = req.params;
  const order = await db.collection('orders').findOne({ id });
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found.' });
  if (order.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Not allowed.' });
  }

  const normalizedStatus = String(order.status || '').toLowerCase();
  if (normalizedStatus === 'refunded' || normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
    return res.status(400).json({ ok: false, error: 'Order already refunded.' });
  }

  const user = await getUserById(order.userId);
  const refundAmount = Number(order.amount || 0);
  const balBefore = Number(user?.walletBalance || 0);
  const balAfter = Number((balBefore + refundAmount).toFixed(2));

  await db.collection('users').updateOne({ id: user.id }, { $set: { walletBalance: balAfter } });
  await db.collection('orders').updateOne({ id }, { $set: { status: 'Refunded', balAfter } });

  const refund = {
    id: makeId('rfnd'),
    orderId: id,
    userId: user.id,
    recipient: order.recipient,
    bundle: order.size,
    amount: refundAmount,
    method: 'wallet',
    status: 'Refunded',
    balBefore,
    balAfter,
    source: order.source || 'web',
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await db.collection('refunds').insertOne(refund);
  await createNotification(user.id, 'Order refunded', `GHS ${refundAmount.toFixed(2)} returned to your wallet for order ${id}.`, 'refund');

  res.json({ ok: true, refund, walletBalance: balAfter, orderStatus: 'Refunded' });
});

// ─── Deposits ───────────────────────────────────────────────────────────────

app.get('/api/deposits', requireUser, async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
  const deposits = await db.collection('deposits').find(filter).sort({ date: -1 }).toArray();
  res.json({ ok: true, deposits });
});

async function initializePaystackPayment(req, res) {
  const amount = Number(req.body?.amount || 0);
  if (!req.user && !req.body?.userId) {
    return res.status(401).json({ ok: false, error: 'Authentication required.' });
  }
  if (amount < 5) {
    return res.status(400).json({ ok: false, error: 'Minimum top-up is GHS 5.' });
  }

  const user = req.user || (await getUserById(String(req.body?.userId)));
  if (!user) {
    return res.status(404).json({ ok: false, error: 'User not found.' });
  }

  const fee = Number((amount * 0.04).toFixed(2));
  const totalPay = Number((amount + fee).toFixed(2));
  const reference = getPaystackReferenceForUser(user.id);
  const balBefore = Number(user.walletBalance || 0);
  const email = getPaystackEmailForUser(user);
  const callbackUrl = String(req.body?.callbackUrl || PAYSTACK_CALLBACK_URL || 'https://allendatahub.com/payment-return');

  await db.collection('deposits').updateOne(
    { reference },
    {
      $setOnInsert: {
        id: makeId('dep'),
        userId: user.id,
        amount,
        fee,
        totalPay,
        method: 'card',
        platform: 'paystack',
        reference,
        status: 'Pending',
        balBefore,
        balAfter: balBefore,
        handledBy: user.fullName || user.username || 'system',
        metadata: { project: 'ALLENDATAHUB', userId: user.id },
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  if (!PAYSTACK_SECRET) {
    return res.json({
      ok: true,
      demo: true,
      reference,
      amount: totalPay,
      email,
      callbackUrl: `${callbackUrl}?reference=${encodeURIComponent(reference)}&amount=${encodeURIComponent(String(amount))}`,
      message: 'Paystack key not configured. Use the demo completion endpoint.',
    });
  }

  try {
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(totalPay * 100),
        reference,
        callback_url: callbackUrl,
        metadata: {
          project: 'ALLENDATAHUB',
          userId: user.id,
          creditAmount: amount,
          source: 'ALLENDATAHUB',
        },
      }),
    });

    const data = await paystackRes.json();
    if (!data.status) {
      return res.status(400).json({ ok: false, error: data.message || 'Paystack initialization failed.' });
    }

    await db.collection('deposits').updateOne(
      { reference },
      { $set: { authorizationUrl: data.data.authorization_url, initializedAt: new Date().toISOString() } }
    );

    return res.json({
      ok: true,
      authorizationUrl: data.data.authorization_url,
      reference,
      email,
      callbackUrl,
      source: 'paystack',
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Paystack initialization failed.' });
  }
}

app.post('/api/payments/initialize', requireUser, async (req, res) => {
  return initializePaystackPayment(req, res);
});

app.post('/api/payments/paystack/initialize', requireUser, async (req, res) => {
  return initializePaystackPayment(req, res);
});

app.post('/api/webhooks/paystack', async (req, res) => {
  const signature = String(req.headers['x-paystack-signature'] || '');
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expectedSignature = crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');
  const signatureValid = Boolean(signature) && signature.length === expectedSignature.length && crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  const event = String(req.body?.event || 'unknown');
  const reference = String(req.body?.data?.reference || '');

  console.log(JSON.stringify({
    tag: 'PAYSTACK_WEBHOOK_RECEIVED',
    event,
    reference,
    signatureValid,
    receivedAt: new Date().toISOString(),
  }));

  if (!signatureValid) {
    console.error(JSON.stringify({
      tag: 'PAYSTACK_WEBHOOK_REJECTED',
      reason: 'invalid_signature',
      event,
      reference,
    }));
    return res.status(401).json({ ok: false, error: 'Invalid webhook signature.' });
  }

  if (event !== 'charge.success') {
    console.log(JSON.stringify({ tag: 'PAYSTACK_WEBHOOK_IGNORED', event, reference }));
    return res.json({ ok: true, ignored: true });
  }

  const payment = req.body?.data || {};
  const metadata = payment.metadata || {};
  const deposit = reference ? await db?.collection('deposits').findOne({ reference }) : null;
  const userId = String(metadata.userId || deposit?.userId || '');
  const creditAmount = Number(deposit?.amount || metadata.creditAmount || toMainCurrencyFromPesewas(payment.amount));

  if (!reference || !userId || creditAmount <= 0) {
    console.error(JSON.stringify({
      tag: 'PAYSTACK_WEBHOOK_FORWARD_FAILED',
      reason: 'missing_reference_user_or_amount',
      event,
      reference,
      userId,
      creditAmount,
    }));
    return res.status(400).json({ ok: false, error: 'Missing payment reference, user, or amount.' });
  }

  try {
    const result = await creditWalletForPaystackSuccess({
      userId,
      amount: creditAmount,
      reference,
      source: 'paystack_webhook',
      metadata: {
        project: 'ALLENDATAHUB',
        event,
        amountPesewas: Number(payment.amount || 0),
        webhookForwarded: true,
      },
    });

    if (!result.ok) {
      console.error(JSON.stringify({
        tag: 'PAYSTACK_WEBHOOK_FORWARD_FAILED',
        reason: result.error,
        event,
        reference,
        userId,
      }));
      return res.status(400).json({ ok: false, error: result.error });
    }

    console.log(JSON.stringify({
      tag: 'PAYSTACK_WEBHOOK_FORWARDED',
      event,
      reference,
      userId,
      amount: creditAmount,
      alreadyProcessed: Boolean(result.alreadyProcessed),
      balanceAfter: result.balAfter,
    }));
    return res.json({ ok: true, forwarded: true, alreadyProcessed: Boolean(result.alreadyProcessed) });
  } catch (error) {
    console.error(JSON.stringify({
      tag: 'PAYSTACK_WEBHOOK_FORWARD_FAILED',
      reason: error instanceof Error ? error.message : 'Unknown webhook processing error',
      event,
      reference,
      userId,
    }));
    return res.status(500).json({ ok: false, error: 'Webhook processing failed.' });
  }
});

app.post('/api/internal/paystack-success', async (req, res) => {
  const bridgePayload = req.body || {};
  console.log(JSON.stringify({
    tag: 'CLOUDNUM_FORWARD_ATTEMPT',
    reference: String(bridgePayload?.data?.reference || bridgePayload?.reference || ''),
    receivedAt: new Date().toISOString(),
  }));

  const providedSecret = req.headers['x-internal-secret'];
  if (!providedSecret || String(providedSecret) !== String(INTERNAL_BRIDGE_SECRET || '')) {
    console.error(JSON.stringify({
      tag: 'CLOUDNUM_FORWARD_REJECTED',
      reason: 'invalid_or_missing_internal_secret',
    }));
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const payload = bridgePayload;
  const eventData = payload.data || payload;
  const userId = String(eventData?.metadata?.userId || payload?.metadata?.userId || payload?.userId || '');
  const reference = String(eventData?.reference || payload?.reference || '');
  const amountPesewas = Number(eventData?.amount || payload?.amount || 0);
  const amount = Number((toMainCurrencyFromPesewas(amountPesewas)).toFixed(2));

  if (!reference || !userId) {
    return res.status(400).json({ ok: false, error: 'Missing payment reference or metadata.userId.' });
  }

  const result = await creditWalletForPaystackSuccess({
    userId,
    amount,
    reference,
    source: 'internal_bridge',
    metadata: {
      project: 'ALLENDATAHUB',
      forwardedFrom: 'cloudnum',
      verifiedFrom: 'internal_bridge',
      amountPesewas,
    },
  });

  if (!result.ok) {
    console.error(JSON.stringify({
      tag: 'CLOUDNUM_FORWARD_FAILED',
      reference,
      userId,
      reason: result.error,
    }));
    return res.status(400).json({ ok: false, error: result.error });
  }

  console.log(JSON.stringify({
    tag: 'CLOUDNUM_FORWARD_RECEIVED',
    reference,
    userId,
    amount,
    alreadyProcessed: Boolean(result.alreadyProcessed),
  }));

  return res.json({
    ok: true,
    alreadyProcessed: !!result.alreadyProcessed,
    userId,
    reference,
    amount,
    balanceAfter: result.balAfter,
  });
});

app.post('/api/payments/paystack/verify', requireUser, async (req, res) => {
  const { reference } = req.body || {};
  if (!reference) return res.status(400).json({ ok: false, error: 'Reference is required.' });

  const deposit = await db.collection('deposits').findOne({ reference, userId: req.user.id });
  if (!deposit) return res.status(404).json({ ok: false, error: 'Deposit not found.' });
  if (deposit.status === 'Credited') {
    const user = await getUserById(req.user.id);
    return res.json({ ok: true, alreadyCredited: true, balBefore: deposit.balBefore, balAfter: user.walletBalance, deposit });
  }

  let verified = false;
  if (PAYSTACK_SECRET) {
    try {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const data = await verifyRes.json();
      verified = data.status && data.data?.status === 'success';
    } catch {
      verified = false;
    }
  } else {
    verified = true;
  }

  if (!verified) {
    return res.status(202).json({ ok: true, pending: true, reference, deposit });
  }

  const result = await creditWalletForPaystackSuccess({
    userId: req.user.id,
    amount: Number(deposit.amount || 0),
    reference,
    source: 'paystack_verify',
    metadata: { verifiedFrom: 'paystack_api' },
  });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// ─── Refunds & Notifications ────────────────────────────────────────────────

app.get('/api/refunds', requireUser, async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
  const refunds = await db.collection('refunds').find(filter).sort({ date: -1 }).toArray();
  res.json({ ok: true, refunds });
});

app.get('/api/notifications', requireUser, async (req, res) => {
  const notifications = await db.collection('notifications')
    .find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .toArray();
  res.json({ ok: true, notifications });
});

app.post('/api/notifications/read', requireUser, async (req, res) => {
  await db.collection('notifications').updateMany(
    { userId: req.user.id, read: false },
    { $set: { read: true, readAt: new Date().toISOString() } }
  );
  res.json({ ok: true });
});

// ─── API Keys ───────────────────────────────────────────────────────────────

app.get('/api/api-keys', requireUser, async (req, res) => {
  const keys = await db.collection('api-keys').find({ userId: req.user.id }).sort({ createdAt: -1 }).toArray();
  res.json({ ok: true, keys: keys.map((k) => ({ ...k, key: undefined, keyPreview: k.keyPreview || '••••••••' })) });
});

app.post('/api/api-keys', requireUser, async (req, res) => {
  const config = await db.collection('api_config').findOne({}) || DEFAULT_API_CONFIG;
  if (!config.enabled) {
    return res.status(403).json({ ok: false, error: 'API access is currently disabled.' });
  }

  const name = req.body?.name?.trim() || `Key ${Date.now()}`;
  const rawKey = `up_live_${crypto.randomBytes(16).toString('hex')}`;
  const doc = {
    id: makeId('key'),
    userId: req.user.id,
    name,
    key: rawKey,
    keyPreview: `${rawKey.slice(0, 10)}••••••••${rawKey.slice(-4)}`,
    status: 'Active',
    createdAt: new Date().toISOString(),
    lastUsed: null,
  };

  await db.collection('api-keys').insertOne(doc);
  res.status(201).json({ ok: true, key: doc });
});

app.post('/api/api-keys/:id/revoke', requireUser, async (req, res) => {
  const result = await db.collection('api-keys').findOneAndUpdate(
    { id: req.params.id, userId: req.user.id },
    { $set: { status: 'Revoked' } },
    { returnDocument: 'after' }
  );
  if (!result.value) return res.status(404).json({ ok: false, error: 'Key not found.' });
  res.json({ ok: true, key: result.value });
});

app.get('/api/admin/api-users', requireAdmin, async (_req, res) => {
  const keys = await db.collection('api-keys').find({}).sort({ createdAt: -1 }).toArray();
  const userIds = [...new Set(keys.map((k) => k.userId))];
  const users = await db.collection('users').find({ id: { $in: userIds } }).toArray();
  res.json({
    ok: true,
    apiUsers: users.map((u) => ({
      ...sanitizeUser(u),
      keys: keys.filter((k) => k.userId === u.id).map((k) => ({ id: k.id, name: k.name, keyPreview: k.keyPreview, status: k.status, createdAt: k.createdAt, lastUsed: k.lastUsed })),
      activeKeys: keys.filter((k) => k.userId === u.id && k.status === 'Active').length,
    })),
  });
});

app.get('/api/admin/api-accounts', requireAdmin, async (_req, res) => {
  const keys = await db.collection('api-keys').find({}).sort({ createdAt: -1 }).toArray();
  const users = await db.collection('users').find({ role: { $in: ['user', 'agent'] } }).sort({ fullName: 1 }).toArray();
  res.json({
    ok: true,
    accounts: users.map((account) => ({
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
      apiPricing: account.apiPricing && typeof account.apiPricing === 'object' ? account.apiPricing : {},
      keys: keys.filter((key) => key.userId === account.id).map((key) => ({
        id: key.id,
        name: key.name,
        keyPreview: key.keyPreview,
        status: key.status,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
      })),
    })),
  });
});

app.get('/api/admin/api-products', requireAdmin, async (_req, res) => {
  const products = await db.collection('products')
    .find({ enabled: { $ne: false } })
    .sort({ network: 1, size: 1 })
    .toArray();
  res.json({
    ok: true,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      network: product.network,
      size: product.size,
      userPrice: Number(product.userPrice ?? product.price ?? 0),
      agentPrice: Number(product.agentPrice ?? product.price ?? 0),
    })),
  });
});

app.put('/api/admin/api-accounts/:userId', requireAdmin, async (req, res) => {
  const { productId } = req.body || {};
  const price = Number(req.body?.price);
  if (!productId || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ ok: false, error: 'productId and a non-negative product price are required.' });
  }
  const account = await getUserById(req.params.userId);
  if (!account || !['user', 'agent'].includes(account.role)) {
    return res.status(404).json({ ok: false, error: 'API account not found.' });
  }
  const product = await db.collection('products').findOne({ id: String(productId), enabled: { $ne: false } });
  if (!product) return res.status(404).json({ ok: false, error: 'Product not found.' });

  const nextPrice = Number(price.toFixed(2));
  await db.collection('users').updateOne(
    { id: account.id },
    { $set: { [`apiPricing.${product.id}`]: nextPrice } }
  );
  res.json({ ok: true, userId: account.id, productId: product.id, price: nextPrice });
});

// ─── Admin ──────────────────────────────────────────────────────────────────

app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  const [users, orders, refunds, notifications, apiKeys, products, networkSettings] = await Promise.all([
    db.collection('users').find({}).toArray(),
    db.collection('orders').find({}).toArray(),
    db.collection('refunds').find({}).toArray(),
    db.collection('notifications').find({}).toArray(),
    db.collection('api-keys').find({}).toArray(),
    db.collection('products').find({}).toArray(),
    db.collection('network_settings').find({}).toArray(),
  ]);

  res.json({
    ok: true,
    summary: {
      users: users.length,
      orders: orders.length,
      refunds: refunds.length,
      notifications: notifications.length,
      apiKeys: apiKeys.length,
      products: products.length,
      networkSettings: networkSettings.length,
      disabledNetworks: networkSettings.filter((entry) => entry.enabled === false).map((entry) => entry.network),
    },
  });
});

app.get('/api/admin/requests', requireAdmin, async (_req, res) => {
  const [apiOrders, apiKeys] = await Promise.all([
    db.collection('orders').find({ source: 'api' }).sort({ createdAt: -1 }).toArray(),
    db.collection('api-keys').find({}).sort({ createdAt: -1 }).toArray(),
  ]);

  const requests = [
    ...apiOrders.map((order) => ({
      id: order.id,
      email: order.userId ? 'api-request' : 'api-request',
      requestType: 'API order',
      createdAt: order.createdAt || order.date,
      status: order.status || 'Pending',
      amount: order.amount,
    })),
    ...apiKeys.map((key) => ({
      id: key.id,
      email: key.userId || 'api-key',
      requestType: 'API key',
      createdAt: key.createdAt,
      status: key.status || 'Active',
      amount: 0,
    })),
  ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  res.json({ ok: true, requests: requests.slice(0, 50) });
});

app.get('/api/admin/api-config', requireAdmin, async (_req, res) => {
  const config = await db.collection('api_config').findOne({}) || DEFAULT_API_CONFIG;
  res.json({ ok: true, config });
});

app.put('/api/admin/api-config', requireAdmin, async (req, res) => {
  const patch = req.body || {};
  const result = await db.collection('api_config').findOneAndUpdate(
    {},
    { $set: patch },
    { upsert: true, returnDocument: 'after' }
  );
  res.json({ ok: true, config: result.value || patch });
});

app.post('/api/admin/wallet', requireAdmin, async (req, res) => {
  const { userId, type, amount } = req.body || {};
  const value = Number(amount || 0);
  if (!userId || !value) return res.status(400).json({ ok: false, error: 'Invalid wallet action.' });

  const user = await getUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });

  const balBefore = Number(user.walletBalance || 0);
  const balAfter = type === 'debit'
    ? Math.max(0, Number((balBefore - value).toFixed(2)))
    : Number((balBefore + value).toFixed(2));

  await db.collection('users').updateOne({ id: userId }, { $set: { walletBalance: balAfter } });

  if (type === 'credit') {
    const deposit = {
      id: makeId('dep'),
      userId,
      amount: value,
      method: 'admin',
      platform: 'admin',
      reference: makeId('adm'),
      status: 'Credited',
      balBefore,
      balAfter,
      handledBy: req.user.fullName,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await db.collection('deposits').insertOne(deposit);
    await createNotification(userId, 'Wallet credited', `Admin credited GHS ${value.toFixed(2)} to your wallet.`, 'deposit');
  }

  res.json({ ok: true, walletBalance: balAfter });
});

app.get('/api/dashboard', requireUser, async (req, res) => {
  const userId = req.user.id;
  const [orders, deposits] = await Promise.all([
    db.collection('orders').find({ userId }).sort({ date: -1 }).toArray(),
    db.collection('deposits').find({ userId }).sort({ date: -1 }).toArray(),
  ]);

  const user = await getUserById(userId);
  const pendingOrders = orders.filter((o) => o.status === 'Pending').length;
  const completedOrders = orders.filter((o) => o.status === 'Completed').length;

  res.json({
    ok: true,
    dashboard: {
      walletBalance: user?.walletBalance ?? 0,
      walletChange: 0,
      totalOrders: orders.length,
      totalOrdersChange: 0,
      pendingOrders,
      pendingOrdersChange: 0,
      completedOrders,
      completedOrdersChange: 0,
      recentOrders: orders.slice(0, 5),
      recentDeposits: deposits.slice(0, 5),
    },
  });
});

app.post('/api/webhooks/portal02', async (req, res) => {
  const payload = req.body || {};
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const event = root?.event || root?.event_type || payload?.event || payload?.event_type || payload?.type || 'status.updated';
  const orderId = root?.orderId || root?.order_id || root?.id || payload?.orderId || payload?.order_id || payload?.id || null;
  const reference = root?.reference || root?.clientReference || payload?.reference || payload?.clientReference || null;
  const status = String(root?.status || payload?.status || 'pending');

  const statusMap = {
    pending: 'Pending',
    processing: 'Processing',
    delivered: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    refunded: 'Refunded',
    resolved: 'Completed',
  };

  const nextStatus = statusMap[String(status).toLowerCase()] || 'Pending';

  if (db) {
    await db.collection('orders').updateOne(
      { $or: [{ id: orderId }, { reference }, { portalOrderId: orderId }, { portalReference: reference }] },
      {
        $set: {
          status: nextStatus,
          portalStatus: status,
          event,
          vendorUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: false }
    );
  }

  res.json({ ok: true, received: { event, orderId, reference, status: nextStatus }, platform: 'Portal-02.com' });
});

await startMongo();

console.log(`\n🚀 AllenDataHub API Server`);
app.listen(port, '0.0.0.0', () => {
  console.log(`📡 Server listening on 0.0.0.0:${port}`);
  console.log(`🏠 Database name: ${mongoDbName}\n`);
});
