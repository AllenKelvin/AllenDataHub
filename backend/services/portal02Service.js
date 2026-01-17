const axios = require('axios');

class Portal02Service {
  constructor() {
    this.apiKey = process.env.PORTAL02_API_KEY || 'dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH';
    this.baseURL = 'https://portal-02.com/api/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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
      
      // Try to get account balance (common endpoint)
      const balance = await this.checkBalance();
      
      if (balance.success) {
        return {
          success: true,
          platform: 'Portal-02.com',
          message: 'Connected successfully',
          balance: balance
        };
      }
      
      // Try another endpoint
      const response = await this.client.get('/status');
      return {
        success: true,
        platform: 'Portal-02.com',
        message: 'API is reachable',
        data: response.data
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

  // Purchase data bundle
  async purchaseDataBundle(phoneNumber, bundleSize, network) {
    try {
      console.log(`📦 Portal-02: Purchasing ${bundleSize} for ${phoneNumber} (${network})`);
      
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const productCode = this.getProductCode(bundleSize, network);
      
      const payload = {
        network: network.toLowerCase(),
        amount: this.calculateAmount(bundleSize, network),
        mobile_number: formattedPhone,
        plan: productCode,
        Ported_number: true,
        airtime_type: 'data'
      };
      
      console.log('Portal-02 payload:', payload);
      
      const response = await this.client.post('/data', payload);
      
      console.log('Portal-02 response:', response.data);
      
      return this.parseResponse(response.data);
      
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

  // Check account balance
  async checkBalance() {
    try {
      const response = await this.client.get('/balance');
      
      // Portal-02 might return different balance formats
      const balanceData = response.data;
      let balance = 0;
      let currency = 'GHS';
      
      if (balanceData.balance !== undefined) {
        balance = balanceData.balance;
      } else if (balanceData.wallet_balance !== undefined) {
        balance = balanceData.wallet_balance;
      } else if (balanceData.amount !== undefined) {
        balance = balanceData.amount;
      } else if (typeof balanceData === 'number') {
        balance = balanceData;
      }
      
      if (balanceData.currency) {
        currency = balanceData.currency;
      }
      
      return {
        success: true,
        balance: balance,
        currency: currency,
        raw: balanceData
      };
      
    } catch (error) {
      console.error('Portal-02 balance error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check transaction status
  async checkTransactionStatus(transactionId) {
    try {
      const response = await this.client.get(`/transaction/${transactionId}`);
      
      return {
        success: true,
        status: response.data.status,
        transactionId: response.data.transaction_id,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get data plans (if available)
  async getDataPlans() {
    try {
      const response = await this.client.get('/plans');
      return {
        success: true,
        plans: response.data
      };
    } catch (error) {
      console.error('Get plans error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper: Format phone number for Ghana/Nigeria
  formatPhoneNumber(phone) {
    // Remove any non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle Ghana numbers (233XXXXXXXXX)
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.substring(1);
    }
    
    if (cleaned.startsWith('+233')) {
      cleaned = cleaned.substring(1);
    }
    
    // For Nigeria (234XXXXXXXXXX)
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      cleaned = '234' + cleaned.substring(1);
    }
    
    // Ensure Ghana numbers are 12 digits
    if (cleaned.startsWith('233') && cleaned.length === 10) {
      return cleaned;
    }
    
    // Ensure Nigeria numbers are 13 digits
    if (cleaned.startsWith('234') && cleaned.length === 13) {
      return cleaned;
    }
    
    return phone; // Return as-is if we can't format
  }

  // Helper: Get product code for Portal-02
  getProductCode(bundleSize, network) {
    const productCodes = {
      'MTN': {
        '1GB': 'mtn-1gb',
        '2GB': 'mtn-2gb',
        '5GB': 'mtn-5gb',
        '10GB': 'mtn-10gb',
        '1GB_NIGHT': 'mtn-1gb-night'
      },
      'Telecel': {
        '1GB': 'telecel-1gb',
        '2GB': 'telecel-2gb',
        '5GB': 'telecel-5gb',
        '10GB': 'telecel-10gb'
      },
      'AirtelTigo': {
        '1GB': 'airtel-1gb',
        '2GB': 'airtel-2gb',
        '5GB': 'airtel-5gb'
      },
      'Glo': {
        '1GB': 'glo-1gb',
        '2GB': 'glo-2gb',
        '5GB': 'glo-5gb'
      }
    };
    
    return productCodes[network]?.[bundleSize] || 
           `${network.toLowerCase()}-${bundleSize.toLowerCase().replace(' ', '-')}`;
  }

  // Helper: Calculate amount
  calculateAmount(bundleSize, network) {
    const prices = {
      'MTN': { '1GB': 5, '2GB': 10, '5GB': 20, '10GB': 35 },
      'Telecel': { '1GB': 4, '2GB': 8, '5GB': 18, '10GB': 32 },
      'AirtelTigo': { '1GB': 4, '2GB': 8, '5GB': 18 },
      'Glo': { '1GB': 3, '2GB': 6, '5GB': 15 }
    };
    
    return prices[network]?.[bundleSize] || 0;
  }

  // Helper: Parse Portal-02 response
  parseResponse(data) {
    // Portal-02 typical response structure
    if (data.status === 'success' || data.success === true) {
      return {
        success: true,
        transactionId: data.transaction_id || data.id || `PORTAL02_${Date.now()}`,
        reference: data.reference || data.reference_id,
        status: data.status || 'success',
        message: data.message || 'Data purchase successful',
        raw: data
      };
    } else {
      return {
        success: false,
        transactionId: data.transaction_id,
        status: data.status || 'failed',
        message: data.message || data.error || 'Purchase failed',
        raw: data
      };
    }
  }
}

module.exports = new Portal02Service();