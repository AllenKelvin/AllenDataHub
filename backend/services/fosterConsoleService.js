// services/fosterConsoleService.js
const axios = require('axios');
require('dotenv').config();

class FosterConsoleService {
  constructor() {
    this.baseURL = process.env.FOSTER_CONSOLE_BASE_URL || 'https://fgamall.researchershubgh.com/api';
    this.apiKey = process.env.FOSTER_CONSOLE_API_KEY;
    this.backendUrl = process.env.BACKEND_URL || 'https://allen-data-hub-backend.onrender.com';
    
    // Available volumes based on Foster Console API
    this.availableVolumes = {
      'MTN': [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
      'Telecel': [5, 10, 15, 20, 25, 30, 40, 50, 100],
      'AirtelTigo': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20]
    };

    // Network IDs for Foster Console API
    this.networkIds = {
      'MTN': 3,
      'Telecel': 2,
      'AirtelTigo': 1
    };

    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // Test connection to Foster Console API
  async testConnection() {
    try {
      console.log('🔌 Testing Foster Console connection...');
      
      // Try to check balance first (requires valid API key)
      const response = await this.api.get('/check-console-balance');
      
      if (response.data.error === 'Invalid or inactive API key.') {
        return {
          connected: false,
          authenticated: false,
          message: 'Invalid or inactive API key',
          error: response.data.error
        };
      }
      
      return {
        connected: true,
        authenticated: true,
        message: 'Connected successfully',
        balance: response.data.userConsoleWalletBalance,
        shareBalance: response.data.userConsoleShareBalance
      };
      
    } catch (error) {
      console.error('❌ Foster Console connection test failed:', error.message);
      
      if (error.response) {
        console.error('Response error:', error.response.data);
        
        if (error.response.status === 401 || error.response.status === 403) {
          return {
            connected: false,
            authenticated: false,
            message: 'Authentication failed - Check API key',
            error: error.response.data.error || error.message
          };
        }
      }
      
      return {
        connected: false,
        authenticated: false,
        message: 'Connection failed',
        error: error.message
      };
    }
  }

  // Fetch data packages from Foster Console
  async fetchDataPackages() {
    try {
      console.log('📦 Fetching data packages from Foster Console...');
      const response = await this.api.get('/fetch-data-packages');
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`✅ Found ${response.data.length} packages`);
        return {
          success: true,
          packages: response.data
        };
      }
      
      return {
        success: false,
        message: 'No packages found or invalid response format',
        packages: []
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch data packages:', error.message);
      return {
        success: false,
        error: error.message,
        packages: []
      };
    }
  }

  // Check Foster Console balance
  async checkBalance() {
    try {
      const response = await this.api.get('/check-console-balance');
      
      if (response.data.error) {
        return {
          success: false,
          error: response.data.error
        };
      }
      
      return {
        success: true,
        walletBalance: parseFloat(response.data.userConsoleWalletBalance),
        shareBalance: parseFloat(response.data.userConsoleShareBalance),
        message: response.data.message
      };
      
    } catch (error) {
      console.error('❌ Failed to check balance:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Purchase data bundle (main function)
  async purchaseDataBundle(phone, size, network, reference) {
    try {
        const volumeInMb = this.parseSizeToMb(size);
        const networkUpper = network.toUpperCase();

        // 1. ROUTING LOGIC: MTN always goes to iShare 
        // AirtelTigo (AT) and Telecel go to Other [cite: 58, 59, 83]
        if (networkUpper === 'MTN') {
            return await this.purchaseIsharePackage({
                recipient_msisdn: phone,
                shared_bundle: volumeInMb,
                order_reference: reference // Foster uses reference for iShare [cite: 70]
            });
        } else {
            const networkId = networkUpper === 'AIRTELTIGO' || networkUpper === 'AT' ? 1 : 2; // 
            return await this.purchaseOtherPackage({
                recipient_msisdn: phone,
                network_id: networkId, // [cite: 88]
                shared_bundle: volumeInMb // [cite: 89]
            });
        }
    } catch (error) {
        throw error;
    }
}

// Use Hardcoded Full URLs to eliminate 404 Route errors 
async purchaseIsharePackage(payload) {
    const response = await this.api.post('https://fgamall.researchershubgh.com/api/buy-ishare-package', payload);
    return response.data;
}

async purchaseOtherPackage(payload) {
    const response = await this.api.post('https://fgamall.researchershubgh.com/api/buy-other-package', payload);
    return response.data;
}

// Helper function to convert size strings to MB for the vendor
  parseSizeToMb(size) {
    if (!size) return 0;
    
    // Extracts the number from strings like "1GB" or "500MB"
    const volumeMatch = size.match(/(\d+)/);
    const volume = volumeMatch ? parseInt(volumeMatch[1]) : 0;
    
    // If the string contains "GB", multiply by 1000 as per Foster requirements [cite: 40, 69]
    if (size.toUpperCase().includes('GB')) {
      return volume * 1000;
    }
    
    return volume;
  }

 // Check order status
  async checkOrderStatus(transactionId, network) {
    try {
      console.log(`🔍 Checking status for transaction: ${transactionId}`);
      
      // Based on network type, use different endpoint
      if (network === 'AirtelTigo') {
        const response = await this.api.post('/fetch-ishare-transaction', {
          transaction_id: transactionId
        });
        
        return {
          success: true,
          status: 'delivered', // Assuming success if we get a response
          order: response.data,
          transactionId: transactionId
        };
      } else {
        // For other networks, we need to fetch all and filter
        const response = await this.api.get('/fetch-other-network-transactions');
        
        if (response.data && Array.isArray(response.data)) {
          const transaction = response.data.find(tx => tx.transaction_code === transactionId);
          
          if (transaction) {
            return {
              success: true,
              status: transaction.status || 'processing',
              order: transaction,
              transactionId: transactionId
            };
          }
        }
        
        return {
          success: false,
          status: 'not_found',
          message: 'Transaction not found',
          transactionId: transactionId
        };
      }
      
    } catch (error) {
      console.error('❌ Failed to check order status:', error.message);
      return {
        success: false,
        status: 'check_failed',
        error: error.message,
        transactionId: transactionId
      };
    }
  }

  // Process webhook payload from Foster Console
  processWebhookPayload(payload) {
    try {
      console.log('🔔 Processing Foster Console webhook payload');
      
      // Extract relevant data from payload
      // Adjust this based on actual Foster Console webhook format
      const orderId = payload.transaction_id || payload.reference || payload.id;
      const reference = payload.order_reference || payload.reference;
      const status = payload.status || 'processing';
      const recipient = payload.recipient_msisdn || payload.phone;
      const volume = payload.shared_bundle ? payload.shared_bundle / 1000 : 0; // Convert MB to GB
      
      if (!orderId) {
        return {
          success: false,
          error: 'Missing orderId in webhook payload'
        };
      }
      
      return {
        success: true,
        orderId,
        reference,
        status: this.mapStatus(status),
        recipient,
        volume,
        timestamp: new Date(payload.timestamp || Date.now()),
        event: payload.event || 'order.status.updated'
      };
      
    } catch (error) {
      console.error('❌ Failed to process webhook payload:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Map Foster Console status to our system status
  mapStatus(fosterStatus) {
    const statusMap = {
      'success': 'delivered',
      'delivered': 'delivered',
      'resolved': 'delivered',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'refunded': 'failed',
      'processing': 'processing',
      'pending': 'processing'
    };
    
    return statusMap[fosterStatus?.toLowerCase()] || 'processing';
  }

  // Fetch iShare transactions
  async fetchIshareTransactions() {
    try {
      const response = await this.api.get('/fetch-ishare-transactions');
      return {
        success: true,
        transactions: response.data || []
      };
    } catch (error) {
      console.error('❌ Failed to fetch iShare transactions:', error.message);
      return {
        success: false,
        error: error.message,
        transactions: []
      };
    }
  }

  // Fetch other network transactions
  async fetchOtherNetworkTransactions() {
    try {
      const response = await this.api.get('/fetch-other-network-transactions');
      return {
        success: true,
        transactions: response.data || []
      };
    } catch (error) {
      console.error('❌ Failed to fetch other network transactions:', error.message);
      return {
        success: false,
        error: error.message,
        transactions: []
      };
    }
  }
}

module.exports = new FosterConsoleService();