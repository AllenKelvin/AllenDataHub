const axios = require('axios');

class Portal02Service {
  constructor() {
    // ========== CRITICAL CONFIGURATION ==========
    this.apiKey = process.env.PORTAL02_API_KEY || 'dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH';
    this.baseURL = process.env.PORTAL02_BASE_URL || 'https://www.portal-02.com/api/v1';
   this.backendUrl = 'https://allen-data-hub-backend.onrender.com';
    
    console.log('\n' + '='.repeat(60));
    console.log('🔧 PORTAL-02 SERVICE INITIALIZATION');
    console.log('='.repeat(60));
    console.log(`🔑 API Key Present: ${this.apiKey ? '✅ YES' : '❌ NO'}`);
    console.log(`🌐 Base URL: ${this.baseURL}`);
    console.log(`🔙 Backend URL: ${this.backendUrl}`);
    console.log('='.repeat(60) + '\n');
    
    // ========== AXIOS CLIENT SETUP ==========
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000,
      maxRedirects: 5
    });
    
    // ========== OFFER SLUGS ==========
    this.offerSlugs = {
      'MTN': 'master_beneficiary_data_bundle',
      'Telecel': 'telecel_expiry_bundle', 
      'AirtelTigo': 'ishare_data_bundle'
    };
    
    // ========== AVAILABLE VOLUMES ==========
    this.availableVolumes = {
      'MTN': [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
      'Telecel': [5, 10, 15, 20, 25, 30, 40, 50, 100],
      'AirtelTigo': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20]
    };
  }

  // ========== 1. PURCHASE DATA BUNDLE ==========
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
      
      // Build payload Portal-02 expects
      const payload = {
        type: 'single',
        volume: volume,
        phone: formattedPhone,
        offerSlug: offerSlug,
        webhookUrl: webhookUrl
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
      
      console.error(`📊 Error Message: ${error.message}`);
      
      if (error.response) {
        console.error(`📊 Response Status: ${error.response.status}`);
        console.error(`📊 Status Text: ${error.response.statusText}`);
        
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
        }
        
        console.error(`📊 Response Data:`);
        console.error(JSON.stringify(error.response.data, null, 4));
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

  // ========== 2. RETRY MECHANISM ==========
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
    
    return lastResult || {
      success: false,
      error: lastError || 'All purchase attempts failed'
    };
  }

  // ========== 3. CHECK ORDER STATUS ==========
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

  // ========== 4. CHECK BALANCE ==========
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

  // ========== 5. TEST CONNECTION ==========
  async testConnection() {
    console.log('\n🔍 TESTING PORTAL-02 CONNECTION');
    
    try {
      console.log(`📤 Sending GET request to: ${this.baseURL}/balance`);
      
      const balanceResponse = await this.client.get('/balance');
      console.log('✅ BALANCE ENDPOINT SUCCESSFUL!');
      console.log(`📥 Response Status: ${balanceResponse.status}`);
      
      return {
        success: true,
        platform: 'Portal-02.com',
        message: '✅ Connection test passed!',
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
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.message,
        details: error.response?.data,
        status: error.response?.status
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