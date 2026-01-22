const axios = require('axios');

class Portal02Service {
  constructor() {
    this.apiKey = process.env.PORTAL02_API_KEY || 'dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH';
    this.baseURL = 'https://www.portal-02.com/api/v1'; // Added "www."
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': this.apiKey, // Changed from Authorization
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
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

  // Purchase data bundle - UPDATED for Portal-02 API structure
  async purchaseDataBundle(phoneNumber, bundleSize, network) {
    try {
      console.log(`📦 Portal-02: Purchasing ${bundleSize} for ${phoneNumber} (${network})`);
      
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const offerSlug = this.getOfferSlug(bundleSize, network);
      
      // Portal-02 API expects this structure
      const payload = {
        type: 'single',
        volume: this.convertToMB(bundleSize),
        phone: formattedPhone,
        offerSlug: offerSlug,
        webhookUrl: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/webhooks/orders` : undefined
      };
      
      console.log('Portal-02 payload:', payload);
      
      // Map network to Portal-02 endpoint
      const endpoint = this.mapNetworkToEndpoint(network);
      const response = await this.client.post(`/order/${endpoint}`, payload);
      
      console.log('Portal-02 response:', response.data);
      
      return {
        success: true,
        transactionId: response.data.orderId || response.data.id,
        reference: response.data.reference,
        status: response.data.status || 'processing',
        message: 'Order submitted successfully',
        raw: response.data
      };
      
    } catch (error) {
      console.error('Portal-02 purchase error:', {
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

  // Bulk purchase
  async purchaseBulkData(items, network) {
    try {
      console.log(`📦 Portal-02: Bulk purchase for ${network}, ${items.length} items`);
      
      const bulkItems = items.map(item => ({
        volume: this.convertToMB(item.size),
        recipient: this.formatPhoneNumber(item.phone)
      }));
      
      const offerSlug = this.getOfferSlug(items[0].size, network);
      
      const payload = {
        type: 'bulk',
        items: bulkItems,
        offerSlug: offerSlug,
        webhookUrl: process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/webhooks/orders` : undefined
      };
      
      const endpoint = this.mapNetworkToEndpoint(network);
      const response = await this.client.post(`/order/${endpoint}`, payload);
      
      return {
        success: true,
        transactionId: response.data.orderId,
        status: response.data.status || 'processing',
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
    // Remove any non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle Ghana numbers
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '233' + cleaned.substring(1);
    } else if (cleaned.startsWith('+233')) {
      cleaned = cleaned.substring(1);
    } else if (cleaned.length === 9) {
      cleaned = '233' + cleaned;
    }
    
    return cleaned;
  }

  // Helper: Convert size to MB
  convertToMB(size) {
    const match = size.match(/(\d+(\.\d+)?)\s*(GB|MB)/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[3].toUpperCase();
    
    if (unit === 'GB') {
      return Math.round(value * 1000); // Convert GB to MB
    }
    return Math.round(value); // Already in MB
  }

  // Helper: Map network to Portal-02 endpoint
  mapNetworkToEndpoint(network) {
    const mapping = {
      'MTN': 'mtn',
      'Telecel': 'telecel',
      'AirtelTigo': 'at'
    };
    return mapping[network] || network.toLowerCase();
  }

  // Helper: Get offer slug for Portal-02
  getOfferSlug(bundleSize, network) {
    // Define offer slugs based on your plans
    const offerSlugs = {
      'MTN': {
        '1GB': 'mtn_data_bundle',
        '2GB': 'mtn_data_bundle',
        '3GB': 'mtn_data_bundle',
        '4GB': 'mtn_data_bundle',
        '5GB': 'mtn_data_bundle',
        '6GB': 'mtn_data_bundle',
        '7GB': 'mtn_data_bundle',
        '8GB': 'mtn_data_bundle',
        '10GB': 'mtn_data_bundle',
        '15GB': 'mtn_data_bundle',
        '20GB': 'mtn_data_bundle',
        '25GB': 'mtn_data_bundle',
        '30GB': 'mtn_data_bundle',
        '40GB': 'mtn_data_bundle',
        '50GB': 'mtn_data_bundle',
        '100GB': 'mtn_data_bundle'
      },
      'Telecel': {
        '5GB': 'telecel_data_bundle',
        '10GB': 'telecel_data_bundle',
        '15GB': 'telecel_data_bundle',
        '20GB': 'telecel_data_bundle',
        '25GB': 'telecel_data_bundle',
        '30GB': 'telecel_data_bundle',
        '40GB': 'telecel_data_bundle',
        '50GB': 'telecel_data_bundle',
        '100GB': 'telecel_data_bundle'
      },
      'AirtelTigo': {
        '1GB': 'airteltigo_data_bundle',
        '2GB': 'airteltigo_data_bundle',
        '3GB': 'airteltigo_data_bundle',
        '4GB': 'airteltigo_data_bundle',
        '5GB': 'airteltigo_data_bundle',
        '6GB': 'airteltigo_data_bundle',
        '7GB': 'airteltigo_data_bundle',
        '8GB': 'airteltigo_data_bundle',
        '9GB': 'airteltigo_data_bundle',
        '10GB': 'airteltigo_data_bundle',
        '12GB': 'airteltigo_data_bundle',
        '15GB': 'airteltigo_data_bundle',
        '20GB': 'airteltigo_data_bundle'
      }
    };
    
    return offerSlugs[network]?.[bundleSize] || `${network.toLowerCase()}_data_bundle`;
  }
}

module.exports = new Portal02Service();