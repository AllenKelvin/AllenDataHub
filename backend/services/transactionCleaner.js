const Order = require('../models/Order');
const mongoose = require('mongoose');

class TransactionCleaner {
  constructor() {
    console.log('🔄 Transaction Cleaner Service Initialized');
  }

  // Clean transactions older than 24 hours for all users
  async cleanOldTransactions() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      console.log(`🧹 Cleaning transactions older than: ${twentyFourHoursAgo.toISOString()}`);
      
      const result = await Order.updateMany(
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

  // Clean transactions for specific user only
  async cleanUserTransactions(userId, hours = 24) {
    try {
      const timeAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      console.log(`🧹 Cleaning transactions for user ${userId} older than ${hours} hours`);
      
      const result = await Order.updateMany(
        {
          userId: new mongoose.Types.ObjectId(userId),
          createdAt: { $lt: timeAgo },
          isVisibleToUser: true,
          archived: false
        },
        {
          $set: {
            isVisibleToUser: false,
            archived: true,
            archiveReason: `user_${hours}_hour_clean`,
            archivedAt: new Date()
          }
        }
      );
      
      console.log(`✅ Archived ${result.modifiedCount} transactions for user ${userId}`);
      return result;
    } catch (error) {
      console.error('❌ Error cleaning user transactions:', error);
      throw error;
    }
  }

  // Restore archived transactions (if needed)
  async restoreUserTransactions(userId) {
    try {
      const result = await Order.updateMany(
        {
          userId: new mongoose.Types.ObjectId(userId),
          archived: true
        },
        {
          $set: {
            isVisibleToUser: true,
            archived: false,
            archiveReason: null,
            archivedAt: null
          }
        }
      );
      
      console.log(`✅ Restored ${result.modifiedCount} transactions for user ${userId}`);
      return result;
    } catch (error) {
      console.error('❌ Error restoring user transactions:', error);
      throw error;
    }
  }

  // Get user's visible transactions only
  async getUserVisibleTransactions(userId) {
    try {
      const transactions = await Order.find({
        userId: new mongoose.Types.ObjectId(userId),
        isVisibleToUser: true,
        archived: false
      }).sort({ createdAt: -1 });
      
      return transactions;
    } catch (error) {
      console.error('❌ Error getting user transactions:', error);
      throw error;
    }
  }

  // Manual cleanup endpoint for testing
  async manualCleanup(userId = null) {
    if (userId) {
      return await this.cleanUserTransactions(userId, 24);
    } else {
      return await this.cleanOldTransactions();
    }
  }
}

module.exports = new TransactionCleaner();