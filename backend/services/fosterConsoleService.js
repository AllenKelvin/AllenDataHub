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
  async purchaseDataBundle(phoneNumber, bundleSize, network, orderReference) {
    try {
      console.log(`🛒 Purchasing ${bundleSize} for ${network} to ${phoneNumber}`);
      
      // Validate inputs
      if (!phoneNumber || !bundleSize || !network) {
        throw new Error('Missing required parameters: phoneNumber, bundleSize, network');
      }

      if (!this.networkIds[network]) {
        throw new Error(`Unsupported network: ${network}`);
      }

      // Extract volume from bundleSize (e.g., "1GB" -> 1)
      const volumeMatch = bundleSize.match(/(\d+)/);
      const volume = volumeMatch ? parseInt(volumeMatch[1]) : 0;
      
      if (volume === 0) {
        throw new Error(`Invalid bundle size format: ${bundleSize}`);
      }

      // Check if volume is available for this network
      const available = this.availableVolumes[network];
      if (!available || !available.includes(volume)) {
        throw new Error(`${volume}GB is not available for ${network}. Available: ${available ? available.join(', ') : 'none'}`);
      }

      // Convert GB to MB for Foster Console API (1GB = 1000MB in their system)
      const sharedBundle = volume * 1000; // Convert GB to MB

      let result;
      
      // Different endpoint for AirtelTigo (iShare) vs other networks
      if (network === 'AirtelTigo') {
        result = await this.purchaseIshareBundle(phoneNumber, sharedBundle, orderReference);
      } else {
        result = await this.purchaseOtherBundle(phoneNumber, this.networkIds[network], sharedBundle);
      }
      
      return {
        success: result.success || result.response_code === '200',
        transactionId: result.vendorTranxId || result.transaction_code,
        reference: orderReference,
        message: result.response_msg || result.message,
        status: 'pending',
        rawResponse: result
      };
      
    } catch (error) {
      console.error('❌ Purchase failed:', error.message);
      return {
        success: false,
        error: error.message,
        reference: orderReference,
        status: 'failed'
      };
    }
  }

  // Purchase iShare bundle (AirtelTigo)
  async purchaseIshareBundle(phoneNumber, sharedBundle, orderReference) {
    try {
      const payload = {
        recipient_msisdn: phoneNumber,
        shared_bundle: sharedBundle,
        order_reference: orderReference || `ISHARE-${Date.now()}`
      };
      
      console.log('📤 Purchasing iShare bundle:', payload);
      const response = await this.api.post('/buy-ishare-package', payload);
      
      return response.data;
      
    } catch (error) {
      console.error('❌ iShare purchase failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
        throw new Error(error.response.data.response_msg || error.message);
      }
      throw error;
    }
  }

  // Purchase other network bundle (MTN, Telecel)
  async purchaseOtherBundle(phoneNumber, networkId, sharedBundle) {
    try {
      const payload = {
        recipient_msisdn: phoneNumber,
        network_id: networkId,
        shared_bundle: sharedBundle
      };
      
      console.log('📤 Purchasing other bundle:', payload);
      const response = await this.api.post('/buy-other-package', payload);
      
      return response.data;
      
    } catch (error) {
      console.error('❌ Other network purchase failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
        throw new Error(error.response.data.message || error.message);
      }
      throw error;
    }
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