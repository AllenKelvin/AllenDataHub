const axios = require('axios');

class Portal02Service {
  constructor() {
    this.apiKey = process.env.PORTAL02_API_KEY || 'dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH';
    this.baseURL = 'https://www.portal-02.com/api/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    // CORRECT offer slugs from screenshots
    this.offerSlugs = {
      'MTN': 'master_beneficiary_data_bundle',
      'Telecel': 'telecel_expiry_bundle',
      'AirtelTigo': 'ishare_data_bundle'
    };
    
    // Available volumes from screenshots
    this.availableVolumes = {
      'MTN': [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
      'Telecel': [5, 10, 15, 20, 25, 30, 40, 50, 100],
      'AirtelTigo': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20]
    };
    
    // Webhook URL for Portal-02 to send status updates
    this.webhookBaseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  }

  // Test connection
  async testConnection() {
    try {
      console.log('🔍 Testing Portal-02.com API connection');
      const response = await this.client.get('/balance');
      
      return {
        success: true,
        platform: 'Portal-02.com',
        message: 'Connected successfully',
        balance: response.data
      };
    } catch (error) {
      console.error('Portal-02 connection error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.message,
        details: error.response?.data
      };
    }
  }

  // ✅ UPDATED: Purchase data bundle with webhook URL
  async purchaseDataBundle(phoneNumber, bundleSize, network, orderReference = null) {
    try {
      console.log(`📦 Portal-02: Purchasing ${bundleSize} for ${phoneNumber} (${network})`);
      
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const volume = this.extractVolumeNumber(bundleSize);
      
      // Validate volume is available for this network
      if (!this.isVolumeAvailable(network, volume)) {
        return {
          success: false,
          error: `${volume}GB is not available for ${network}. Available volumes: ${this.availableVolumes[network].join(', ')}GB`
        };
      }
      
      // Get offer slug from screenshots
      const offerSlug = this.getOfferSlug(network);
      
      // ✅ IMPORTANT: Include webhook URL for status updates
      const webhookUrl = `${this.webhookBaseUrl}/api/webhooks/portal02`;
      
      // ✅ Payload structure from Portal-02 documentation
      const payload = {
        type: 'single',
        volume: volume,
        phone: formattedPhone,
        offerSlug: offerSlug,
        webhookUrl: webhookUrl
      };
      
      // Add reference if provided (for matching later)
      if (orderReference) {
        payload.reference = orderReference;
      }
      
      console.log('✅ Portal-02 payload with webhook:', payload);
      
      // Endpoint mapping from screenshots
      const endpoint = this.mapNetworkToEndpoint(network);
      console.log(`📤 Sending to: /order/${endpoint}`);
      
      const response = await this.client.post(`/order/${endpoint}`, payload);
      
      console.log('✅ Portal-02 response:', response.data);
      
      return {
        success: true,
        transactionId: response.data.orderId || response.data.id,
        reference: response.data.reference || response.data.orderId,
        status: response.data.status || 'pending',
        message: 'Order submitted successfully to vendor',
        raw: response.data
      };
      
    } catch (error) {
      console.error('❌ Portal-02 purchase error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      return {
        success: false,
        platform: 'Portal-02.com',
        error: error.response?.data?.message || error.response?.data?.error || error.message,
        code: error.response?.status || 500,
        details: error.response?.data
      };
    }
  }

  // ✅ NEW: Check order status from Portal-02
  async checkOrderStatus(orderId) {
    try {
      console.log(`🔍 Checking order status for: ${orderId}`);
      
      // According to Portal-02 docs: GET /api/v1/order/status/{orderId}
      const response = await this.client.get(`/order/status/${orderId}`);
      
      console.log(`✅ Order status for ${orderId}:`, response.data);
      
      return {
        success: true,
        order: response.data,
        status: response.data.status,
        message: 'Order status retrieved successfully'
      };
      
    } catch (error) {
      console.error('❌ Order status check error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // Bulk purchase with webhook
  async purchaseBulkData(items, network, orderReference = null) {
    try {
      console.log(`📦 Portal-02: Bulk purchase for ${network}, ${items.length} items`);
      
      const bulkItems = items.map(item => ({
        volume: this.extractVolumeNumber(item.size),
        recipient: this.formatPhoneNumber(item.phone)
      }));
      
      // Validate all volumes
      for (const item of bulkItems) {
        if (!this.isVolumeAvailable(network, item.volume)) {
          return {
            success: false,
            error: `${item.volume}GB is not available for ${network}. Available volumes: ${this.availableVolumes[network].join(', ')}GB`
          };
        }
      }
      
      const offerSlug = this.getOfferSlug(network);
      
      // ✅ Include webhook URL
      const webhookUrl = `${this.webhookBaseUrl}/api/webhooks/portal02`;
      
      const payload = {
        type: 'bulk',
        items: bulkItems,
        offerSlug: offerSlug,
        webhookUrl: webhookUrl
      };
      
      // Add reference if provided
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
        message: 'Bulk order submitted to vendor',
        raw: response.data
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  // Check account balance
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

  // Helper: Format phone number
  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '233' + cleaned.substring(1);
    } else if (cleaned.startsWith('+233')) {
      cleaned = cleaned.substring(1);
    } else if (cleaned.length === 9) {
      cleaned = '233' + cleaned;
    }
    
    return cleaned;
  }

  // Extract volume number from bundle size (e.g., "1GB" -> 1)
  extractVolumeNumber(size) {
    if (typeof size === 'number') {
      return size;
    }
    
    if (typeof size === 'string') {
      const match = size.match(/(\d+(\.\d+)?)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    return 0;
  }

  // Check if volume is available for network
  isVolumeAvailable(network, volume) {
    const volumes = this.availableVolumes[network];
    if (!volumes) return false;
    
    return volumes.includes(volume);
  }

  // Get offer slug from screenshots
  getOfferSlug(network) {
    const slug = this.offerSlugs[network];
    if (!slug) {
      throw new Error(`No offer slug found for network: ${network}`);
    }
    return slug;
  }

  // Map network to Portal-02 endpoint
  mapNetworkToEndpoint(network) {
    const mapping = {
      'MTN': 'mtn',
      'Telecel': 'telecel',
      'AirtelTigo': 'at'
    };
    return mapping[network] || network.toLowerCase();
  }
  
  // Retry mechanism for failed purchases
  async purchaseDataBundleWithRetry(phoneNumber, bundleSize, network, orderReference = null, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${network} ${bundleSize} to ${phoneNumber}`);
        
        const result = await this.purchaseDataBundle(phoneNumber, bundleSize, network, orderReference);
        
        if (result.success) {
          console.log(`✅ Purchase successful on attempt ${attempt}`);
          return result;
        } else {
          lastError = new Error(result.error || 'Purchase failed');
          console.log(`⚠️ Purchase failed on attempt ${attempt}:`, result.error);
        }
      } catch (error) {
        lastError = error;
        console.log(`❌ Error on attempt ${attempt}:`, error.message);
      }
      
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError || new Error('All purchase attempts failed');
  }
  
  // ✅ NEW: Process Portal-02 webhook payload
  processWebhookPayload(payload) {
    try {
      console.log('📥 Processing Portal-02 webhook payload:', payload);
      
      const { event, orderId, reference, status, recipient, volume, timestamp } = payload;
      
      if (event !== 'order.status.updated') {
        return { success: false, error: 'Unknown webhook event type' };
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
        message: `Order ${orderId} status updated to ${status}`
      };
      
    } catch (error) {
      console.error('❌ Error processing webhook payload:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new Portal02Service();