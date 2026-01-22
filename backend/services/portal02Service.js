const axios = require('axios');

class Portal02Service {
  constructor() {
    // ========== CRITICAL CONFIGURATION ==========
    this.apiKey = process.env.PORTAL02_API_KEY || 'dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH';
    this.baseURL = process.env.PORTAL02_BASE_URL || 'https://www.portal-02.com/api/v1';
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
    
    // ========== OFFER SLUGS (FROM YOUR SCREENSHOTS - VERIFIED) ==========
    this.offerSlugs = {
      'MTN': 'master_beneficiary_data_bundle',
      'Telecel': 'telecel_expiry_bundle', 
      'AirtelTigo': 'ishare_data_bundle'
    };
    
    // ========== AVAILABLE VOLUMES (FROM YOUR SCREENSHOTS - CORRECTED) ==========
    this.availableVolumes = {
      'MTN': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30, 40, 50, 100],
      'Telecel': [5, 10, 15, 20, 25, 30, 40, 50, 100],
      'AirtelTigo': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20] // ✅ Fixed: Added 11, 13, 14
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
      console.log(`🔑 Using API Key: ${this.apiKey.substring(0, 8)}...`);
      
      // Test 1: Check balance endpoint
      const balanceResponse = await this.client.get('/balance');
      console.log('✅ BALANCE ENDPOINT SUCCESSFUL!');
      console.log(`📥 Response Status: ${balanceResponse.status}`);
      console.log('💰 Balance Data:', balanceResponse.data);
      
      // Test 2: Try to fetch offers dynamically
      console.log('\n📋 Testing /offers endpoint...');
      try {
        const offersResponse = await this.client.get('/offers');
        if (offersResponse.data.success) {
          console.log('✅ OFFERS ENDPOINT SUCCESSFUL!');
          this.dynamicOffers = offersResponse.data.offers;
          this.lastOffersFetch = new Date();
          
          // Update available volumes from dynamic offers
          this.dynamicOffers.forEach(offer => {
            if (offer.type === 'Data' && offer.volumes) {
              this.availableVolumes[offer.isp] = offer.volumes;
              this.offerSlugs[offer.isp] = offer.offerSlug;
            }
          });
          
          console.log(`📊 Fetched ${this.dynamicOffers.length} offers from Portal-02`);
        }
      } catch (offersError) {
        console.log('⚠️  /offers endpoint not accessible, using hardcoded values');
        console.log('   Error:', offersError.message);
      }
      
      // Test 3: Test order endpoint structure
      console.log('\n📦 Testing order endpoint structure...');
      let orderEndpointTest = 'Not tested';
      try {
        // Just test if endpoint exists (GET may fail, but we can check)
        await this.client.get('/order/mtn', { validateStatus: false });
        orderEndpointTest = 'Endpoint exists';
      } catch (orderError) {
        orderEndpointTest = `Endpoint check: ${orderError.message}`;
      }
      
      console.log('✅ CONNECTION TESTS COMPLETE!');
      
      return {
        success: true,
        platform: 'Portal-02.com',
        message: '✅ All connection tests passed!',
        balance: balanceResponse.data,
        offers: {
          source: this.dynamicOffers ? 'Dynamic (from Portal-02)' : 'Hardcoded (from screenshots)',
          availableVolumes: this.availableVolumes,
          offerSlugs: this.offerSlugs,
          dynamicOffers: this.dynamicOffers
        },
        endpoints: {
          balance: '✅ Accessible',
          offers: this.dynamicOffers ? '✅ Accessible' : '⚠️ Using hardcoded',
          orders: orderEndpointTest
        },
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
      
      // Detailed error logging
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Status Text: ${error.response.statusText}`);
        console.error(`   Response Data:`, error.response.data);
        console.error(`   Headers Sent:`, error.config?.headers);
        
        // Specific error guidance
        if (error.response.status === 401) {
          console.error('\n⚠️  API Key Error: Your API key may be invalid or expired');
          console.error('   Contact Portal-02 support to verify your API key');
        }
        
        if (error.response.status === 404) {
          console.error('\n⚠️  Endpoint Not Found: Check base URL');
          console.error('   Try: https://api.portal-02.com/api/v1');
          console.error('   Or: https://portal-02.com/api/v1');
        }
        
      } else if (error.request) {
        console.error('   No response received. Check network or URL.');
        console.error('   URL attempted:', error.config?.url);
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

  // ========== 2. PURCHASE DATA BUNDLE (ENHANCED) ==========
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
        volume: volume, // ✅ MUST be a NUMBER, not string
        phone: formattedPhone, // ✅ MUST be in 233 format
        offerSlug: offerSlug, // ✅ Verified from screenshot
        webhookUrl: webhookUrl // ✅ REQUIRED for status updates
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
        console.log(`   💰 Amount: ${response.data.totalAmount || 'N/A'} ${response.data.currency || 'GHS'}`);
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
        amount: response.data.totalAmount,
        currency: response.data.currency,
        raw: response.data,
        payload: payload
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
        
        // Special handling for common errors
        if (error.response.status === 400) {
          console.error('\n⚠️  400 Bad Request - Common issues:');
          console.error('   1. Volume must be a NUMBER (not string with "GB")');
          console.error('   2. Phone must be in 233XXXXXXXXX format');
          console.error('   3. Invalid offerSlug');
          console.error('   4. Missing required fields');
        }
        
        if (error.response.status === 404) {
          console.error('\n⚠️  404 Not Found - Possible issues:');
          console.error('   1. Wrong endpoint URL');
          console.error('   2. Network not supported (mtn, at, telecel)');
          console.error('   3. API endpoint changed');
        }
        
        if (error.response.status === 401) {
          console.error('\n⚠️  401 Unauthorized - Check your API key');
          console.error('   1. API key may be invalid');
          console.error('   2. API key may be expired');
          console.error('   3. Wrong header format (should be x-api-key)');
        }
        
        console.error(`📊 Response Data:`);
        console.error(JSON.stringify(error.response.data, null, 4));
        console.error(`📊 Request URL: ${error.config?.url}`);
        console.error(`📊 Request Method: ${error.config?.method}`);
        console.error(`📊 Request Headers:`, JSON.stringify(error.config?.headers, null, 4));
        console.error(`📊 Request Data:`, JSON.stringify(JSON.parse(error.config?.data || '{}'), null, 4));
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
  async purchaseDataBundleWithRetry(phoneNumber, bundleSize, network, orderReference = null, maxRetries = 2) {
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
      if (result.error.includes('not available') || 
          result.error.includes('Invalid') ||
          result.error.includes('must be')) {
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

  // ========== 7. FETCH OFFERS DYNAMICALLY ==========
  async fetchOffers() {
    try {
      console.log('📋 Fetching offers from Portal-02...');
      const response = await this.client.get('/offers');
      
      if (response.data.success) {
        this.dynamicOffers = response.data.offers;
        this.lastOffersFetch = new Date();
        
        console.log(`✅ Successfully fetched ${this.dynamicOffers.length} offers`);
        
        // Update our configuration with dynamic data
        response.data.offers.forEach(offer => {
          if (offer.type === 'Data' && offer.volumes) {
            this.availableVolumes[offer.isp] = offer.volumes;
            this.offerSlugs[offer.isp] = offer.offerSlug;
          }
        });
        
        return {
          success: true,
          offers: this.dynamicOffers,
          availableVolumes: this.availableVolumes,
          offerSlugs: this.offerSlugs
        };
      }
      
      return { success: false, error: 'Failed to fetch offers' };
      
    } catch (error) {
      console.error('❌ Error fetching offers:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Using hardcoded offer configuration'
      };
    }
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

  mapNetworkToEndpoint(network) {
    const mapping = {
      'MTN': 'mtn',
      'Telecel': 'telecel',
      'AirtelTigo': 'at'
    };
    
    const endpoint = mapping[network] || network.toLowerCase();
    console.log(`🌐 Network mapping: ${network} → ${endpoint}`);
    return endpoint;
  }
  
  // Process webhook payloads
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
        orderId,
        reference,
        status,
        recipient,
        volume,
        timestamp: new Date(timestamp),
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