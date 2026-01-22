const axios = require('axios');

class Portal02Service {
  constructor() {
    // ========== CRITICAL CONFIGURATION ==========
    this.apiKey = process.env.PORTAL02_API_KEY || 'dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH';
    this.baseURL = process.env.PORTAL02_BASE_URL || 'https://www.portal-02.com/api/v1';
    
    // ✅ ABSOLUTELY CRITICAL: Webhook URL for Portal-02
    // On Render: BACKEND_URL=https://your-service-name.onrender.com
    this.backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
    
    // ========== VALIDATION & LOGGING ==========
    console.log('\n' + '='.repeat(60));
    console.log('🔧 PORTAL-02 SERVICE INITIALIZATION');
    console.log('='.repeat(60));
    
    // Log configuration
    console.log(`🔑 API Key Present: ${this.apiKey ? '✅ YES' : '❌ NO'}`);
    if (this.apiKey) {
      console.log(`   Key: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
    }
    
    console.log(`🌐 Base URL: ${this.baseURL}`);
    console.log(`🔙 Backend URL: ${this.backendUrl}`);
    
    // CRITICAL WARNINGS
    if (!this.apiKey || this.apiKey === 'dk_your_api_key_here') {
      console.error('\n❌ CRITICAL ERROR: PORTAL02_API_KEY is not set or is using default value!');
      console.error('   Set environment variable: PORTAL02_API_KEY=dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH');
    }
    
    if (this.backendUrl.includes('localhost') || this.backendUrl.includes('127.0.0.1')) {
      console.error('\n❌ CRITICAL ERROR: Backend URL is localhost!');
      console.error('   Portal-02 CANNOT send webhooks to localhost!');
      console.error('   Set environment variable: BACKEND_URL=https://your-render-url.onrender.com');
    }
    
    if (!this.backendUrl.startsWith('https://')) {
      console.warn('\n⚠️  WARNING: Backend URL is not HTTPS');
      console.warn('   Some services may block HTTP webhooks');
    }
    
    console.log('='.repeat(60) + '\n');
    
    // ========== AXIOS CLIENT SETUP ==========
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        // ✅ CORRECT: lowercase 'x-api-key' (EXACTLY as Portal-02 requires)
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000,
      maxRedirects: 5
    });
    
    // ========== OFFER SLUGS (FROM YOUR SCREENSHOTS) ==========
    this.offerSlugs = {
      'MTN': 'master_beneficiary_data_bundle',
      'Telecel': 'telecel_expiry_bundle', 
      'AirtelTigo': 'ishare_data_bundle'
    };
    
    // ========== AVAILABLE VOLUMES (FROM YOUR SCREENSHOTS) ==========
    this.availableVolumes = {
      'MTN': [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
      'Telecel': [5, 10, 15, 20, 25, 30, 40, 50, 100],
      'AirtelTigo': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20]
    };
  }

  // ========== 1. TEST CONNECTION ==========
  async testConnection() {
    console.log('\n' + '🔍'.repeat(30));
    console.log('TESTING PORTAL-02 CONNECTION');
    console.log('🔍'.repeat(30));
    
    try {
      console.log(`📤 Sending GET request to: ${this.baseURL}/balance`);
      console.log(`🔑 Using API Key: ${this.apiKey.substring(0, 8)}...`);
      
      const response = await this.client.get('/balance');
      
      console.log('✅ CONNECTION SUCCESSFUL!');
      console.log(`📥 Response Status: ${response.status}`);
      console.log('💰 Balance Data:', response.data);
      
      return {
        success: true,
        platform: 'Portal-02.com',
        message: '✅ Connected successfully!',
        balance: response.data,
        config: {
          baseURL: this.baseURL,
          backendUrl: this.backendUrl,
          apiKeyPresent: !!this.apiKey
        }
      };
      
    } catch (error) {
      console.error('❌ CONNECTION FAILED!');
      console.error(`📊 Error: ${error.message}`);
      
      // Detailed error logging
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Status Text: ${error.response.statusText}`);
        console.error(`   Response Data:`, error.response.data);
        console.error(`   Headers Sent:`, error.config?.headers);
      } else if (error.request) {
        console.error('   No response received. Check network or URL.');
      } else {
        console.error('   Request setup error:', error.message);
      }
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.message,
        details: error.response?.data,
        status: error.response?.status,
        config: {
          baseURL: this.baseURL,
          backendUrl: this.backendUrl,
          apiKeyPresent: !!this.apiKey
        }
      };
    }
  }

  // ========== 2. PURCHASE DATA BUNDLE ==========
  async purchaseDataBundle(phoneNumber, bundleSize, network, orderReference = null) {
    const transactionId = `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    console.log('\n' + '🚀'.repeat(30));
    console.log('STARTING PORTAL-02 PURCHASE');
    console.log('🚀'.repeat(30));
    console.log(`📋 Transaction ID: ${transactionId}`);
    console.log(`📞 Phone: ${phoneNumber}`);
    console.log(`📊 Size: ${bundleSize}`);
    console.log(`🌐 Network: ${network}`);
    
    try {
      // ========== STEP 1: VALIDATE INPUTS ==========
      console.log('\n1️⃣ VALIDATING INPUTS:');
      
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      console.log(`   📱 Original: ${phoneNumber}`);
      console.log(`   📱 Formatted: ${formattedPhone}`);
      
      const volume = this.extractVolumeNumber(bundleSize);
      console.log(`   🔢 Volume: ${volume}GB`);
      
      // Validate volume
      if (!this.isVolumeAvailable(network, volume)) {
        const errorMsg = `❌ ${volume}GB not available for ${network}`;
        console.error(errorMsg);
        console.error(`   Available volumes: ${this.availableVolumes[network].join(', ')}GB`);
        return { success: false, error: errorMsg };
      }
      console.log(`   ✅ Volume ${volume}GB is available`);
      
      // ========== STEP 2: PREPARE REQUEST ==========
      console.log('\n2️⃣ PREPARING REQUEST:');
      
      const offerSlug = this.getOfferSlug(network);
      console.log(`   🏷️ Offer Slug: ${offerSlug}`);
      
      const webhookUrl = `${this.backendUrl}/api/webhooks/portal02`;
      console.log(`   🔔 Webhook URL: ${webhookUrl}`);
      
      // CRITICAL: Build EXACT payload Portal-02 expects
      const payload = {
        type: 'single',
        volume: volume, // ✅ NUMBER, not string
        phone: formattedPhone,
        offerSlug: offerSlug,
        webhookUrl: webhookUrl // ✅ MUST be included
      };
      
      // Add reference if provided
      if (orderReference) {
        payload.reference = orderReference;
        console.log(`   🔖 Reference: ${orderReference}`);
      }
      
      console.log('   📦 Final Payload:');
      console.log(JSON.stringify(payload, null, 4));
      
      // ========== STEP 3: SEND REQUEST ==========
      console.log('\n3️⃣ SENDING TO PORTAL-02:');
      
      const endpoint = this.mapNetworkToEndpoint(network);
      const url = `/order/${endpoint}`;
      console.log(`   📤 URL: ${this.baseURL}${url}`);
      console.log(`   📤 Method: POST`);
      console.log(`   🔑 Headers: x-api-key: ${this.apiKey.substring(0, 8)}...`);
      
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
        console.log(`   🆔 Order ID: ${response.data.orderId || response.data.id}`);
        console.log(`   🔖 Reference: ${response.data.reference}`);
        console.log(`   📊 Status: ${response.data.status}`);
      }
      
      console.log('\n' + '✅'.repeat(15));
      console.log('PURCHASE SUCCESSFUL!');
      console.log('✅'.repeat(15));
      
      return {
        success: true,
        transactionId: response.data.orderId || response.data.id,
        reference: response.data.reference || response.data.orderId,
        status: response.data.status || 'pending',
        message: '✅ Order submitted successfully to Portal-02',
        raw: response.data,
        payload: payload // Include for debugging
      };
      
    } catch (error) {
      console.error('\n' + '❌'.repeat(15));
      console.error('PURCHASE FAILED!');
      console.error('❌'.repeat(15));
      
      // EXTENSIVE ERROR LOGGING
      console.error(`📊 Error Message: ${error.message}`);
      console.error(`📊 Error Code: ${error.code || 'N/A'}`);
      
      if (error.response) {
        console.error(`📊 Response Status: ${error.response.status}`);
        console.error(`📊 Status Text: ${error.response.statusText}`);
        console.error(`📊 Response Headers:`, error.response.headers);
        console.error(`📊 Response Data:`);
        console.error(JSON.stringify(error.response.data, null, 4));
      }
      
      if (error.config) {
        console.error(`📊 Request URL: ${error.config.url}`);
        console.error(`📊 Request Method: ${error.config.method}`);
        console.error(`📊 Request Headers:`);
        console.error(JSON.stringify(error.config.headers, null, 4));
        console.error(`📊 Request Data:`);
        console.error(JSON.stringify(JSON.parse(error.config.data || '{}'), null, 4));
      }
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.response?.data?.message || 
               error.response?.data?.error || 
               error.message,
        code: error.response?.status || 500,
        details: error.response?.data,
        requestInfo: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data
        }
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
        type: 'bulk',
        items: bulkItems,
        offerSlug: offerSlug,
        webhookUrl: webhookUrl
      };
      
      if (orderReference) {
        payload.reference = orderReference;
      }
      
      const endpoint = this.mapNetworkToEndpoint(network);
      const response = await this.client.post(`/order/${endpoint}`, payload);
      
      return {
        success: true,
        transactionId: response.data.orderId,
        reference: response.data.reference || response.data.orderId,
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
      const response = await this.client.get(`/order/status/${orderId}`);
      
      return {
        success: true,
        order: response.data,
        status: response.data.status,
        message: 'Order status retrieved'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // ========== 5. CHECK BALANCE ==========
  async checkBalance() {
    try {
      const response = await this.client.get('/balance');
      return {
        success: true,
        balance: response.data.balance,
        currency: response.data.currency || 'GHS',
        raw: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ========== 6. RETRY MECHANISM ==========
  async purchaseDataBundleWithRetry(phoneNumber, bundleSize, network, orderReference = null, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n🔄 RETRY ATTEMPT ${attempt}/${maxRetries}`);
      
      const result = await this.purchaseDataBundle(phoneNumber, bundleSize, network, orderReference);
      
      if (result.success) {
        console.log(`✅ Success on attempt ${attempt}`);
        return result;
      }
      
      lastError = result.error;
      console.log(`⚠️ Attempt ${attempt} failed:`, result.error);
      
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw new Error(lastError || 'All purchase attempts failed');
  }

  // ========== HELPER METHODS ==========
  
  formatPhoneNumber(phone) {
    if (!phone) return '';
    
    let cleaned = phone.replace(/\D/g, '');
    
    // Convert Ghana numbers to 233 format
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '233' + cleaned.substring(1);
    } else if (cleaned.startsWith('+233')) {
      cleaned = cleaned.substring(1);
    } else if (cleaned.length === 9) {
      cleaned = '233' + cleaned;
    }
    
    return cleaned;
  }

  extractVolumeNumber(size) {
    if (typeof size === 'number') return size;
    if (typeof size === 'string') {
      const match = size.match(/(\d+(\.\d+)?)/);
      return match ? parseInt(match[1], 10) : 0;
    }
    return 0;
  }

  isVolumeAvailable(network, volume) {
    const volumes = this.availableVolumes[network];
    return volumes ? volumes.includes(volume) : false;
  }

  getOfferSlug(network) {
    const slug = this.offerSlugs[network];
    if (!slug) {
      throw new Error(`No offer slug found for network: ${network}`);
    }
    return slug;
  }

  mapNetworkToEndpoint(network) {
    const mapping = {
      'MTN': 'mtn',
      'Telecel': 'telecel',
      'AirtelTigo': 'at'
    };
    return mapping[network] || network.toLowerCase();
  }
  
  // Process webhook payloads
  processWebhookPayload(payload) {
    try {
      const { event, orderId, reference, status, recipient, volume, timestamp } = payload;
      
      if (event !== 'order.status.updated') {
        return { success: false, error: 'Unknown webhook event' };
      }
      
      const validStatuses = ['pending', 'processing', 'delivered', 'failed', 'cancelled', 'refunded', 'resolved'];
      if (!validStatuses.includes(status)) {
        return { success: false, error: `Invalid status: ${status}` };
      }
      
      return {
        success: true,
        event,
        orderId,
        reference,
        status,
        recipient,
        volume,
        timestamp: new Date(timestamp),
        message: `Order ${orderId} → ${status}`
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ========== EXPORT SINGLETON ==========
module.exports = new Portal02Service();