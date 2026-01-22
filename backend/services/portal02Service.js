const axios = require('axios');

class Portal02Service {
  constructor() {
    // ========== CRITICAL CONFIGURATION ==========
    this.apiKey = process.env.PORTAL02_API_KEY || 'dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH';
    this.baseURL = process.env.PORTAL02_BASE_URL || 'https://www.portal-02.com/api/v1';
    this.backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://allen-data-hub-backend.onrender.com'; // Changed from localhost
    
    // ========== VALIDATION & LOGGING ==========
    console.log('\n' + '='.repeat(60));
    console.log('🔧 PORTAL-02 SERVICE INITIALIZATION');
    console.log('='.repeat(60));
    
    // Log configuration
    console.log(`🔑 API Key Present: ${this.apiKey ? '✅ YES' : '❌ NO'}`);
    if (this.apiKey) {
      const maskedKey = this.apiKey.length > 8 
        ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`
        : '********';
      console.log(`   Key: ${maskedKey}`);
    }
    
    console.log(`🌐 Base URL: ${this.baseURL}`);
    console.log(`🔙 Backend URL: ${this.backendUrl}`);
    console.log(`🔔 Webhook URL: ${this.backendUrl}/api/webhooks/portal02`);
    
    // CRITICAL WARNINGS
    if (!this.apiKey || this.apiKey === 'dk_your_api_key_here') {
      console.error('\n❌ CRITICAL ERROR: PORTAL02_API_KEY is not set or is using default value!');
      console.error('   Set environment variable: PORTAL02_API_KEY=your_actual_api_key');
    }
    
    if (this.backendUrl.includes('localhost') || this.backendUrl.includes('127.0.0.1')) {
      console.error('\n❌ CRITICAL ERROR: Backend URL is localhost!');
      console.error('   Portal-02 CANNOT send webhooks to localhost!');
      console.error('   Set environment variable: BACKEND_URL=https://your-render-url.onrender.com');
    }
    
    console.log('='.repeat(60) + '\n');
    
    // ========== AXIOS CLIENT SETUP ==========
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        // ✅ CORRECT: lowercase 'x-api-key'
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000,
      maxRedirects: 5
    });
    
    // ========== OFFER SLUGS (FROM SCREENSHOT - VERIFIED) ==========
    this.offerSlugs = {
      'MTN': 'master_beneficiary_data_bundle',
      'Telecel': 'telecel_expiry_bundle', 
      'AirtelTigo': 'ishare_data_bundle'
    };
    
    // ========== AVAILABLE VOLUMES (FROM SCREENSHOTS) ==========
    this.availableVolumes = {
      'MTN': [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
      'Telecel': [5, 10, 15, 20, 25, 30, 40, 50, 100],
      'AirtelTigo': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20]
    };
    
    // Cache for dynamic offers
    this.dynamicOffers = null;
    this.lastOffersFetch = null;
  }

  // ========== 1. TEST CONNECTION (ENHANCED) ==========
  async testConnection() {
    console.log('\n' + '🔍'.repeat(30));
    console.log('TESTING PORTAL-02 CONNECTION');
    console.log('🔍'.repeat(30));
    
    try {
      console.log(`📤 Sending GET request to: ${this.baseURL}/balance`);
      
      // Test 1: Check balance endpoint
      const balanceResponse = await this.client.get('/balance');
      console.log('✅ BALANCE ENDPOINT SUCCESSFUL!');
      console.log(`📥 Response Status: ${balanceResponse.status}`);
      console.log('💰 Balance Data:', JSON.stringify(balanceResponse.data, null, 2));
      
      return {
        success: true,
        platform: 'Portal-02.com',
        message: '✅ Connection successful!',
        balance: balanceResponse.data,
        config: {
          baseURL: this.baseURL,
          backendUrl: this.backendUrl,
          apiKeyPresent: !!this.apiKey,
          webhookUrl: `${this.backendUrl}/api/webhooks/portal02`
        }
      };
      
    } catch (error) {
      console.error('❌ CONNECTION FAILED!');
      console.error(`📊 Error: ${error.message}`);
      
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Response Data:`, error.response.data);
        
        if (error.response.status === 401) {
          console.error('\n⚠️  API Key Error: Your API key may be invalid or expired');
        }
        
      } else if (error.request) {
        console.error('   No response received. Check network or URL.');
      }
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.message,
        details: error.response?.data,
        status: error.response?.status
      };
    }
  }

  // ========== 2. PURCHASE DATA BUNDLE (FIXED - CORRECT STRUCTURE) ==========
  async purchaseDataBundle(phoneNumber, bundleSize, network, orderReference = null) {
    const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    console.log('\n' + '🚀'.repeat(30));
    console.log('STARTING PORTAL-02 PURCHASE');
    console.log('🚀'.repeat(30));
    console.log(`📋 Transaction ID: ${transactionId}`);
    console.log(`📞 Phone: ${phoneNumber}`);
    console.log(`📊 Size: ${bundleSize}`);
    console.log(`🌐 Network: ${network}`);
    console.log(`🔖 Order Reference: ${orderReference || 'Not provided'}`);
    
    try {
      // ========== STEP 1: VALIDATE INPUTS ==========
      console.log('\n1️⃣ VALIDATING INPUTS:');
      
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      console.log(`   📱 Original: ${phoneNumber}`);
      console.log(`   📱 Formatted: ${formattedPhone}`);
      
      const volume = this.extractVolumeNumber(bundleSize);
      console.log(`   🔢 Volume: ${volume}GB`);
      
      if (volume <= 0) {
        const errorMsg = '❌ Invalid bundle size. Must be a positive number.';
        console.error(errorMsg);
        return { success: false, error: errorMsg };
      }
      
      // Validate volume availability
      if (!this.isVolumeAvailable(network, volume)) {
        const errorMsg = `❌ ${volume}GB not available for ${network}`;
        console.error(errorMsg);
        console.error(`   Available volumes: ${this.availableVolumes[network]?.join(', ') || 'None'}GB`);
        return { success: false, error: errorMsg };
      }
      console.log(`   ✅ Volume ${volume}GB is available`);
      
      // ========== STEP 2: PREPARE REQUEST ==========
      console.log('\n2️⃣ PREPARING REQUEST:');
      
      const offerSlug = this.getOfferSlug(network);
      console.log(`   🏷️ Offer Slug: ${offerSlug}`);
      
      const webhookUrl = `${this.backendUrl}/api/webhooks/portal02`;
      console.log(`   🔔 Webhook URL: ${webhookUrl}`);
      
      // ✅ CRITICAL FIX: CORRECT PAYLOAD STRUCTURE based on Portal-02 docs
      const payload = {
        phoneNumber: formattedPhone,      // ✅ MUST be "phoneNumber" not "phone"
        offerSlug: offerSlug,             // ✅ Correct field name
        volume: volume,                   // ✅ JUST the number, no "GB"
        webhookUrl: webhookUrl,           // ✅ REQUIRED for status updates
        reference: orderReference || `ALLEN-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
      };
      
      console.log('   📦 Final Payload:');
      console.log(JSON.stringify(payload, null, 4));
      
      // ========== STEP 3: SEND REQUEST ==========
      console.log('\n3️⃣ SENDING TO PORTAL-02:');
      
      // ✅ CRITICAL FIX: CORRECT ENDPOINT is "/orders" not "/order/{network}"
      const url = `/orders`;
      console.log(`   📤 URL: ${this.baseURL}${url}`);
      console.log(`   📤 Method: POST`);
      
      const startTime = Date.now();
      const response = await this.client.post(url, payload);
      const endTime = Date.now();
      
      // ========== STEP 4: HANDLE RESPONSE ==========
      console.log('\n4️⃣ RESPONSE RECEIVED:');
      console.log(`   ⏱️ Response Time: ${endTime - startTime}ms`);
      console.log(`   📥 Status: ${response.status}`);
      console.log(`   📊 Response Data:`);
      console.log(JSON.stringify(response.data, null, 4));
      
      if (response.data) {
        // ✅ CRITICAL FIX: Portal-02 returns "id" not "orderId"
        const portal02OrderId = response.data.id || response.data.orderId;
        console.log(`   🆔 Portal-02 Order ID: ${portal02OrderId}`);
        console.log(`   🔖 Reference: ${response.data.reference || payload.reference}`);
        console.log(`   📊 Status: ${response.data.status || 'pending'}`);
      }
      
      console.log('\n' + '✅'.repeat(15));
      console.log('PURCHASE SUCCESSFUL!');
      console.log('✅'.repeat(15));
      
      return {
        success: true,
        transactionId: response.data.id || response.data.orderId, // Portal-02's ID
        reference: payload.reference, // Our reference
        portal02OrderId: response.data.id, // Portal-02 order ID
        status: response.data.status || 'pending',
        message: '✅ Order submitted successfully to Portal-02',
        amount: response.data.totalAmount,
        currency: response.data.currency,
        raw: response.data,
        payload: payload
      };
      
    } catch (error) {
      console.error('\n' + '❌'.repeat(15));
      console.error('PURCHASE FAILED!');
      console.error('❌'.repeat(15));
      
      console.error(`📊 Error Message: ${error.message}`);
      
      if (error.response) {
        console.error(`📊 Response Status: ${error.response.status}`);
        console.error(`📊 Status Text: ${error.response.statusText}`);
        
        if (error.response.status === 400) {
          console.error('\n⚠️  400 Bad Request - Common issues:');
          console.error('   1. Wrong payload structure');
          console.error('   2. Invalid phone number format');
          console.error('   3. Volume not available');
          console.error('   4. Invalid offerSlug');
        }
        
        console.error(`📊 Response Data:`, JSON.stringify(error.response.data, null, 4));
        console.error(`📊 Request URL: ${error.config?.url}`);
        console.error(`📊 Request Data:`, JSON.stringify(JSON.parse(error.config?.data || '{}'), null, 4));
      }
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.response?.data?.message || 
               error.response?.data?.error || 
               error.message,
        code: error.response?.status || 500,
        details: error.response?.data
      };
    } finally {
      console.log('\n' + '='.repeat(60));
      console.log(`TRANSACTION ${transactionId} COMPLETE`);
      console.log('='.repeat(60) + '\n');
    }
  }

  // ========== 3. BULK PURCHASE ==========
  async purchaseBulkData(items, network, orderReference = null) {
    console.log('\n📦 Starting bulk purchase for', network);
    
    try {
      const bulkItems = items.map(item => ({
        volume: this.extractVolumeNumber(item.size),
        recipient: this.formatPhoneNumber(item.phone)
      }));
      
      const offerSlug = this.getOfferSlug(network);
      const webhookUrl = `${this.backendUrl}/api/webhooks/portal02`;
      
      const payload = {
        items: bulkItems,
        offerSlug: offerSlug,
        webhookUrl: webhookUrl,
        reference: orderReference
      };
      
      const response = await this.client.post(`/orders`, payload);
      
      return {
        success: true,
        transactionId: response.data.id,
        reference: response.data.reference,
        status: response.data.status || 'pending',
        message: 'Bulk order submitted',
        raw: response.data
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ========== 4. CHECK ORDER STATUS ==========
  async checkOrderStatus(orderId) {
    try {
      console.log(`🔍 Checking status for order: ${orderId}`);
      const response = await this.client.get(`/order/${orderId}`);
      
      console.log(`📊 Order ${orderId} status: ${response.data.status}`);
      
      return {
        success: true,
        order: response.data,
        status: response.data.status,
        message: 'Order status retrieved'
      };
    } catch (error) {
      console.error(`❌ Failed to check status for order ${orderId}:`, error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ========== 5. CHECK BALANCE ==========
  async checkBalance() {
    try {
      console.log('💰 Checking Portal-02 balance...');
      const response = await this.client.get('/balance');
      
      console.log(`✅ Balance: ${response.data.balance} ${response.data.currency || 'GHS'}`);
      
      return {
        success: true,
        balance: response.data.balance,
        currency: response.data.currency || 'GHS',
        raw: response.data
      };
    } catch (error) {
      console.error('❌ Failed to check balance:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ========== 6. RETRY MECHANISM ==========
  async purchaseDataBundleWithRetry(phoneNumber, bundleSize, network, orderReference = null, maxRetries = 3) {
    let lastError;
    let lastResult;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n🔄 RETRY ATTEMPT ${attempt}/${maxRetries}`);
      
      const result = await this.purchaseDataBundle(phoneNumber, bundleSize, network, orderReference);
      lastResult = result;
      
      if (result.success) {
        console.log(`✅ Success on attempt ${attempt}`);
        return result;
      }
      
      lastError = result.error;
      console.log(`⚠️ Attempt ${attempt} failed:`, result.error);
      
      // Don't retry if it's a validation error (won't change)
      if (result.error && (
          result.error.includes('not available') || 
          result.error.includes('Invalid') ||
          result.error.includes('must be') ||
          result.error.includes('phone'))) {
        console.log(`⏭️ Skipping retry - validation error won't change`);
        break;
      }
      
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Return the last result if all retries failed
    return lastResult || {
      success: false,
      error: lastError || 'All purchase attempts failed'
    };
  }

  // ========== 7. GET OFFERS ==========
  async getOffers() {
    try {
      console.log('📋 Fetching offers from Portal-02...');
      const response = await this.client.get('/offers');
      
      if (response.data) {
        this.dynamicOffers = response.data.offers || response.data;
        this.lastOffersFetch = new Date();
        
        console.log(`✅ Successfully fetched offers`);
        return {
          success: true,
          offers: this.dynamicOffers
        };
      }
      
      return { success: false, error: 'Failed to fetch offers' };
      
    } catch (error) {
      console.error('❌ Error fetching offers:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Using configured offer slugs'
      };
    }
  }

  // ========== 8. CHECK SINGLE ORDER STATUS ==========
  async getOrder(orderId) {
    try {
      console.log(`🔍 Getting order details for: ${orderId}`);
      const response = await this.client.get(`/order/${orderId}`);
      
      return {
        success: true,
        order: response.data
      };
    } catch (error) {
      console.error(`❌ Failed to get order ${orderId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ========== HELPER METHODS ==========
  
  formatPhoneNumber(phone) {
    if (!phone) return '';
    
    let cleaned = phone.toString().replace(/\D/g, '');
    
    // Convert Ghana numbers to 233 format
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '233' + cleaned.substring(1);
    } else if (cleaned.startsWith('+233')) {
      cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith('233') && cleaned.length === 12) {
      // Already in correct format
    } else if (cleaned.length === 9) {
      cleaned = '233' + cleaned;
    } else {
      console.warn(`⚠️ Phone number ${phone} may not be valid Ghana number`);
    }
    
    console.log(`📱 Phone formatting: ${phone} → ${cleaned}`);
    return cleaned;
  }

  extractVolumeNumber(size) {
    if (typeof size === 'number') return size;
    if (typeof size === 'string') {
      const match = size.match(/(\d+(\.\d+)?)/);
      const volume = match ? parseInt(match[1], 10) : 0;
      console.log(`📊 Volume extraction: "${size}" → ${volume}`);
      return volume;
    }
    console.log(`📊 Volume extraction failed for:`, size);
    return 0;
  }

  isVolumeAvailable(network, volume) {
    const volumes = this.availableVolumes[network];
    if (!volumes) {
      console.error(`❌ Network ${network} not supported`);
      return false;
    }
    
    const isAvailable = volumes.includes(volume);
    console.log(`📊 Volume ${volume}GB available for ${network}: ${isAvailable ? '✅' : '❌'}`);
    return isAvailable;
  }

  getOfferSlug(network) {
    const slug = this.offerSlugs[network];
    if (!slug) {
      throw new Error(`No offer slug found for network: ${network}`);
    }
    return slug;
  }

  // Process webhook payloads from Portal-02
  processWebhookPayload(payload) {
    try {
      console.log('🔔 Processing webhook payload:', payload.event || 'unknown');
      
      const { event, orderId, reference, status, recipient, volume, timestamp } = payload;
      
      if (event !== 'order.status.updated') {
        return { success: false, error: `Unknown webhook event: ${event}` };
      }
      
      const validStatuses = ['pending', 'processing', 'delivered', 'failed', 'cancelled', 'refunded', 'resolved'];
      if (!validStatuses.includes(status)) {
        return { success: false, error: `Invalid status: ${status}` };
      }
      
      return {
        success: true,
        event,
        orderId: orderId.toString(), // Ensure string
        reference: reference?.toString() || orderId.toString(),
        status,
        recipient: recipient?.toString() || '',
        volume: parseInt(volume) || 0,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        message: `Order ${orderId} → ${status}`
      };
      
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      return { success: false, error: error.message };
    }
  }
}

// ========== EXPORT SINGLETON ==========
module.exports = new Portal02Service();