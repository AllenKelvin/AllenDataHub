import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient, ObjectId } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadRuntimeEnv() {
  const candidateDirs = new Set([
    process.cwd(),
    __dirname,
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..', '..'),
  ]);

  const envFiles = Array.from(candidateDirs)
    .map((dir) => path.join(dir, '.env'))
    .filter((filePath, index, list) => filePath && list.indexOf(filePath) === index)
    .filter((filePath) => fs.existsSync(filePath));

  for (const envFile of envFiles) {
    dotenv.config({ path: envFile, override: false });
  }

  if (!process.env.ARKESEL_API_KEY && process.env.VITE_ARKESEL_API_KEY) {
    process.env.ARKESEL_API_KEY = process.env.VITE_ARKESEL_API_KEY;
  }
  if (!process.env.ARKESEL_SENDER_ID && process.env.VITE_ARKESEL_SENDER_ID) {
    process.env.ARKESEL_SENDER_ID = process.env.VITE_ARKESEL_SENDER_ID;
  }
  if (!process.env.ARKESEL_WEBHOOK_SECRET && process.env.VITE_ARKESEL_WEBHOOK_SECRET) {
    process.env.ARKESEL_WEBHOOK_SECRET = process.env.VITE_ARKESEL_WEBHOOK_SECRET;
  }
}

loadRuntimeEnv();

dotenv.config({ override: false });

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL || '';
const mongoDbName = process.env.MONGO_DB_NAME || 'platform';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_KEY || '';
const ALLENDAHUB_FRONTEND_URL = process.env.ALLENDAHUB_FRONTEND_URL || process.env.FRONTEND_URL || process.env.VITE_APP_URL || 'https://allendatahub.com';
const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL || `${ALLENDAHUB_FRONTEND_URL.replace(/\/$/, '')}/payment-return`;
const MTN_MOMO_BASE_URL = String(process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com').replace(/\/+$/, '');
const MTN_MOMO_TARGET_ENVIRONMENT = process.env.MTN_MOMO_TARGET_ENVIRONMENT || 'sandbox';
const MTN_MOMO_COLLECTION_API_USER = process.env.MTN_MOMO_COLLECTION_API_USER || '';
const MTN_MOMO_COLLECTION_API_KEY = process.env.MTN_MOMO_COLLECTION_API_KEY || '';
const MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY = process.env.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY || '';
const MTN_MOMO_REQUEST_TIMEOUT_MS = 20_000;
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'allendatahub@gmail.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'AllenDataHub';
const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY || '';
const ARKESEL_SENDER_ID = process.env.ARKESEL_SENDER_ID || '';
const ARKESEL_WEBHOOK_SECRET = process.env.ARKESEL_WEBHOOK_SECRET || '';
const ARKESEL_COUNTRY_CODE = String(process.env.ARKESEL_COUNTRY_CODE || '233').replace(/\D/g, '') || '233';
const ARKESEL_WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;
const HUBNET_API_KEY = process.env.HUBNET_API_KEY || '';
const HUBNET_BASE_URL = process.env.HUBNET_BASE_URL || 'https://console.hubnet.app/live/api/context/business';
const HUBNET_BACKEND_URL = process.env.BACKEND_URL || process.env.PUBLIC_BACKEND_URL || process.env.VITE_API_URL || 'https://allendatahub.onrender.com';
const HUBNET_REQUEST_TIMEOUT_MS = 30_000;
const REFERRAL_COMMISSION_RATE = 0.01;
const PHONE_VERIFICATION_TTL_MS = 15 * 60 * 1000;
const PHONE_VERIFICATION_RESEND_COOLDOWN_MS = 90 * 1000;
const PHONE_VERIFICATION_MAX_ATTEMPTS = 5;
const ARKESEL_SMS_MAX_LENGTH_CHARS = 306;
const ARKESEL_SMS_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const ARKESEL_SMS_RATE_LIMIT_MAX = 3;
let arkeselSmsRateLimitIndexPromise;
const mtnMomoTokenCache = {
  collection: { token: '', expiresAt: 0 },
};

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

function normalizeArkeselPhone(value) {
  const input = String(value || '').trim();
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0') && digits.length === 10) return digits;
  if (digits.startsWith(ARKESEL_COUNTRY_CODE) && digits.length === ARKESEL_COUNTRY_CODE.length + 9) return digits;
  if (digits.length === 9) return `0${digits}`;
  if (input.startsWith('+')) return digits.length >= 10 && digits.length <= 15 ? digits : '';
  return digits;
}

async function sendArkeselSms({ to, message }) {
  if (!ARKESEL_API_KEY) return { ok: false, error: 'ARKESEL_API_KEY is not configured.' };
  if (!ARKESEL_SENDER_ID) return { ok: false, error: 'ARKESEL_SENDER_ID is not configured.' };
  const phoneNumber = normalizeArkeselPhone(to);
  if (!phoneNumber) return { ok: false, error: 'Phone number is invalid.' };
  if (!message || String(message).length > ARKESEL_SMS_MAX_LENGTH_CHARS) return { ok: false, error: `SMS message must be between 1 and ${ARKESEL_SMS_MAX_LENGTH_CHARS} characters.` };

  const params = new URLSearchParams({
    action: 'send-sms',
    api_key: ARKESEL_API_KEY,
    to: phoneNumber,
    from: ARKESEL_SENDER_ID,
    sms: String(message),
    response: 'json',
  });

  try {
    const response = await fetch(`https://sms.arkesel.com/sms/api?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }

    const resultCode = String(data?.code || data?.status || '').trim().toLowerCase();
    const acceptedCode = ['ok', 'success', 'successful', '200', '0000'].includes(resultCode)
      || data?.status === true
      || data?.success === true;
    const rejectedCode = ['error', 'failed', 'failure', 'false'].includes(resultCode);
    const responseSummary = String(data?.message || data?.response || responseText || '');
    const positiveMessage = /\b(success|successful|successfully sent|sent successfully)\b/i.test(responseSummary);
    const rejectedMessage = /\b(error|failed|failure|invalid|insufficient)\b/i.test(responseSummary);
    if (!response.ok || rejectedCode || rejectedMessage || (!acceptedCode && !positiveMessage)) {
      const debugError = responseSummary || responseText || 'Arkesel rejected the SMS request.';
      console.error(JSON.stringify({
        tag: 'ARKESEL_SMS_REJECTED',
        status: response.status,
        responseSummary: responseSummary || null,
        rawResponse: responseText || null,
        to: phoneNumber,
        from: ARKESEL_SENDER_ID,
        apiKeyPresent: Boolean(ARKESEL_API_KEY),
      }));
      return {
        ok: false,
        status: response.status,
        error: response.ok
          ? 'Arkesel rejected the SMS request.'
          : `Arkesel SMS request failed with status ${response.status}.`,
        detail: debugError,
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to send SMS.' };
  }
}

function hashPhoneVerificationValue(token, code) {
  return crypto.createHash('sha256').update(`${token}:${code}`).digest('hex');
}

function buildPhoneVerificationMessage(code) {
  return `Your AllenDataHub verification code is ${code}. It expires in 15 minutes.`;
}

function generatePhoneVerificationCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function dispatchPhoneVerificationCode({ phone, verificationCode, verificationToken, userId, mode = 'signup' }) {
  const hasSmsConfig = Boolean(ARKESEL_API_KEY && ARKESEL_SENDER_ID);
  console.log(JSON.stringify({
    tag: 'ARKESEL_VERIFICATION_DISPATCH_ATTEMPT',
    mode,
    userId: userId || null,
    hasApiKey: Boolean(ARKESEL_API_KEY),
    hasSenderId: Boolean(ARKESEL_SENDER_ID),
    normalizedPhone: normalizeArkeselPhone(phone),
    countryCode: ARKESEL_COUNTRY_CODE,
  }));

  if (!hasSmsConfig) {
    console.error(JSON.stringify({
      tag: 'ARKESEL_VERIFICATION_CONFIG_MISSING',
      mode,
      userId: userId || null,
      hasApiKey: Boolean(ARKESEL_API_KEY),
      hasSenderId: Boolean(ARKESEL_SENDER_ID),
    }));
    return { ok: false, status: 503, error: 'Phone verification is not configured. Please try again later.' };
  }

  if (!(await claimArkeselSmsQuota(phone))) {
    console.warn(JSON.stringify({
      tag: 'ARKESEL_VERIFICATION_RATE_LIMITED',
      mode,
      userId: userId || null,
      normalizedPhone: normalizeArkeselPhone(phone),
    }));
    return { ok: false, status: 429, error: 'Too many verification messages were sent to this number. Try again later.' };
  }

  const smsResult = await sendArkeselSms({
    to: phone,
    message: buildPhoneVerificationMessage(verificationCode),
  });
  if (!smsResult.ok) {
    console.error(JSON.stringify({
      tag: 'ARKESEL_PHONE_VERIFICATION_SMS_FAILED',
      userId,
      mode,
      error: smsResult.error,
      detail: smsResult.detail || null,
    }));
    return {
      ok: false,
      status: 502,
      error: 'Unable to send a verification code. Please check your number and try again.',
      detail: smsResult.detail || undefined,
    };
  }

  return { ok: true, isDemo: false };
}

async function claimArkeselSmsQuota(phone) {
  const collection = db.collection('arkesel_sms_rate_limits');
  if (!arkeselSmsRateLimitIndexPromise) {
    arkeselSmsRateLimitIndexPromise = collection
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .catch((error) => {
        arkeselSmsRateLimitIndexPromise = undefined;
        throw error;
      });
  }
  await arkeselSmsRateLimitIndexPromise;

  const normalizedPhone = normalizeArkeselPhone(phone);
  const window = Math.floor(Date.now() / ARKESEL_SMS_RATE_LIMIT_WINDOW_MS);
  const id = crypto.createHash('sha256').update(`${normalizedPhone}:${window}`).digest('hex');
  try {
    await collection.updateOne(
      { _id: id },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 2) * ARKESEL_SMS_RATE_LIMIT_WINDOW_MS) },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    await collection.updateOne({ _id: id }, { $inc: { count: 1 } });
  }
  const rateLimit = await collection.findOne({ _id: id });
  return Number(rateLimit?.count || 0) <= ARKESEL_SMS_RATE_LIMIT_MAX;
}

const DEFAULT_NETWORK_SETTINGS = [
  { network: 'MTN', enabled: true },
  { network: 'AirtelTigo', enabled: true },
  { network: 'Telecel', enabled: true },
];

const DEFAULT_API_CONFIG = { enabled: true, note: 'API access active' };

let client;
let db;

const HUBNET_NETWORK_ENDPOINTS = {
  MTN: 'mtn',
  Telecel: 'telecel',
  AirtelTigo: 'at',
};

function normalizeHubnetNetwork(network) {
  const value = String(network || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (value === 'mtn') return 'MTN';
  if (value === 'telecel' || value === 'vodafone') return 'Telecel';
  if (value === 'airteltigo' || value === 'airtel' || value === 'tigo' || value === 'at') return 'AirtelTigo';
  return String(network || '').trim();
}

function makeId(prefix) {
  const randomPart = crypto.randomBytes(10).toString('hex');
  if (prefix === 'ord') {
    return `${prefix}_${Date.now().toString(36).slice(-6)}_${randomPart}`;
  }
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function makeHubnetReference() {
  return `HUB-${crypto.randomBytes(9).toString('hex').toUpperCase()}`;
}

function normalizeHubnetPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('233') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9) return `0${digits}`;
  return digits.startsWith('0') ? digits : '';
}

function extractHubnetVolume(size) {
  const numeric = Number(String(size || '').match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 1000) : 0;
}

function normalizeHubnetOrderErrorMessage(message) {
  const raw = String(message || '').trim();
  if (!raw) return raw;

  return raw
    .replace(/\s+order\.\s*$/i, '')
    .replace(/ before placing another order\.?$/i, ' before placing another')
    .replace(/\s+$/g, '');
}

async function purchaseWithHubnet({ phone, size, network, reference, webhookUrl }) {
  if (!HUBNET_API_KEY) return { success: false, error: 'HUBNET_API_KEY is not configured.' };

  const normalizedNetwork = normalizeHubnetNetwork(network);
  const endpoint = HUBNET_NETWORK_ENDPOINTS[normalizedNetwork];
  const phoneNumber = normalizeHubnetPhone(phone);
  const payload = {
    phone: phoneNumber,
    volume: String(extractHubnetVolume(size)),
    reference: reference || makeHubnetReference(),
    webhook: webhookUrl || `${HUBNET_BACKEND_URL.replace(/\/$/, '')}/api/webhooks/hubnet`,
  };

  if (!endpoint) return { success: false, error: `Unsupported Hubnet network: ${network}` };
  if (!/^0\d{9}$/.test(phoneNumber)) return { success: false, error: 'Phone number is invalid for Hubnet purchase.' };
  if (payload.volume === '0') return { success: false, error: 'Bundle size is invalid for Hubnet purchase.' };

  try {
    const response = await fetch(`${String(HUBNET_BASE_URL).replace(/\/$/, '')}/transaction/${endpoint}-new-transaction`, {
      method: 'POST',
      headers: { token: `Bearer ${HUBNET_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(HUBNET_REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    const responseStatus = String(data.status || data.data?.status || '').toLowerCase();
    const responseCode = String(data.message || data.code || data.data?.code || '').toLowerCase();
    const accepted = data.status === true
      || ['accepted', 'success', 'successful', 'processing', 'pending'].includes(responseStatus)
      || responseCode === '0000'
      || responseCode.includes('transaction initiated')
      || responseCode.includes('successfully placed');
    if (!response.ok || !accepted) {
      return {
        success: false,
        error: data.reason || data.error || data.message || data.data?.message || `Hubnet request failed with status ${response.status}`,
        statusCode: response.status,
        details: data,
      };
    }
    return {
      success: true,
      transactionId: data.transaction_id || data.payment_id || data.reference || payload.reference,
      reference: data.reference || payload.reference,
      status: ['processing', 'pending'].includes(responseStatus) ? responseStatus : 'pending',
      raw: data,
    };
  } catch (error) {
    const statusResult = await checkHubnetTransactionStatus(payload.reference);
    if (statusResult === 'delivered' || statusResult === 'success' || statusResult === 'completed') {
      return { success: true, transactionId: payload.reference, reference: payload.reference, status: 'completed', raw: { reconciled: true, status: statusResult } };
    }
    if (statusResult === 'pending' || statusResult === 'processing') {
      return { success: true, transactionId: payload.reference, reference: payload.reference, status: statusResult, raw: { reconciled: true, status: statusResult } };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Hubnet network error.', details: { statusResult } };
  }
}

async function checkHubnetTransactionStatus(reference) {
  if (!HUBNET_API_KEY || !reference) return null;
  try {
    const response = await fetch(`${String(HUBNET_BASE_URL).replace(/\/$/, '')}/transaction/check-transaction-status`, {
      method: 'POST',
      headers: { token: `Bearer ${HUBNET_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ reference }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json().catch(() => ({}));
    return String(data?.data?.status || data?.status || '').toLowerCase() || null;
  } catch {
    return null;
  }
}

function cancelHubnetOrder() {
  return { success: false, error: 'Hubnet does not provide an order cancellation endpoint.' };
}

function mapHubnetStatus(event, status) {
  const normalizedEvent = String(event || '').toLowerCase();
  if (normalizedEvent.includes('delivered') || normalizedEvent.includes('completed')) return 'Completed';
  if (normalizedEvent.includes('accepted') || normalizedEvent.includes('initiated') || normalizedEvent.includes('success')) return 'Pending';
  if (normalizedEvent.includes('failed') || normalizedEvent.includes('rejected')) return 'Failed';
  if (normalizedEvent.includes('cancel')) return 'Cancelled';

  const normalizedStatus = String(status || '').toLowerCase();
  if (['delivered', 'success', 'completed', 'resolved'].includes(normalizedStatus)) return 'Completed';
  if (['failed', 'error', 'rejected'].includes(normalizedStatus)) return 'Failed';
  if (['cancelled', 'canceled', 'refunded'].includes(normalizedStatus)) return 'Cancelled';
  if (['processing', 'in_progress', 'in-progress', 'in progress'].includes(normalizedStatus)) return 'Processing';
  return 'Pending';
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
    'agent_stores',
    'agent_pricing',
    'store_ledger',
    'store_withdrawals',
  ];

  for (const collectionName of requiredCollections) {
    const exists = await collectionExists(collectionName);
    if (!exists) {
      await db.createCollection(collectionName);
      console.log(`✅ created collection: ${collectionName}`);
    }
  }

  await db.collection('agent_stores').createIndex({ agentId: 1 }, { unique: true });
  await db.collection('agent_stores').createIndex({ slug: 1 }, { unique: true });
  await db.collection('agent_pricing').createIndex({ storeId: 1, packageId: 1 }, { unique: true });
  await db.collection('store_ledger').createIndex({ reference: 1 }, { unique: true });
  await db.collection('store_withdrawals').createIndex({ id: 1 }, { unique: true });
  await db.collection('store_withdrawals').createIndex({ agentId: 1, requestId: 1 }, { unique: true });

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

function slugifyStoreName(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function getStorePublicUrl(slug) {
  return `${ALLENDAHUB_FRONTEND_URL.replace(/\/$/, '')}/s/${encodeURIComponent(slug)}`;
}

async function getStorePricing(storeId, products) {
  const pricing = await db.collection('agent_pricing').find({ storeId }).toArray();
  const pricingByPackage = new Map(pricing.map((entry) => [String(entry.packageId), entry]));
  return products.map((product) => {
    const basePrice = Number(product.agentPrice ?? product.userPrice ?? product.price ?? 0);
    const custom = pricingByPackage.get(String(product.id));
    return { ...product, basePrice, customPrice: custom ? Number(custom.customPrice) : basePrice };
  });
}

class MtnMomoError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'MtnMomoError';
    this.status = status;
  }
}

function getMtnMomoSubscriptionKey() {
  return MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY;
}

function getMtnMomoApiCredentials() {
  return { user: MTN_MOMO_COLLECTION_API_USER, key: MTN_MOMO_COLLECTION_API_KEY };
}

function getMtnMomoMissingConfiguration() {
  const credentials = getMtnMomoApiCredentials();
  const missing = [];
  if (!credentials.user) missing.push('MTN_MOMO_COLLECTION_API_USER');
  if (!credentials.key) missing.push('MTN_MOMO_COLLECTION_API_KEY');
  if (!getMtnMomoSubscriptionKey()) missing.push('MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY');
  return missing;
}

function normalizeMtnMomoPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const nationalNumber = digits.startsWith('233')
    ? digits.slice(3)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  return /^\d{9}$/.test(nationalNumber) ? `233${nationalNumber}` : '';
}

async function getMtnMomoAccessToken(product) {
  const missing = getMtnMomoMissingConfiguration();
  if (missing.length) {
    throw new MtnMomoError(`MTN MoMo is not configured. Set ${missing.join(', ')} on the server.`);
  }

  const cached = mtnMomoTokenCache[product];
  if (cached.token && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const subscriptionKey = getMtnMomoSubscriptionKey();
  const credentials = getMtnMomoApiCredentials();
  const authorization = Buffer.from(`${credentials.user}:${credentials.key}`).toString('base64');
  let response;
  try {
    response = await fetch(`${MTN_MOMO_BASE_URL}/${product}/token/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authorization}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'X-Target-Environment': MTN_MOMO_TARGET_ENVIRONMENT,
      },
      signal: AbortSignal.timeout(MTN_MOMO_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new MtnMomoError(error instanceof Error ? error.message : 'Unable to connect to MTN MoMo.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new MtnMomoError(
      data.error_description || data.message || `MTN MoMo token request failed (${response.status}).`,
      response.status,
    );
  }

  cached.token = data.access_token;
  cached.expiresAt = Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000;
  return cached.token;
}

async function requestMtnMomo(product, endpoint, options = {}) {
  const accessToken = await getMtnMomoAccessToken(product);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Ocp-Apim-Subscription-Key': getMtnMomoSubscriptionKey(),
    'X-Target-Environment': MTN_MOMO_TARGET_ENVIRONMENT,
    Accept: 'application/json',
    ...options.headers,
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${MTN_MOMO_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(MTN_MOMO_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new MtnMomoError(error instanceof Error ? error.message : 'Unable to connect to MTN MoMo.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new MtnMomoError(
      data.message || data.error_description || data.error || `MTN MoMo request failed (${response.status}).`,
      response.status,
    );
  }
  return { response, data };
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

async function creditWalletForSuccessfulDeposit({
  userId,
  amount,
  reference,
  source = 'paystack',
  metadata = {},
  platform = 'paystack',
  method = 'card',
  sendSms = true,
}) {
  if (!db || !userId) {
    return { ok: false, error: 'Missing userId for wallet credit.' };
  }

  const user = await getUserById(String(userId));
  if (!user) {
    return { ok: false, error: `User ${userId} not found.` };
  }

  const existing = await db.collection('deposits').findOne({ reference });
  if (existing?.status === 'Credited' || existing?.status === 'Completed') {
    if (sendSms) await sendPaystackDepositSms(existing);
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

  const claim = await db.collection('deposits').updateOne(
    { reference, status: 'Pending' },
    { $set: { status: 'Processing', processingAt: new Date().toISOString() } }
  );
  if (claim.matchedCount === 0) {
    const current = await db.collection('deposits').findOne({ reference });
    if (current?.status === 'Credited' || current?.status === 'Completed') {
      return {
        ok: true,
        alreadyProcessed: true,
        reference,
        userId,
        balBefore: Number(current.balBefore ?? user.walletBalance ?? 0),
        balAfter: Number(current.balAfter ?? user.walletBalance ?? 0),
        creditAmount: Number(current.amount || 0),
      };
    }
    return { ok: false, pending: true, error: 'This payment is already being processed.' };
  }

  const amountValue = Number(amount || 0);
  const balBefore = Number(user.walletBalance || 0);
  const balAfter = Number((balBefore + amountValue).toFixed(2));
  const creditedAt = new Date().toISOString();

  await db.collection('users').updateOne({ id: user.id }, { $set: { walletBalance: balAfter } });

  const depositRecord = {
    id: existing?.id || makeId('dep'),
    userId: user.id,
    amount: amountValue,
    fee: Number(existing?.fee || 0),
    totalPay: Number(existing?.totalPay ?? amountValue),
    method,
    platform,
    reference,
    status: 'Completed',
    balBefore,
    balAfter,
    handledBy: source,
    metadata: {
      project: 'NEW_APP',
      userId: user.id,
      ...metadata,
    },
    source,
    date: existing?.date || creditedAt,
    creditedAt,
    createdAt: existing?.createdAt || creditedAt,
  };

  if (existing) {
    await db.collection('deposits').updateOne({ reference }, { $set: depositRecord });
  } else {
    await db.collection('deposits').insertOne(depositRecord);
  }

  const notificationMessage = `GHS ${amountValue.toFixed(2)} added to your wallet.`;
  await createNotification(user.id, 'Wallet credited', notificationMessage, 'deposit', { sendSms: false });
  if (sendSms) await sendPaystackDepositSms(depositRecord);

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

async function reserveStoreWithdrawal(withdrawal) {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const storeDebit = await db.collection('agent_stores').updateOne(
        { agentId: withdrawal.agentId, walletBalance: { $gte: withdrawal.amount } },
        { $inc: { walletBalance: -withdrawal.amount } },
        { session },
      );
      if (storeDebit.modifiedCount !== 1) {
        throw new Error('Mini-store commission balance is insufficient.');
      }

      await db.collection('store_withdrawals').insertOne(withdrawal, { session });
    });
  } finally {
    await session.endSession();
  }
}

async function releaseStoreWithdrawal(withdrawal, fromStatus, nextStatus, extraFields = {}) {
  const session = client.startSession();
  let released = false;
  try {
    await session.withTransaction(async () => {
      const transition = await db.collection('store_withdrawals').updateOne(
        { id: withdrawal.id, status: fromStatus },
        { $set: { status: nextStatus, ...extraFields, updatedAt: new Date().toISOString() } },
        { session },
      );
      if (transition.modifiedCount !== 1) return;

      const storeCredit = await db.collection('agent_stores').updateOne(
        { agentId: withdrawal.agentId },
        { $inc: { walletBalance: withdrawal.amount } },
        { session },
      );
      if (storeCredit.matchedCount !== 1) {
        throw new Error(`Unable to release reserved mini-store funds for request ${withdrawal.id}.`);
      }
      if (withdrawal.transferType !== 'wallet') {
        const legacyWalletCredit = await db.collection('users').updateOne(
          { id: withdrawal.agentId },
          { $inc: { walletBalance: withdrawal.amount } },
          { session },
        );
        if (legacyWalletCredit.matchedCount !== 1) {
          throw new Error(`Unable to release legacy reserved wallet funds for request ${withdrawal.id}.`);
        }
      }
      released = true;
    });
    return released;
  } finally {
    await session.endSession();
  }
}

async function approveStoreWalletTransfer(transfer, adminId) {
  const session = client.startSession();
  let approvalRecord = null;
  try {
    await session.withTransaction(async () => {
      approvalRecord = null;
      const approvedAt = new Date().toISOString();
      const transition = await db.collection('store_withdrawals').updateOne(
        { id: transfer.id, status: 'Pending', transferType: 'wallet' },
        { $set: { status: 'Approved', approvedBy: adminId, approvedAt, updatedAt: approvedAt } },
        { session },
      );
      if (transition.modifiedCount !== 1) return;

      const walletCredit = await db.collection('users').updateOne(
        { id: transfer.agentId },
        { $inc: { walletBalance: transfer.amount } },
        { session },
      );
      if (walletCredit.matchedCount !== 1) {
        throw new Error(`Unable to credit the agent wallet for mini-store transfer ${transfer.id}.`);
      }
      const creditedAgent = await db.collection('users').findOne(
        { id: transfer.agentId },
        { session, projection: { walletBalance: 1 } },
      );
      if (!creditedAgent) {
        throw new Error(`Unable to verify the credited agent wallet for mini-store transfer ${transfer.id}.`);
      }
      const walletBalanceAfter = Number(creditedAgent.walletBalance || 0);
      const recordUpdate = await db.collection('store_withdrawals').updateOne(
        { id: transfer.id, status: 'Approved' },
        { $set: { approvedAmount: transfer.amount, walletBalanceAfter } },
        { session },
      );
      if (recordUpdate.modifiedCount !== 1) {
        throw new Error(`Unable to save the approval record for mini-store transfer ${transfer.id}.`);
      }
      approvalRecord = {
        approved: true,
        approvedAt,
        approvedAmount: transfer.amount,
        walletBalanceAfter,
      };
    });
    return approvalRecord;
  } finally {
    await session.endSession();
  }
}

async function creditStoreCommission(order) {
  if (order.paid !== true) {
    throw new Error(`Cannot credit mini-store commission before payment for order ${order.id}.`);
  }
  const commission = Number(order.agentCommission || 0);
  if (!Number.isFinite(commission) || commission <= 0) return false;

  const session = client.startSession();
  let credited = false;
  try {
    await session.withTransaction(async () => {
      const ledgerClaim = await db.collection('store_ledger').updateOne(
        { reference: order.reference },
        {
          $setOnInsert: {
            id: makeId('ledger'),
            storeId: order.storeId,
            agentId: order.userId,
            orderId: order.id,
            reference: order.reference,
            type: 'commission',
            amount: commission,
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true, session },
      );
      if (ledgerClaim.upsertedCount !== 1) return;

      const userCredit = await db.collection('users').updateOne(
        { id: order.userId },
        { $inc: { commissionEarned: commission } },
        { session },
      );
      const storeCredit = await db.collection('agent_stores').updateOne(
        { agentId: order.userId },
        { $inc: { walletBalance: commission } },
        { session },
      );
      if (userCredit.matchedCount !== 1 || storeCredit.matchedCount !== 1) {
        throw new Error(`Unable to credit the agent commission for mini-store order ${order.id}.`);
      }
      credited = true;
    });
    return credited;
  } finally {
    await session.endSession();
  }
}

async function debitWalletBalance(userId, amount) {
  const value = Number(Number(amount).toFixed(2));
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'Wallet debit amount must be greater than zero.' };
  }

  const session = client.startSession();
  let result = { ok: false, error: 'Insufficient wallet balance.' };
  try {
    await session.withTransaction(async () => {
      const debit = await db.collection('users').updateOne(
        { id: userId, walletBalance: { $gte: value } },
        { $inc: { walletBalance: -value } },
        { session },
      );
      if (debit.modifiedCount !== 1) {
        result = { ok: false, error: 'Insufficient wallet balance.' };
        return;
      }

      const user = await db.collection('users').findOne({ id: userId }, { session, projection: { walletBalance: 1 } });
      result = {
        ok: true,
        walletBalance: Number(user?.walletBalance || 0),
        commissionDebited: 0,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function sendPaystackDepositSms(deposit) {
  if (!deposit?.reference || !deposit?.userId) return;

  if (!ARKESEL_API_KEY || !ARKESEL_SENDER_ID) {
    console.error(JSON.stringify({
      tag: 'PAYSTACK_DEPOSIT_SMS_SKIPPED',
      reference: deposit.reference,
      userId: deposit.userId,
      reason: 'sms_configuration_missing',
      hasApiKey: Boolean(ARKESEL_API_KEY),
      hasSenderId: Boolean(ARKESEL_SENDER_ID),
    }));
    return;
  }

  const user = await getUserById(deposit.userId);
  if (!user?.phoneVerified || !user.phone) {
    console.warn(JSON.stringify({
      tag: 'PAYSTACK_DEPOSIT_SMS_SKIPPED',
      reference: deposit.reference,
      userId: deposit.userId,
      reason: !user ? 'user_not_found' : !user.phoneVerified ? 'phone_not_verified' : 'phone_missing',
    }));
    return;
  }

  const now = new Date();
  const claim = await db.collection('deposits').updateOne(
    {
      reference: deposit.reference,
      status: { $in: ['Credited', 'Completed'] },
      depositSmsSentAt: { $exists: false },
      $or: [
        { depositSmsSendingAt: { $exists: false } },
        { depositSmsSendingAt: { $lt: new Date(now.getTime() - 2 * 60 * 1000) } },
      ],
    },
    { $set: { depositSmsSendingAt: now.toISOString() } },
  );
  if (claim.modifiedCount === 0) return;

  const amount = Number(deposit.amount || 0);
  const balance = Number(deposit.balAfter ?? user.walletBalance ?? 0);
  const message = `You have successfully deposited GHS ${amount.toFixed(2)} to AllenDataHub. Your wallet balance is GHS ${balance.toFixed(2)}.`;
  const smsResult = await sendArkeselSms({ to: user.phone, message });
  if (!smsResult.ok) {
    await db.collection('deposits').updateOne(
      { reference: deposit.reference, depositSmsSendingAt: now.toISOString() },
      { $unset: { depositSmsSendingAt: '' } },
    );
    console.error(JSON.stringify({
      tag: 'PAYSTACK_DEPOSIT_SMS_FAILED',
      reference: deposit.reference,
      userId: deposit.userId,
      error: smsResult.error,
      detail: smsResult.detail || null,
    }));
    return;
  }

  await db.collection('deposits').updateOne(
    { reference: deposit.reference, depositSmsSendingAt: now.toISOString() },
    {
      $set: { depositSmsSentAt: new Date().toISOString() },
      $unset: { depositSmsSendingAt: '' },
    },
  );
  console.log(JSON.stringify({
    tag: 'PAYSTACK_DEPOSIT_SMS_SENT',
    reference: deposit.reference,
    userId: deposit.userId,
  }));
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

async function requireAgent(req, res, next) {
  await requireUser(req, res, () => {
    if (String(req.user.role || '').toLowerCase() !== 'agent') {
      return res.status(403).json({ ok: false, error: 'Agent access required.' });
    }
    next();
  });
}

async function createNotification(userId, title, message, type = 'info', { sendSms = true } = {}) {
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

  const smsNotificationTypes = new Set(['deposit', 'refund', 'referral']);
  if (sendSms && smsNotificationTypes.has(type)) {
    await sendNotificationSms(userId, `${title}: ${message}`, { type });
  }
}

async function sendNotificationSms(userId, message, context = {}) {
  if (!ARKESEL_API_KEY || !ARKESEL_SENDER_ID) {
    console.error(JSON.stringify({
      tag: 'ARKESEL_NOTIFICATION_SMS_SKIPPED',
      userId,
      ...context,
      reason: 'sms_configuration_missing',
      hasApiKey: Boolean(ARKESEL_API_KEY),
      hasSenderId: Boolean(ARKESEL_SENDER_ID),
    }));
    return;
  }
  const user = await getUserById(userId);
  if (!user?.phoneVerified || !user.phone) {
    console.warn(JSON.stringify({
      tag: 'ARKESEL_NOTIFICATION_SMS_SKIPPED',
      userId,
      ...context,
      reason: !user ? 'user_not_found' : !user.phoneVerified ? 'phone_not_verified' : 'phone_missing',
    }));
    return;
  }

  const smsResult = await sendArkeselSms({
    to: user.phone,
    message: message.slice(0, ARKESEL_SMS_MAX_LENGTH_CHARS),
  });
  if (!smsResult.ok) {
    console.error(JSON.stringify({
      tag: 'ARKESEL_NOTIFICATION_SMS_FAILED',
      userId,
      ...context,
      error: smsResult.error,
      detail: smsResult.detail || null,
    }));
    return;
  }
  console.log(JSON.stringify({
    tag: 'ARKESEL_NOTIFICATION_SMS_SENT',
    userId,
    ...context,
  }));
}

async function sendOrderCompletedSms(order) {
  if (!order?.id || !order?.userId) return;
  const isMiniStoreOrder = order.source === 'mini-store';

  if (!ARKESEL_API_KEY || !ARKESEL_SENDER_ID) {
    console.error(JSON.stringify({
      tag: 'ARKESEL_ORDER_COMPLETED_SMS_SKIPPED',
      orderId: order.id,
      userId: order.userId,
      reason: 'sms_configuration_missing',
      hasApiKey: Boolean(ARKESEL_API_KEY),
      hasSenderId: Boolean(ARKESEL_SENDER_ID),
    }));
    return;
  }

  const user = await getUserById(order.userId);
  if (!user?.phoneVerified || !user.phone) {
    console.warn(JSON.stringify({
      tag: 'ARKESEL_ORDER_COMPLETED_SMS_SKIPPED',
      orderId: order.id,
      userId: order.userId,
      reason: !user ? 'user_not_found' : !user.phoneVerified ? 'phone_not_verified' : 'phone_missing',
    }));
    return;
  }

  if (isMiniStoreOrder && !order.recipient) {
    console.warn(JSON.stringify({
      tag: 'ARKESEL_ORDER_COMPLETED_SMS_SKIPPED',
      orderId: order.id,
      userId: order.userId,
      reason: 'recipient_phone_missing',
    }));
    return;
  }

  const claim = await db.collection('orders').updateOne(
    { id: order.id, completionSmsSentAt: { $exists: false }, completionSmsSending: { $ne: true } },
    { $set: { completionSmsSending: true } },
  );
  if (claim.modifiedCount === 0) return;

  const orderDescription = [order.size, order.network, order.recipient].filter(Boolean).join(' ');
  const message = isMiniStoreOrder
    ? `Order ${order.recipient} completed. Thanks for purchasing with AllenDataHub.`
    : `Your order${orderDescription ? ` (${orderDescription})` : ''} has been completed. Thank you for choosing AllenDataHub.`;
  const smsResult = await sendArkeselSms({
    to: user.phone,
    message: message.slice(0, ARKESEL_SMS_MAX_LENGTH_CHARS),
  });

  if (!smsResult.ok) {
    await db.collection('orders').updateOne(
      { id: order.id, completionSmsSending: true },
      { $unset: { completionSmsSending: '' } },
    );
    console.error(JSON.stringify({
      tag: 'ARKESEL_ORDER_COMPLETED_SMS_FAILED',
      orderId: order.id,
      userId: order.userId,
      error: smsResult.error,
      detail: smsResult.detail || null,
    }));
    return;
  }

  await db.collection('orders').updateOne(
    { id: order.id, completionSmsSending: true },
    { $set: { completionSmsSentAt: new Date().toISOString() }, $unset: { completionSmsSending: '' } },
  );
  console.log(JSON.stringify({
    tag: 'ARKESEL_ORDER_COMPLETED_SMS_SENT',
    orderId: order.id,
    userId: order.userId,
  }));
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
  const {
    password: _password,
    phoneVerificationPending: _phoneVerificationPending,
    phoneVerificationTokenHash: _phoneVerificationTokenHash,
    phoneVerificationCodeHash: _phoneVerificationCodeHash,
    phoneVerificationExpiresAt: _phoneVerificationExpiresAt,
    phoneVerificationAttempts: _phoneVerificationAttempts,
    phoneVerificationLastSentAt: _phoneVerificationLastSentAt,
    ...safe
  } = user;
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

app.post('/api/webhooks/arkesel', async (req, res) => {
  if (!ARKESEL_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, error: 'ARKESEL_WEBHOOK_SECRET is not configured.' });
  }

  const timestamp = String(req.headers['x-webhook-timestamp'] || '');
  const signature = String(req.headers['x-webhook-signature'] || '');
  const timestampSeconds = Number(timestamp);
  const timestampMs = timestampSeconds * 1000;
  if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(timestampSeconds)
    || Math.abs(Date.now() - timestampMs) > ARKESEL_WEBHOOK_MAX_AGE_MS) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired webhook timestamp.' });
  }

  if (!/^[a-f\d]{64}$/i.test(signature) || !Buffer.isBuffer(req.rawBody)) {
    return res.status(401).json({ ok: false, error: 'Invalid webhook signature.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', ARKESEL_WEBHOOK_SECRET)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), req.rawBody]))
    .digest();
  const receivedSignature = Buffer.from(signature, 'hex');
  if (!crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
    return res.status(401).json({ ok: false, error: 'Invalid webhook signature.' });
  }

  const event = String(req.body?.event || 'unknown').slice(0, 100);
  console.info(JSON.stringify({
    tag: 'ARKESEL_WEBHOOK_RECEIVED',
    event,
    receivedAt: new Date().toISOString(),
  }));
  return res.json({ ok: true });
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
  if (user.phoneVerificationPending && !user.phoneVerified) {
    return res.status(403).json({ ok: false, error: 'Please verify your phone number before logging in.' });
  }
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
  if (!normalizeArkeselPhone(phone)) {
    return res.status(400).json({ ok: false, error: 'Enter a valid Ghanaian phone number.' });
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
  let referrer;
  if (referredBy) {
    referrer = await db.collection('users').findOne({
      referralCode: { $regex: `^${String(referredBy).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (referrer) {
      referredBy = referrer.referralCode;
    } else {
      referredBy = undefined;
    }
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationCode = generatePhoneVerificationCode();
  const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
  console.log(JSON.stringify({
    tag: 'REGISTRATION_PHONE_VERIFICATION_START',
    email: email.toLowerCase(),
    phone: normalizeArkeselPhone(phone) || null,
    hasApiKey: Boolean(ARKESEL_API_KEY),
    hasSenderId: Boolean(ARKESEL_SENDER_ID),
  }));
  const dispatchResult = await dispatchPhoneVerificationCode({
    phone,
    verificationCode,
    verificationToken,
    userId: null,
    mode: 'signup',
  });
  if (!dispatchResult.ok) {
    console.error(JSON.stringify({
      tag: 'REGISTRATION_PHONE_VERIFICATION_FAILED',
      email: email.toLowerCase(),
      phone: normalizeArkeselPhone(phone) || null,
      status: dispatchResult.status || 503,
      error: dispatchResult.error,
      detail: dispatchResult.detail || null,
    }));
    return res.status(dispatchResult.status || 503).json({ ok: false, error: dispatchResult.error });
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
    phoneVerificationPending: true,
    phoneVerificationTokenHash: verificationTokenHash,
    phoneVerificationCodeHash: hashPhoneVerificationValue(verificationToken, verificationCode),
    phoneVerificationExpiresAt: new Date(Date.now() + PHONE_VERIFICATION_TTL_MS),
    phoneVerificationAttempts: 0,
    phoneVerificationLastSentAt: new Date(),
    walletBalance: 0,
    commissionEarned: 0,
    referralCode: nextReferral,
    totalReferrals: 0,
    initials: fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    referredBy,
    createdAt: new Date().toISOString(),
  };

  await db.collection('users').insertOne(newUser);

  if (referrer) {
    await db.collection('users').updateOne({ id: referrer.id }, { $inc: { totalReferrals: 1 } });
    await createNotification(referrer.id, 'New referral', `${fullName} signed up using your referral code.`, 'referral');
  }

  return res.status(201).json({
    ok: true,
    verificationToken,
    message: 'A verification code has been sent to your phone.',
  });
});

app.post('/api/auth/verify-phone', async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });
  const token = String(req.body?.verificationToken || '').trim();
  const code = String(req.body?.code || '').trim();
  if (!token || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ ok: false, error: 'A valid verification token and 6-digit code are required.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const pendingUser = await db.collection('users').findOne({
    phoneVerificationTokenHash: tokenHash,
    phoneVerificationPending: true,
    phoneVerificationExpiresAt: { $gt: new Date() },
    phoneVerificationAttempts: { $lt: PHONE_VERIFICATION_MAX_ATTEMPTS },
  });
  if (!pendingUser) {
    return res.status(400).json({ ok: false, error: 'This verification code has expired or can no longer be used. Request a new code.' });
  }

  const submittedHash = hashPhoneVerificationValue(token, code);
  const codeMatches = submittedHash.length === pendingUser.phoneVerificationCodeHash.length
    && crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(pendingUser.phoneVerificationCodeHash));
  if (!codeMatches) {
    await db.collection('users').updateOne(
      { id: pendingUser.id, phoneVerificationAttempts: { $lt: PHONE_VERIFICATION_MAX_ATTEMPTS } },
      { $inc: { phoneVerificationAttempts: 1 } },
    );
    return res.status(400).json({ ok: false, error: 'The verification code is incorrect.' });
  }

  const result = await db.collection('users').findOneAndUpdate(
    {
      id: pendingUser.id,
      phoneVerificationTokenHash: tokenHash,
      phoneVerificationCodeHash: submittedHash,
      phoneVerificationExpiresAt: { $gt: new Date() },
      phoneVerificationAttempts: { $lt: PHONE_VERIFICATION_MAX_ATTEMPTS },
    },
    {
      $set: { phoneVerified: true },
      $unset: {
        phoneVerificationPending: '',
        phoneVerificationTokenHash: '',
        phoneVerificationCodeHash: '',
        phoneVerificationExpiresAt: '',
        phoneVerificationAttempts: '',
        phoneVerificationLastSentAt: '',
      },
    },
    { returnDocument: 'after' },
  );
  const verifiedUser = result?.value ?? result ?? null;
  if (!verifiedUser) {
    return res.status(400).json({ ok: false, error: 'This verification code has expired or can no longer be used. Request a new code.' });
  }
  return res.json({ ok: true, user: sanitizeUser(verifiedUser) });
});

app.post('/api/auth/resend-phone-verification', async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });
  const token = String(req.body?.verificationToken || '').trim();
  if (!token) return res.status(400).json({ ok: false, error: 'Verification token is required.' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await db.collection('users').findOne({
    phoneVerificationTokenHash: tokenHash,
    phoneVerificationPending: true,
  });
  if (!user) return res.status(404).json({ ok: false, error: 'Phone verification session was not found. Please register again.' });

  const lastSentAt = new Date(user.phoneVerificationLastSentAt || 0).getTime();
  const waitMs = lastSentAt + PHONE_VERIFICATION_RESEND_COOLDOWN_MS - Date.now();
  if (waitMs > 0) {
    return res.status(429).json({ ok: false, error: `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.` });
  }

  const sentAt = new Date();
  const cooldownClaim = await db.collection('users').updateOne(
    {
      id: user.id,
      phoneVerificationTokenHash: tokenHash,
      phoneVerificationPending: true,
      phoneVerificationLastSentAt: { $lte: new Date(Date.now() - PHONE_VERIFICATION_RESEND_COOLDOWN_MS) },
    },
    { $set: { phoneVerificationLastSentAt: sentAt } },
  );
  if (cooldownClaim.modifiedCount !== 1) {
    return res.status(429).json({ ok: false, error: 'A verification code was just requested. Please wait before trying again.' });
  }

  const verificationCode = generatePhoneVerificationCode();
  const dispatchResult = await dispatchPhoneVerificationCode({
    phone: user.phone,
    verificationCode,
    verificationToken: token,
    userId: user.id,
    mode: 'resend',
  });
  if (!dispatchResult.ok) {
    return res.status(dispatchResult.status || 503).json({ ok: false, error: dispatchResult.error });
  }

  await db.collection('users').updateOne(
    { id: user.id, phoneVerificationTokenHash: tokenHash, phoneVerificationPending: true },
    {
      $set: {
        phoneVerificationCodeHash: hashPhoneVerificationValue(token, verificationCode),
        phoneVerificationExpiresAt: new Date(Date.now() + PHONE_VERIFICATION_TTL_MS),
        phoneVerificationAttempts: 0,
      },
    },
  );
  return res.json({
    ok: true,
    message: dispatchResult.isDemo
      ? `Demo verification mode: use ${verificationCode} to verify your phone.`
      : 'A new verification code has been sent.',
    verificationCode: dispatchResult.isDemo ? verificationCode : undefined,
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

  const updatedUser = result?.value ?? result ?? null;
  if (!updatedUser) return res.status(404).json({ ok: false, error: 'Unable to verify this email link.' });
  return res.json({ ok: true, user: sanitizeUser(updatedUser) });
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const genericResponse = {
    ok: true,
    message: 'If an account exists for that email, a password reset link has been sent.',
  };
  if (!email) return res.status(400).json({ ok: false, error: 'Email is required.' });

  const user = await db.collection('users').findOne({
    email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  });
  if (!user) return res.json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.collection('users').updateOne(
    { id: user.id },
    { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } }
  );

  const resetUrl = `${ALLENDAHUB_FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const firstName = String(user.fullName || 'there').split(/\s+/)[0];
  const emailResult = await sendBrevoEmail({
    toEmail: user.email,
    toName: user.fullName || user.email,
    subject: 'Reset your AllenDataHub password',
    htmlContent: `<p>Hello ${firstName},</p><p>We received a request to reset your AllenDataHub password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour and can only be used once. If you did not request this, you can ignore this email.</p>`,
    textContent: `Hello ${firstName},\n\nReset your AllenDataHub password: ${resetUrl}\n\nThis link expires in 1 hour and can only be used once. If you did not request this, you can ignore this email.`,
  });

  if (!emailResult.ok) {
    await db.collection('users').updateOne(
      { id: user.id, passwordResetTokenHash: tokenHash },
      { $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' } }
    );
    console.error('Password reset email failed:', emailResult.error);
  }

  return res.json(genericResponse);
});

app.post('/api/auth/reset-password', async (req, res) => {
  if (!db) return res.status(503).json({ ok: false, error: 'MongoDB not connected' });

  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');
  if (!token || !password) return res.status(400).json({ ok: false, error: 'Reset token and new password are required.' });
  if (password.length < 8) return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await db.collection('users').findOneAndUpdate(
    { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } },
    {
      $set: { password: hashPassword(password), passwordUpdatedAt: new Date().toISOString() },
      $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' },
    },
    { returnDocument: 'after' }
  );

  if (!result) return res.status(400).json({ ok: false, error: 'This password reset link is invalid or expired.' });
  return res.json({ ok: true, message: 'Your password has been reset successfully.' });
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

  const allowed = ['fullName', 'email', 'phone', 'whatsapp', 'momo', 'initials', 'network', 'commissionEarned'];
  if (req.user.role === 'admin') allowed.push('walletBalance');
  const patch = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  }

  const targetUser = req.user.id === id ? req.user : await getUserById(id);
  const phoneChanged = patch.phone !== undefined
    && String(patch.phone).trim() !== String(targetUser?.phone || '').trim();
  if (phoneChanged) patch.phoneVerified = false;

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

// ─── Agent mini-store ──────────────────────────────────────────────────────

app.post('/api/agent/store', requireAgent, async (req, res) => {
  const storeName = String(req.body?.storeName || '').trim();
  const contactPhone = String(req.body?.contactPhone || '').trim();
  const whatsappNumber = String(req.body?.whatsappNumber || '').trim();
  if (!storeName || !contactPhone || !whatsappNumber) return res.status(400).json({ ok: false, error: 'Store name, contact phone, and WhatsApp number are required.' });
  const baseSlug = slugifyStoreName(storeName);
  if (!baseSlug) return res.status(400).json({ ok: false, error: 'Store name must contain letters or numbers.' });
  const existing = await db.collection('agent_stores').findOne({ agentId: req.user.id });
  let slug = baseSlug;
  let suffix = 2;
  while (await db.collection('agent_stores').findOne({ slug, agentId: { $ne: req.user.id } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  const now = new Date().toISOString();
  const store = { agentId: req.user.id, storeName, slug, contactPhone, whatsappNumber, walletBalance: Number(existing?.walletBalance || 0), isActive: existing?.isActive !== false, createdAt: existing?.createdAt || now, updatedAt: now };
  await db.collection('agent_stores').updateOne({ agentId: req.user.id }, { $set: store }, { upsert: true });
  res.status(existing ? 200 : 201).json({ ok: true, store: { ...store, link: getStorePublicUrl(slug) } });
});

app.get('/api/agent/store', requireAgent, async (req, res) => {
  const store = await db.collection('agent_stores').findOne({ agentId: req.user.id });
  if (!store) return res.json({ ok: true, store: null });
  const products = await db.collection('products').find({ enabled: { $ne: false } }).toArray();
  const pricing = await getStorePricing(String(store._id || store.agentId), products);
  res.json({ ok: true, store: { ...store, link: getStorePublicUrl(store.slug), pricing } });
});

app.post('/api/agent/store/pricing', requireAgent, async (req, res) => {
  const store = await db.collection('agent_stores').findOne({ agentId: req.user.id });
  if (!store) return res.status(404).json({ ok: false, error: 'Create your store profile first.' });
  const entries = Array.isArray(req.body?.pricing) ? req.body.pricing : [];
  if (entries.length === 0) return res.status(400).json({ ok: false, error: 'Pricing entries are required.' });
  const products = await db.collection('products').find({ enabled: { $ne: false } }).toArray();
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  for (const entry of entries) {
    const product = productsById.get(String(entry.packageId));
    const customPrice = Number(entry.customPrice);
    const basePrice = Number(product?.agentPrice ?? product?.userPrice ?? product?.price ?? 0);
    if (!product || !Number.isFinite(customPrice) || customPrice < basePrice) return res.status(422).json({ ok: false, error: `Custom price for ${entry.packageId} must be at least the package base price.` });
  }
  const storeKey = String(store._id || store.agentId);
  const now = new Date().toISOString();
  await Promise.all(entries.map((entry) => db.collection('agent_pricing').updateOne(
    { storeId: storeKey, packageId: String(entry.packageId) },
    { $set: { storeId: storeKey, packageId: String(entry.packageId), customPrice: Number(entry.customPrice), updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  )));
  res.json({ ok: true, pricing: await getStorePricing(storeKey, products) });
});

app.get('/api/agent/store/analytics', requireAgent, async (req, res) => {
  const store = await db.collection('agent_stores').findOne({ agentId: req.user.id });
  if (!store) return res.json({ ok: true, analytics: { totalOrders: 0, totalCommissions: 0, walletBalance: Number(req.user.walletBalance || 0), withdrawableBalance: 0 } });
  const storeId = String(store._id || store.agentId);
  const agent = await getUserById(req.user.id);
  const [sales, commission] = await Promise.all([
    db.collection('orders').countDocuments({ storeId, paid: true }),
    db.collection('store_ledger').aggregate([{ $match: { storeId, type: 'commission' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
  ]);
  const walletBalance = Number(agent?.walletBalance || 0);
  const commissionBalance = Number(store.walletBalance || 0);
  res.json({
    ok: true,
    analytics: {
      totalOrders: sales,
      totalCommissions: Number(commission[0]?.total || 0),
      walletBalance,
      withdrawableBalance: commissionBalance,
    },
  });
});

app.get('/api/agent/store/withdrawals', requireAgent, async (req, res) => {
  const withdrawals = await db.collection('store_withdrawals')
    .find({ agentId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .project({ _id: 0, mtnReferenceId: 0 })
    .toArray();
  res.json({ ok: true, withdrawals });
});

app.post('/api/agent/store/withdrawals', requireAgent, async (req, res) => {
  const amount = Number(Number(req.body?.amount).toFixed(2));
  const requestId = String(req.body?.requestId || '').trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: 'Enter a transfer amount greater than zero.' });
  }
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestId)) {
    return res.status(400).json({ ok: false, error: 'A valid transfer request ID is required.' });
  }

  const existingRequest = await db.collection('store_withdrawals').findOne({
    agentId: req.user.id,
    requestId,
  });
  if (existingRequest) return res.status(200).json({ ok: true, withdrawal: existingRequest });

  const now = new Date().toISOString();
  const withdrawal = {
    id: makeId('wdr'),
    requestId,
    agentId: req.user.id,
    transferType: 'wallet',
    amount,
    status: 'Pending',
    createdAt: now,
    updatedAt: now,
  };
  try {
    await reserveStoreWithdrawal(withdrawal);
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await db.collection('store_withdrawals').findOne({ agentId: req.user.id, requestId });
      if (duplicate) return res.status(200).json({ ok: true, withdrawal: duplicate });
    }
    if (error instanceof Error && /balance is insufficient/i.test(error.message)) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    console.error('Mini-store wallet transfer reservation failed:', error);
    return res.status(500).json({ ok: false, error: 'Unable to reserve funds for this transfer.' });
  }
  return res.status(201).json({ ok: true, withdrawal });
});

app.get('/api/public/store/:slug', async (req, res) => {
  const store = await db?.collection('agent_stores').findOne({ slug: String(req.params.slug).toLowerCase(), isActive: { $ne: false } });
  if (!store) return res.status(404).json({ ok: false, error: 'Store not found.' });
  const products = await db.collection('products').find({ enabled: { $ne: false } }).toArray();
  const pricing = await getStorePricing(String(store._id || store.agentId), products);
  res.json({ ok: true, store: { id: String(store._id || store.agentId), storeName: store.storeName, whatsappNumber: store.whatsappNumber, contactPhone: store.contactPhone, slug: store.slug }, packages: pricing.filter((product) => Number.isFinite(product.customPrice) && product.customPrice > 0) });
});

app.get('/api/public/order-status', async (req, res) => {
  const reference = String(req.query?.reference || '').trim();
  const slug = String(req.query?.slug || '').trim().toLowerCase();
  if (!reference || !slug) return res.status(400).json({ ok: false, error: 'Order reference and store slug are required.' });
  const store = await db?.collection('agent_stores').findOne({ slug, isActive: { $ne: false } });
  const order = await db?.collection('orders').findOne({ reference, source: 'mini-store', storeId: store ? String(store._id || store.agentId) : '' });
  if (!store || !order) return res.status(404).json({ ok: false, error: 'Order not found.' });
  res.json({ ok: true, paid: order.paid === true, status: order.status, reference, store: { storeName: store.storeName, whatsappNumber: store.whatsappNumber, contactPhone: store.contactPhone } });
});

app.post('/api/public/checkout', async (req, res) => {
  const storeId = String(req.body?.storeId || '');
  const packageId = String(req.body?.packageId || '');
  const recipientPhone = String(req.body?.recipientPhone || '').trim();
  const storeIds = [{ agentId: storeId }];
  if (ObjectId.isValid(storeId)) storeIds.unshift({ _id: new ObjectId(storeId) });
  const store = await db?.collection('agent_stores').findOne({ $or: storeIds, isActive: { $ne: false } });
  const product = await db?.collection('products').findOne({ id: packageId, enabled: { $ne: false } });
  if (!store || !product || !recipientPhone) return res.status(400).json({ ok: false, error: 'Valid store, package, and recipient phone are required.' });
  const agent = await getUserById(String(store.agentId));
  if (!agent) return res.status(404).json({ ok: false, error: 'The store owner account was not found.' });
  const storeKey = String(store._id || store.agentId);
  const [priced] = await getStorePricing(storeKey, [product]);
  const chargedPrice = Number(priced.customPrice);
  const basePrice = Number(priced.basePrice);
  const commission = Number(Math.max(0, chargedPrice - basePrice).toFixed(2));
  const reference = `STORE_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const order = {
    id: makeId('ord'),
    userId: agent.id,
    username: agent.username || agent.fullName || agent.email,
    userEmail: agent.email || '',
    storeId: storeKey,
    packageId,
    packageName: product.name,
    size: product.size,
    network: product.network,
    recipient: recipientPhone,
    source: 'mini-store',
    status: 'PaymentPending',
    paid: false,
    amount: chargedPrice,
    basePrice,
    chargedPrice,
    agentCommission: commission,
    reference,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  await db.collection('orders').insertOne(order);
  if (!PAYSTACK_SECRET) return res.status(503).json({ ok: false, error: 'Paystack is not configured.' });
  try {
    const callbackBase = String(PAYSTACK_CALLBACK_URL || ALLENDAHUB_FRONTEND_URL).replace(/\/payment-return\/?$/, '').replace(/\/$/, '');
    const callbackUrl = `${callbackBase}/s/${encodeURIComponent(store.slug)}?reference=${encodeURIComponent(reference)}`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${order.id}@guest.allendatahub.com`, amount: Math.round(chargedPrice * 100), reference, callback_url: callbackUrl, metadata: { project: 'ALLENDATAHUB', source: 'mini-store', orderId: order.id, storeId: storeKey, agentId: agent.id, agentEmail: agent.email || '', agentUsername: agent.username || '', commission } }) });
    const data = await response.json();
    if (!data.status) throw new Error(data.message || 'Paystack initialization failed.');
    await db.collection('orders').updateOne({ id: order.id }, { $set: { authorizationUrl: data.data.authorization_url, initializedAt: new Date().toISOString() } });
    res.status(201).json({ ok: true, authorizationUrl: data.data.authorization_url, reference, orderId: order.id });
  } catch (error) {
    await db.collection('orders').updateOne({ id: order.id }, { $set: { status: 'Failed', paymentError: error instanceof Error ? error.message : 'Paystack initialization failed.' } });
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Paystack initialization failed.' });
  }
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
  const visiblePaidStoreOrder = { $or: [{ source: { $ne: 'mini-store' } }, { source: 'mini-store', paid: true }] };
  const filter = req.user.role === 'admin'
    ? visiblePaidStoreOrder
    : { userId: req.user.id, ...visiblePaidStoreOrder };
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
          ...(order.source === 'mini-store' ? {
            amount: Number(order.basePrice ?? order.amount ?? 0),
            chargedPrice: undefined,
            agentCommission: undefined,
          } : {}),
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

  const normalizedNetwork = String(network).trim();
  const requestedSize = String(size).trim();
  const product = await db.collection('products').findOne({
    network: normalizedNetwork,
    $or: [
      { size: requestedSize },
      { size: requestedSize.replace(/\s+/g, '') },
      { size: requestedSize.replace(/gb$/i, ' GB') },
    ],
    enabled: { $ne: false },
  });
  if (!product) return res.status(404).json({ ok: false, error: 'Package not found.' });

  const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
  if (idempotencyKey) {
    const existing = await db.collection('orders').findOne({ userId: req.user.id, source: 'api', idempotencyKey });
    if (existing) return res.status(200).json({ ok: true, duplicate: true, order: existing, walletBalance: req.user.walletBalance });
  }

  const orderPrice = getApiPriceForProduct(req.user, product, req.apiConfig);
  const apiRequest = Object.create(req);
  apiRequest.body = {
    ...req.body,
    network: normalizedNetwork,
    size: product.size,
    amount: orderPrice,
    packageName: packageName || product.name,
    source: 'api',
  };
  try {
    return await createSingleOrder(apiRequest, res);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      tag: 'ALLENDAHUB_API_ORDER_FAILED',
      userId: req.user?.id || null,
      network: normalizedNetwork,
      size: requestedSize,
      recipient: String(recipient).replace(/\d(?=\d{4})/g, '*'),
      error: error instanceof Error ? error.stack || error.message : errorMessage,
    }));
    if (res.headersSent) return;
    return res.status(500).json({
      ok: false,
      error: 'AllenDataHub could not process this order.',
      code: 'ORDER_PROCESSING_FAILED',
      reason: errorMessage,
      retryable: true,
      retryWithSameIdempotencyKey: true,
    });
  }
});

app.get('/api/v1/orders/:id', requireApiKey, async (req, res) => {
  const order = await db.collection('orders').findOne({ id: req.params.id, userId: req.user.id, source: 'api' });
  if (!order) return res.status(404).json({ ok: false, error: 'API order not found.' });
  res.json({ ok: true, order });
});

async function createSingleOrder(req, res) {
  const { recipient, size, amount, network, packageName, source = 'web' } = req.body || {};
  const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
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
  const vendorReference = makeHubnetReference();

  const order = {
    id: orderId,
    size: size || '',
    recipient,
    network,
    status: 'Pending',
    source: source === 'api' ? 'api' : 'web',
    paid: false,
    amount: chargedAmount,
    balBefore,
    balAfter,
    date: new Date().toISOString(),
    userId: user.id,
    packageName: packageName || '',
    reference: vendorReference,
    ...(idempotencyKey && source === 'api' ? { idempotencyKey } : {}),
    createdAt: new Date().toISOString(),
  };

  await db.collection('orders').insertOne(order);

  let debitResult;
  try {
    debitResult = await debitWalletBalance(user.id, chargedAmount);
  } catch (error) {
    await db.collection('orders').updateOne(
      { id: orderId },
      { $set: { status: 'Failed', paymentError: 'Wallet debit could not be completed.', updatedAt: new Date().toISOString() } },
    );
    console.error('Wallet debit transaction failed:', error);
    return res.status(503).json({ ok: false, error: 'Wallet payment could not be completed. Please try again.' });
  }
  if (!debitResult.ok) {
    await db.collection('orders').updateOne(
      { id: orderId },
      { $set: { status: 'Failed', paymentError: 'Wallet balance changed before payment was completed.', updatedAt: new Date().toISOString() } },
    );
    return res.status(409).json({ ok: false, error: 'Wallet balance changed. Please try again.' });
  }

  const actualBalAfter = debitResult.walletBalance;
  await db.collection('orders').updateOne(
    { id: orderId },
    { $set: { paid: true, balBefore, balAfter: actualBalAfter, commissionWalletDebit: debitResult.commissionDebited, updatedAt: new Date().toISOString() } },
  );

  const hubnetResult = await purchaseWithHubnet({
    phone: recipient,
    size,
    network,
    reference: vendorReference,
    webhookUrl: `${HUBNET_BACKEND_URL.replace(/\/$/, '')}/api/webhooks/hubnet`,
  });

  if (!hubnetResult.success) {
    const hubnetErrorMessage = normalizeHubnetOrderErrorMessage(hubnetResult.error);
    await db.collection('orders').updateOne({ id: orderId }, { $set: { status: 'Failed', vendorError: hubnetErrorMessage, vendorStatus: 'failed', updatedAt: new Date().toISOString() } });
    return res.status(Number(hubnetResult.statusCode || 502)).json({ ok: false, error: hubnetErrorMessage });
  }

  await db.collection('orders').updateOne(
    { id: orderId },
    {
      $set: {
        vendorOrderId: hubnetResult.transactionId,
        vendorReference: hubnetResult.reference,
        vendorStatus: hubnetResult.status,
        vendorResponse: hubnetResult.raw,
        status: 'Pending',
        updatedAt: new Date().toISOString(),
      },
    }
  );

  await createNotification(user.id, 'Order placed', `${size} for ${recipient} on ${network}.`, 'order');

  if (user.referredBy) {
    await applyReferralCommission(user.referredBy, chargedAmount);
  }

  return res.status(201).json({ ok: true, order: { ...order, balAfter: actualBalAfter, paid: true, vendorOrderId: hubnetResult.transactionId, vendorStatus: hubnetResult.status }, walletBalance: actualBalAfter, vendorResult: hubnetResult });
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
      paid: false,
      amount: orderAmount,
      balBefore: runningBalance,
      balAfter,
      date: new Date().toISOString(),
      userId: user.id,
      packageName: item.packageName || '',
      reference: makeHubnetReference(),
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    runningBalance = balAfter;
  }

  await db.collection('orders').insertMany(orders);

  let debitResult;
  try {
    debitResult = await debitWalletBalance(user.id, total);
  } catch (error) {
    await db.collection('orders').updateMany(
      { id: { $in: orders.map((order) => order.id) } },
      { $set: { status: 'Failed', paymentError: 'Wallet debit could not be completed.', updatedAt: new Date().toISOString() } },
    );
    console.error('Cart wallet debit transaction failed:', error);
    return res.status(503).json({ ok: false, error: 'Wallet payment could not be completed. Please try again.' });
  }
  if (!debitResult.ok) {
    await db.collection('orders').updateMany(
      { id: { $in: orders.map((order) => order.id) } },
      { $set: { status: 'Failed', paymentError: 'Wallet balance changed before payment was completed.', updatedAt: new Date().toISOString() } },
    );
    return res.status(409).json({ ok: false, error: 'Wallet balance changed. Please try again.' });
  }

  const actualRunningBalance = debitResult.walletBalance;
  let remainingCommissionDebit = debitResult.commissionDebited;
  for (const order of orders) {
    order.paid = true;
    order.commissionWalletDebit = Number(Math.min(Number(order.amount || 0), remainingCommissionDebit).toFixed(2));
    remainingCommissionDebit = Number((remainingCommissionDebit - order.commissionWalletDebit).toFixed(2));
    await db.collection('orders').updateOne(
      { id: order.id },
      { $set: { paid: true, commissionWalletDebit: order.commissionWalletDebit, updatedAt: new Date().toISOString() } },
    );
  }

  for (const order of orders) {
    const hubnetResult = await purchaseWithHubnet({
      phone: order.recipient,
      size: order.size,
      network: order.network,
      reference: order.reference,
      webhookUrl: `${HUBNET_BACKEND_URL.replace(/\/$/, '')}/api/webhooks/hubnet`,
    });

    if (!hubnetResult.success) {
      order.status = 'Failed';
      const hubnetErrorMessage = normalizeHubnetOrderErrorMessage(hubnetResult.error);
      await db.collection('orders').updateOne(
        { id: order.id },
        { $set: { status: 'Failed', vendorError: hubnetErrorMessage, vendorStatus: 'failed', updatedAt: new Date().toISOString() } },
      );
      if (hubnetResult.statusCode === 409) {
        return res.status(409).json({ ok: false, error: hubnetErrorMessage });
      }
      continue;
    }

    order.vendorOrderId = hubnetResult.transactionId;
    order.vendorReference = hubnetResult.reference;
    order.vendorStatus = hubnetResult.status;
    order.vendorResponse = hubnetResult.raw;
    await db.collection('orders').updateOne(
      { id: order.id },
      { $set: { vendorOrderId: hubnetResult.transactionId, vendorReference: hubnetResult.reference, vendorStatus: hubnetResult.status, vendorResponse: hubnetResult.raw, updatedAt: new Date().toISOString() } },
    );
  }

  await createNotification(user.id, 'Cart checkout', `${orders.length} order(s) placed from cart.`, 'order');

  if (user.referredBy) {
    await applyReferralCommission(user.referredBy, total);
  }

  res.status(201).json({ ok: true, orders, walletBalance: actualRunningBalance });
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

  const hubnetCancelResult = cancelHubnetOrder();

  if (!hubnetCancelResult.success) {
    console.error(JSON.stringify({
      tag: 'ALLENDAHUB_CANCEL_BLOCKED',
      orderId: id,
      vendorOrderId: order.vendorOrderId || order.portalOrderId || null,
      vendorReference: order.vendorReference || order.portalReference || order.reference || null,
      reason: hubnetCancelResult.error,
    }));
    return res.status(502).json({
      ok: false,
      error: 'Unable to cancel this order right now. Please try again.',
      hubnetCancelResult,
    });
  }

  await db.collection('users').updateOne({ id: user.id }, { $set: { walletBalance: balAfter } });
  await db.collection('orders').updateOne({ id }, {
    $set: {
      status: 'Cancelled',
      balAfter,
      vendorCancelStatus: 'cancelled',
      vendorCancelResponse: hubnetCancelResult,
      vendorCancelError: null,
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
    hubnetCancelResult,
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
  if (!user) return res.status(404).json({ ok: false, error: 'Order owner not found.' });
  const refundAmount = Number(order.amount || 0);
  const commissionRefund = Math.max(0, Number(order.commissionWalletDebit || 0));
  const session = client.startSession();
  let refund;
  let balAfter;
  try {
    await session.withTransaction(async () => {
      refund = undefined;
      balAfter = undefined;
      const orderClaim = await db.collection('orders').updateOne(
        { id, status: { $nin: ['Refunded', 'Cancelled', 'Canceled'] } },
        { $set: { status: 'Refunded', updatedAt: new Date().toISOString() } },
        { session },
      );
      if (orderClaim.modifiedCount !== 1) return;

      const currentUser = await db.collection('users').findOne({ id: user.id }, { session, projection: { walletBalance: 1 } });
      if (!currentUser) throw new Error('Order owner not found during refund.');
      const balBefore = Number(currentUser.walletBalance || 0);
      const walletCredit = await db.collection('users').updateOne(
        { id: user.id },
        { $inc: { walletBalance: refundAmount } },
        { session },
      );
      if (walletCredit.modifiedCount !== 1) throw new Error('Unable to credit the refunded wallet balance.');

      if (commissionRefund > 0) {
        const commissionCredit = await db.collection('agent_stores').updateOne(
          { agentId: user.id },
          { $inc: { walletBalance: commissionRefund } },
          { session },
        );
        if (commissionCredit.modifiedCount !== 1) throw new Error('Unable to restore mini-store commission balance for this refund.');
      }

      const creditedUser = await db.collection('users').findOne({ id: user.id }, { session, projection: { walletBalance: 1 } });
      balAfter = Number(creditedUser?.walletBalance || 0);
      await db.collection('orders').updateOne({ id }, { $set: { balAfter }, $unset: { commissionWalletDebit: '' } }, { session });
      refund = {
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
      await db.collection('refunds').insertOne(refund, { session });
    });
  } catch (error) {
    console.error(`Order refund transaction failed for ${id}:`, error);
    return res.status(500).json({ ok: false, error: 'Unable to complete this refund. Please try again.' });
  } finally {
    await session.endSession();
  }
  if (!refund) return res.status(409).json({ ok: false, error: 'Order already refunded.' });
  await createNotification(user.id, 'Order refunded', `GHS ${refundAmount.toFixed(2)} returned to your wallet for order ${id}.`, 'refund');

  res.json({ ok: true, refund, walletBalance: balAfter, orderStatus: 'Refunded' });
});

// ─── Deposits ───────────────────────────────────────────────────────────────

app.get('/api/deposits', requireUser, async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
  const deposits = await db.collection('deposits').find(filter).sort({ date: -1 }).toArray();
  res.json({ ok: true, deposits });
});

app.post('/api/payments/mtn-momo/initialize', requireUser, async (req, res) => {
  const amount = Number(req.body?.amount || 0);
  const phone = normalizeMtnMomoPhone(req.body?.phone || req.user.momo || req.user.phone);
  if (amount < 5 || !Number.isFinite(amount)) {
    return res.status(400).json({ ok: false, error: 'Minimum top-up is GHS 5.' });
  }
  if (!phone) {
    return res.status(400).json({ ok: false, error: 'Enter a valid Ghana mobile money number.' });
  }
  const missing = getMtnMomoMissingConfiguration();
  if (missing.length) {
    return res.status(503).json({ ok: false, error: `MTN MoMo Collections is not configured. Set ${missing.join(', ')} on the server.` });
  }

  const creditAmount = Number(amount.toFixed(2));
  const fee = Number((creditAmount * 0.03).toFixed(2));
  const totalPay = Number((creditAmount + fee).toFixed(2));
  const reference = `MTN-${crypto.randomUUID()}`;
  const mtnReferenceId = crypto.randomUUID();
  const now = new Date().toISOString();
  const deposit = {
    id: makeId('dep'),
    userId: req.user.id,
    amount: creditAmount,
    fee,
    totalPay,
    method: 'mobile_money',
    platform: 'mtn-momo',
    reference,
    mtnReferenceId,
    phone,
    status: 'Pending',
    balBefore: Number(req.user.walletBalance || 0),
    balAfter: Number(req.user.walletBalance || 0),
    handledBy: 'mtn-momo',
    metadata: { project: 'ALLENDATAHUB', userId: req.user.id },
    date: now,
    createdAt: now,
  };
  await db.collection('deposits').insertOne(deposit);

  try {
    const { response } = await requestMtnMomo('collection', '/collection/v1_0/requesttopay', {
      method: 'POST',
      headers: { 'X-Reference-Id': mtnReferenceId },
      body: JSON.stringify({
        amount: totalPay.toFixed(2),
        currency: 'GHS',
        externalId: reference,
        payer: { partyIdType: 'MSISDN', partyId: phone },
        payerMessage: 'AllenDataHub wallet top-up',
        payeeNote: 'Wallet funding',
      }),
    });
    await db.collection('deposits').updateOne(
      { reference, status: 'Pending' },
      { $set: { initializedAt: new Date().toISOString() } },
    );
    return res.status(202).json({
      ok: true,
      pending: true,
      reference,
      amount: creditAmount,
      totalPay,
      message: 'Approve the MTN MoMo payment prompt on your phone.',
      providerStatus: response.status,
    });
  } catch (error) {
    if (error instanceof MtnMomoError && error.status >= 400 && error.status < 500) {
      await db.collection('deposits').updateOne(
        { reference, status: 'Pending' },
        { $set: { status: 'Failed', paymentError: error.message, updatedAt: new Date().toISOString() } },
      );
      return res.status(502).json({ ok: false, error: error.message });
    }

    await db.collection('deposits').updateOne(
      { reference, status: 'Pending' },
      { $set: { initializationUnknown: true, paymentError: error instanceof Error ? error.message : 'MTN MoMo response was not received.' } },
    );
    return res.status(202).json({
      ok: true,
      pending: true,
      reference,
      amount: creditAmount,
      totalPay,
      message: 'MTN MoMo has not confirmed the request yet. Check the payment status before trying again.',
    });
  }
});

app.post('/api/payments/mtn-momo/verify', requireUser, async (req, res) => {
  const reference = String(req.body?.reference || '').trim();
  if (!reference) return res.status(400).json({ ok: false, error: 'Reference is required.' });
  const deposit = await db.collection('deposits').findOne({
    reference,
    userId: req.user.id,
    platform: 'mtn-momo',
  });
  if (!deposit) return res.status(404).json({ ok: false, error: 'MTN MoMo deposit not found.' });
  if (deposit.status === 'Completed' || deposit.status === 'Credited') {
    const user = await getUserById(req.user.id);
    return res.json({ ok: true, verified: true, reference, walletBalance: user?.walletBalance });
  }
  if (deposit.status === 'Failed') {
    return res.json({ ok: true, failed: true, reference, error: deposit.paymentError || 'MTN MoMo payment failed.' });
  }
  if (!deposit.mtnReferenceId) {
    return res.status(409).json({ ok: false, error: 'MTN MoMo request reference is missing.' });
  }

  let providerPayment;
  try {
    const result = await requestMtnMomo(
      'collection',
      `/collection/v1_0/requesttopay/${encodeURIComponent(deposit.mtnReferenceId)}`,
      { method: 'GET' },
    );
    providerPayment = result.data;
  } catch (error) {
    if (error instanceof MtnMomoError && error.status === 404 && deposit.initializationUnknown) {
      return res.status(202).json({ ok: true, pending: true, reference, message: 'MTN MoMo has not confirmed the payment request yet.' });
    }
    return res.status(error instanceof MtnMomoError && error.status >= 400 && error.status < 500 ? 502 : 503).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to check MTN MoMo payment status.',
    });
  }

  const status = String(providerPayment.status || '').toUpperCase();
  if (status === 'FAILED') {
    await db.collection('deposits').updateOne(
      { reference, status: 'Pending' },
      { $set: { status: 'Failed', paymentError: providerPayment.reason || 'MTN MoMo payment failed.', updatedAt: new Date().toISOString() } },
    );
    return res.json({ ok: true, failed: true, reference, error: providerPayment.reason || 'MTN MoMo payment failed.' });
  }
  if (status !== 'SUCCESSFUL') {
    if (!['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(status)) {
      return res.status(502).json({ ok: false, error: `MTN MoMo returned an unrecognized payment status: ${status || 'empty'}.` });
    }
    return res.status(202).json({ ok: true, pending: true, reference, status });
  }

  if (
    Number(providerPayment.amount) !== Number(deposit.totalPay ?? deposit.amount)
    || providerPayment.currency !== 'GHS'
    || String(providerPayment.externalId || '') !== reference
  ) {
    return res.status(400).json({ ok: false, error: 'Verified MTN MoMo payment does not match this wallet deposit.' });
  }

  const creditResult = await creditWalletForSuccessfulDeposit({
    userId: req.user.id,
    amount: Number(deposit.amount),
    reference,
    source: 'mtn_momo_verification',
    metadata: { providerStatus: status, mtnReferenceId: deposit.mtnReferenceId },
    platform: 'mtn-momo',
    method: 'mobile_money',
    sendSms: false,
  });
  if (!creditResult.ok) {
    return res.status(creditResult.pending ? 202 : 400).json({
      ok: true,
      pending: Boolean(creditResult.pending),
      error: creditResult.error,
      reference,
    });
  }
  return res.json({
    ok: true,
    verified: true,
    alreadyProcessed: Boolean(creditResult.alreadyProcessed),
    reference,
    walletBalance: creditResult.balAfter,
    message: 'MTN MoMo payment verified and wallet credited.',
  });
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

  const fee = Number((amount * 0.03).toFixed(2));
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
    return res.status(503).json({
      ok: false,
      error: 'Paystack is not configured. Wallet funding is temporarily unavailable.',
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
  const expectedSignature = PAYSTACK_SECRET
    ? crypto.createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex')
    : '';
  const signatureValid = Boolean(PAYSTACK_SECRET && signature) && signature.length === expectedSignature.length && crypto.timingSafeEqual(
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
  const storeId = String(metadata.storeId || '');

  if (storeId) {
    const orderId = String(metadata.orderId || '');
    const order = orderId
      ? await db?.collection('orders').findOne({ id: orderId, storeId, source: 'mini-store' })
      : null;
    const storeIds = [{ agentId: storeId }];
    if (ObjectId.isValid(storeId)) storeIds.unshift({ _id: new ObjectId(storeId) });
    const store = await db?.collection('agent_stores').findOne({ $or: storeIds });
    if (!order || !store) return res.status(400).json({ ok: false, error: 'Mini-store order or store not found.' });
    if (order.paid === true) {
      try {
        await creditStoreCommission(order);
      } catch (error) {
        console.error('Mini-store commission credit failed:', error);
        return res.status(500).json({ ok: false, error: 'Payment was confirmed, but commission credit failed. Paystack may retry this callback.' });
      }
    }
    if (order.paid === true && (order.status === 'Failed' || order.fulfillmentStatus === 'failed')) {
      return res.json({ ok: true, ignored: true, reason: 'This order has already failed and will not be resent.' });
    }
    if (order.vendorOrderId || order.portalOrderId || order.fulfillmentStatus === 'dispatching') {
      return res.json({ ok: true, alreadyProcessed: true });
    }
    const ownership = { userId: order.userId || store.agentId };
    if (order.username) ownership.username = order.username;
    if (order.userEmail) ownership.userEmail = order.userEmail;
    if (order.paid !== true) {
      await db.collection('orders').updateOne(
        { id: order.id, source: 'mini-store', paid: { $ne: true }, status: { $in: ['PaymentPending', 'Paid', 'Failed'] }, fulfillmentStatus: { $nin: ['dispatching', 'failed'] } },
        { $set: { ...ownership, paid: true, status: 'Paid', paidAt: new Date().toISOString(), paymentReference: reference } },
      );
    }
    const paidOrder = await db.collection('orders').findOne({ id: order.id, source: 'mini-store', paid: true });
    if (!paidOrder) {
      return res.json({ ok: true, alreadyProcessed: true });
    }
    try {
      await creditStoreCommission(paidOrder);
    } catch (error) {
      console.error('Mini-store commission credit failed:', error);
      return res.status(500).json({ ok: false, error: 'Payment was confirmed, but commission credit failed. Paystack may retry this callback.' });
    }

    const dispatchClaim = await db.collection('orders').updateOne(
      { id: order.id, source: 'mini-store', paid: true, status: 'Paid', vendorOrderId: { $exists: false }, portalOrderId: { $exists: false }, fulfillmentStatus: { $nin: ['dispatching', 'failed'] } },
      { $set: { fulfillmentStatus: 'dispatching', fulfillmentClaimedAt: new Date().toISOString() } },
    );
    if (dispatchClaim.modifiedCount === 0) {
      return res.json({ ok: true, alreadyProcessed: true });
    }

    const hubnetResult = await purchaseWithHubnet({
      phone: order.recipient,
      size: order.size,
      network: order.network,
      reference: order.reference,
      webhookUrl: `${HUBNET_BACKEND_URL.replace(/\/$/, '')}/api/webhooks/hubnet`,
    });
    if (!hubnetResult.success) {
      await db.collection('orders').updateOne({ id: order.id }, { $set: { status: 'Failed', fulfillmentStatus: 'failed', vendorError: normalizeHubnetOrderErrorMessage(hubnetResult.error), updatedAt: new Date().toISOString() } });
      return res.status(502).json({ ok: false, error: 'Payment received, but bundle dispatch failed.', details: hubnetResult.error });
    }

    const orderCompleted = ['delivered', 'success', 'successful', 'completed', 'resolved'].includes(String(hubnetResult.status || '').toLowerCase());
    await db.collection('orders').updateOne({ id: order.id }, { $set: { status: orderCompleted ? 'Completed' : 'Pending', fulfillmentStatus: orderCompleted ? 'completed' : 'submitted', vendorOrderId: hubnetResult.transactionId, vendorReference: hubnetResult.reference, vendorStatus: hubnetResult.status, vendorResponse: hubnetResult.raw, updatedAt: new Date().toISOString() } });
    if (orderCompleted) {
      const completedOrder = await db.collection('orders').findOne({ id: order.id });
      if (completedOrder) await sendOrderCompletedSms(completedOrder);
    }
    return res.json({ ok: true, forwarded: true, storeOrder: true });
  }

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
    const result = await creditWalletForSuccessfulDeposit({
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

app.post('/api/payments/paystack/verify', requireUser, async (req, res) => {
  const { reference } = req.body || {};
  if (!reference) return res.status(400).json({ ok: false, error: 'Reference is required.' });

  const deposit = await db.collection('deposits').findOne({ reference, userId: req.user.id });
  if (!deposit) return res.status(404).json({ ok: false, error: 'Deposit not found.' });
  if (deposit.status === 'Credited' || deposit.status === 'Completed') {
    await sendPaystackDepositSms(deposit);
    const user = await getUserById(req.user.id);
    return res.json({ ok: true, alreadyCredited: true, balBefore: deposit.balBefore, balAfter: user.walletBalance, deposit });
  }

  let verifiedPayment;
  let verified = false;
  if (PAYSTACK_SECRET) {
    try {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const data = await verifyRes.json();
      verified = data.status && data.data?.status === 'success';
      verifiedPayment = data.data;
    } catch {
      verified = false;
    }
  }

  if (!verified) {
    return res.status(202).json({ ok: true, pending: true, reference, deposit });
  }

  const expectedTotalPay = Number(deposit.totalPay ?? deposit.amount);
  const expectedAmountPesewas = Math.round(expectedTotalPay * 100);
  if (
    verifiedPayment?.reference !== reference
    || verifiedPayment?.currency !== 'GHS'
    || !Number.isFinite(expectedAmountPesewas)
    || Number(verifiedPayment?.amount) !== expectedAmountPesewas
  ) {
    return res.status(400).json({ ok: false, error: 'Verified payment does not match this wallet deposit.' });
  }

  const creditResult = await creditWalletForSuccessfulDeposit({
    userId: req.user.id,
    amount: Number(deposit.amount),
    reference,
    source: 'paystack_verification',
    metadata: {
      project: 'ALLENDATAHUB',
      event: 'charge.success',
      amountPesewas: Number(verifiedPayment.amount),
      verifiedByApi: true,
    },
  });
  if (!creditResult.ok) {
    if (creditResult.pending) {
      return res.status(202).json({ ok: true, pending: true, reference, deposit });
    }
    return res.status(400).json({ ok: false, error: creditResult.error || 'Unable to credit wallet.' });
  }

  return res.json({
    ok: true,
    verified: true,
    pending: false,
    alreadyProcessed: Boolean(creditResult.alreadyProcessed),
    reference,
    deposit: creditResult.deposit || deposit,
    walletBalance: creditResult.balAfter,
    message: 'Payment verified and wallet credited.',
  });
});

app.post('/api/payments/paystack/complete', requireUser, async (req, res) => {
  const { reference } = req.body || {};
  if (!reference) return res.status(400).json({ ok: false, error: 'Reference is required.' });

  const deposit = await db.collection('deposits').findOne({ reference, userId: req.user.id });
  if (!deposit) return res.status(404).json({ ok: false, error: 'Deposit not found.' });

  if (deposit.status === 'Credited' || deposit.status === 'Completed') {
    await sendPaystackDepositSms(deposit);
    return res.json({ ok: true, alreadyProcessed: true, reference, deposit, message: 'Wallet credit was processed by the Paystack webhook.' });
  }

  let verifiedPayment;
  let verified = false;
  if (PAYSTACK_SECRET) {
    try {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      });
      const data = await verifyRes.json();
      verified = data.status && data.data?.status === 'success';
      verifiedPayment = data.data;
    } catch {
      verified = false;
    }
  }

  if (!verified) {
    return res.status(202).json({ ok: true, pending: true, reference, deposit });
  }

  const expectedTotalPay = Number(deposit.totalPay ?? deposit.amount);
  const expectedAmountPesewas = Math.round(expectedTotalPay * 100);
  if (
    verifiedPayment?.reference !== reference
    || verifiedPayment?.currency !== 'GHS'
    || !Number.isFinite(expectedAmountPesewas)
    || Number(verifiedPayment?.amount) !== expectedAmountPesewas
  ) {
    return res.status(400).json({ ok: false, error: 'Verified payment does not match this wallet deposit.' });
  }

  const creditResult = await creditWalletForSuccessfulDeposit({
    userId: req.user.id,
    amount: Number(deposit.amount),
    reference,
    source: 'paystack_verification',
    metadata: {
      project: 'ALLENDATAHUB',
      event: 'charge.success',
      amountPesewas: Number(verifiedPayment.amount),
      verifiedByApi: true,
    },
  });
  if (!creditResult.ok) {
    if (creditResult.pending) {
      return res.status(202).json({ ok: true, pending: true, reference, deposit });
    }
    return res.status(400).json({ ok: false, error: creditResult.error || 'Unable to credit wallet.' });
  }

  return res.json({
    ok: true,
    verified: true,
    pending: false,
    alreadyProcessed: Boolean(creditResult.alreadyProcessed),
    reference,
    deposit: creditResult.deposit || deposit,
    walletBalance: creditResult.balAfter,
    message: 'Payment verified and wallet credited.',
  });
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

app.get('/api/admin/store-withdrawals', requireAdmin, async (_req, res) => {
  const withdrawals = await db.collection('store_withdrawals')
    .find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  const agents = await db.collection('users')
    .find({ id: { $in: withdrawals.map((entry) => entry.agentId) } })
    .project({ id: 1, fullName: 1, username: 1, email: 1 })
    .toArray();
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  res.json({
    ok: true,
    withdrawals: withdrawals.map(({ mtnReferenceId: _mtnReferenceId, ...withdrawal }) => ({
      ...withdrawal,
      agent: agentsById.get(withdrawal.agentId) || null,
    })),
  });
});

app.get('/api/admin/store-commissions', requireAdmin, async (_req, res) => {
  const commissions = await db.collection('store_ledger')
    .find({ type: 'commission' })
    .sort({ createdAt: -1 })
    .toArray();
  const storeObjectIds = commissions
    .map((entry) => String(entry.storeId || ''))
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const stores = await db.collection('agent_stores')
    .find({
      $or: [
        {
          agentId: {
            $in: commissions.flatMap((entry) => [
              entry.agentId,
              ObjectId.isValid(String(entry.storeId || '')) ? null : entry.storeId,
            ]).filter(Boolean),
          },
        },
        { _id: { $in: storeObjectIds } },
      ],
    })
    .toArray();
  const storesByKey = new Map(stores.map((store) => [String(store._id || store.agentId), store]));
  const agentIds = [...new Set(commissions.map((entry) => entry.agentId || storesByKey.get(String(entry.storeId))?.agentId).filter(Boolean))];
  const orderIds = [...new Set(commissions.map((entry) => entry.orderId).filter(Boolean))];
  const [agents, orders] = await Promise.all([
    db.collection('users').find({ id: { $in: agentIds } })
      .project({ id: 1, fullName: 1, username: 1, email: 1 })
      .toArray(),
    db.collection('orders').find({ id: { $in: orderIds } })
      .project({ id: 1, status: 1, network: 1, size: 1, recipient: 1 })
      .toArray(),
  ]);
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  res.json({
    ok: true,
    commissions: commissions.map((entry) => {
      const agentId = entry.agentId || storesByKey.get(String(entry.storeId))?.agentId;
      return {
        id: entry.id,
        orderId: entry.orderId,
        reference: entry.reference,
        amount: entry.amount,
        createdAt: entry.createdAt,
        agent: agentsById.get(agentId) || null,
        order: ordersById.get(entry.orderId) || null,
      };
    }),
  });
});

app.post('/api/admin/store-withdrawals/:id/approve', requireAdmin, async (req, res) => {
  const withdrawal = await db.collection('store_withdrawals').findOne({ id: req.params.id });
  if (!withdrawal) return res.status(404).json({ ok: false, error: 'Withdrawal request not found.' });
  if (withdrawal.status !== 'Pending') {
    return res.status(409).json({ ok: false, error: `Withdrawal is ${withdrawal.status.toLowerCase()}.` });
  }
  if (withdrawal.transferType !== 'wallet') {
    return res.status(409).json({ ok: false, error: 'This legacy MoMo payout request cannot be approved as a wallet transfer. Reject it and ask the agent to submit a new request.' });
  }
  try {
    const approval = await approveStoreWalletTransfer(withdrawal, req.user.id);
    if (!approval) return res.status(409).json({ ok: false, error: 'This transfer request has already been handled.' });
    const notificationMessage = `Your mini-store transfer of GHS ${Number(approval.approvedAmount).toFixed(2)} was approved. Your current wallet balance is GHS ${Number(approval.walletBalanceAfter).toFixed(2)}.`;
    try {
      await createNotification(withdrawal.agentId, 'Mini-store transfer approved', notificationMessage, 'deposit');
    } catch (notificationError) {
      console.error('Mini-store transfer approval notification failed:', notificationError);
    }
    return res.json({
      ok: true,
      status: 'Approved',
      approvedAt: approval.approvedAt,
      approvedAmount: approval.approvedAmount,
      walletBalanceAfter: approval.walletBalanceAfter,
      message: 'Mini-store balance transferred to the agent wallet.',
    });
  } catch (error) {
    console.error('Mini-store wallet transfer approval failed:', error);
    return res.status(500).json({ ok: false, error: 'Unable to transfer the reserved mini-store balance. No transfer was completed.' });
  }
});

app.post('/api/admin/store-withdrawals/:id/reject', requireAdmin, async (req, res) => {
  const withdrawal = await db.collection('store_withdrawals').findOne({ id: req.params.id });
  if (!withdrawal) return res.status(404).json({ ok: false, error: 'Withdrawal request not found.' });
  const released = await releaseStoreWithdrawal(
    withdrawal,
    'Pending',
    'Rejected',
    {
      rejectedBy: req.user.id,
      rejectedAt: new Date().toISOString(),
      rejectionReason: String(req.body?.reason || 'Rejected by administrator').slice(0, 250),
    },
  );
  if (!released) return res.status(409).json({ ok: false, error: 'This withdrawal request has already been handled.' });
  return res.json({ ok: true, message: 'Transfer rejected and reserved mini-store funds returned.' });
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
  if (!userId || !Number.isFinite(value) || value <= 0 || !['credit', 'debit'].includes(type)) {
    return res.status(400).json({ ok: false, error: 'Invalid wallet action.' });
  }

  const user = await getUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });

  const balBefore = Number(user.walletBalance || 0);
  let balAfter;
  if (type === 'debit') {
    const debitResult = await debitWalletBalance(userId, value);
    if (!debitResult.ok) return res.status(400).json({ ok: false, error: debitResult.error });
    balAfter = debitResult.walletBalance;
  } else {
    balAfter = Number((balBefore + value).toFixed(2));
    await db.collection('users').updateOne({ id: userId }, { $set: { walletBalance: balAfter } });
  }

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

app.post('/api/webhooks/hubnet', async (req, res) => {
  const payload = req.body || {};
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const event = payload?.event || root?.event || 'transfer.status.updated';
  const orderId = root?.transaction_id || payload?.transaction_id || null;
  const reference = root?.reference || payload?.reference || null;
  const status = String(root?.status || payload?.status || 'pending');

  const nextStatus = mapHubnetStatus(event, status);

  if (db) {
    const identifiers = [
      orderId && { id: orderId },
      reference && { reference },
      orderId && { vendorOrderId: orderId },
      reference && { vendorReference: reference },
      orderId && { portalOrderId: orderId },
      reference && { portalReference: reference },
    ].filter(Boolean);
    if (identifiers.length > 0) {
      const existing = await db.collection('orders').findOne({ $or: identifiers });
      const terminalStatuses = ['Completed', 'Failed', 'Cancelled', 'Refunded'];
      if (existing && terminalStatuses.includes(existing.status) && nextStatus !== 'Completed') {
        return res.json({ ok: true, ignored: true, reason: 'Order already has a terminal status.', received: { event, orderId, reference, status: nextStatus }, platform: 'Hubnet' });
      }
      const update = {
        $set: {
          status: nextStatus,
          vendorStatus: status,
          event,
          vendorUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      await db.collection('orders').updateOne({ $or: identifiers }, update, { upsert: false });

      if (nextStatus === 'Completed') {
        const updatedOrder = await db.collection('orders').findOne({ $or: identifiers });
        if (updatedOrder) {
          await sendOrderCompletedSms(updatedOrder);
        }
      }
    }
  }

  res.json({ ok: true, received: { event, orderId, reference, status: nextStatus }, platform: 'Hubnet' });
});

await startMongo();

console.log(`\n🚀 AllenDataHub API Server`);
console.log(JSON.stringify({
  tag: 'ARKESEL_ENV_STATUS',
  hasApiKey: Boolean(ARKESEL_API_KEY),
  hasSenderId: Boolean(ARKESEL_SENDER_ID),
  hasWebhookSecret: Boolean(ARKESEL_WEBHOOK_SECRET),
  senderId: ARKESEL_SENDER_ID || null,
  countryCode: ARKESEL_COUNTRY_CODE,
}));
app.listen(port, '0.0.0.0', () => {
  console.log(`📡 Server listening on 0.0.0.0:${port}`);
  console.log(`🏠 Database name: ${mongoDbName}\n`);
});
