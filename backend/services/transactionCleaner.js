const mongoose = require('mongoose');

class TransactionCleaner {
  // We remove the broken 'require' and use a constructor to receive the model
  constructor(OrderModel) {
    this.Order = OrderModel;
    console.log('🔄 Transaction Cleaner Service Initialized');
  }

  async cleanOldTransactions() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      console.log(`🧹 Cleaning transactions older than: ${twentyFourHoursAgo.toISOString()}`);
      
      const result = await this.Order.updateMany(
        {
          createdAt: { $lt: twentyFourHoursAgo },
          isVisibleToUser: true,
          archived: false
        },
        {
          $set: {
            isVisibleToUser: false,
            archived: true,
            archiveReason: '24_hour_auto_clean',
            archivedAt: new Date()
          }
        }
      );
      
      console.log(`✅ Archived ${result.modifiedCount} old transactions`);
      return result;
    } catch (error) {
      console.error('❌ Error cleaning transactions:', error);
      throw error;
    }
  }

  // ... (keep the other methods like cleanUserTransactions but use this.Order instead of Order)
}

module.exports = TransactionCleaner;