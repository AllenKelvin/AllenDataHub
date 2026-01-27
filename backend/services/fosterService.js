const axios = require('axios');

class FosterService {
  constructor() {
    this.apiKey = process.env.FOSTER_API_KEY || 'a57a2c2bbc8ed0f7c526d316f3a5c8b4580f0d73';
    this.baseURL = 'https://fgamall.researchershubgh.com/api/v1'; // Base URL from docs 
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Map network names to IDs from documentation 
    this.networkIds = {
      'AirtelTigo': 1,
      'Telecel': 2,
      'MTN': 3
    };
  }

  // Primary method to purchase data 
  async purchaseData(phoneNumber, bundleSize, network, reference) {
    try {
      // Extract numeric volume (e.g., "5GB" -> 5000 for MB or 50 for specific packages)
      const volume = parseInt(bundleSize); 
      const networkId = this.networkIds[network];

      // Documentation specifies different endpoints based on package type 
      // Using /buy-other-package as the standard implementation
      const payload = {
        recipient_msisdn: phoneNumber,
        network_id: networkId,
        shared_bundle: volume,
        order_reference: reference
      };

      console.log(`🚀 Sending Foster Console Request:`, payload);
      const response = await this.client.post('/buy-other-package', payload);
      
      return {
        success: response.data.success || response.data.response_code === "200",
        transactionId: response.data.transaction_code || response.data.vendorTranxId,
        message: response.data.message || response.data.response_msg
      };
    } catch (error) {
      console.error('❌ Foster API Error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Check balance method as per docs 
  async checkBalance() {
    try {
      const response = await this.client.get('/check-console-balance');
      return response.data;
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = new FosterService();