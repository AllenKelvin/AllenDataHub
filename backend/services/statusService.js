// services/statusService.js
const mongoose = require('mongoose');

class StatusService {
  constructor() {
    this.statusFlow = {
      placed: {
        next: ['processing', 'cancelled', 'failed'],
        timeout: 10 * 60 * 1000, // 10 minutes
        description: 'Order received and awaiting processing'
      },
      processing: {
        next: ['delivered', 'processing_error', 'cancelled', 'failed', 'partially_delivered'],
        timeout: 15 * 60 * 1000, // 15 minutes
        description: 'Order is being processed by vendor'
      },
      processing_error: {
        next: ['processing', 'cancelled', 'failed'],
        description: 'Error during processing, retrying'
      },
      partially_delivered: {
        next: ['delivered', 'cancelled'],
        description: 'Some items delivered, some pending'
      },
      delivered: {
        next: [], // Final state
        description: 'Order successfully delivered'
      },
      cancelled: {
        next: [], // Final state
        description: 'Order cancelled by user or admin'
      },
      failed: {
        next: [], // Final state
        description: 'Order failed during processing'
      }
    };
  }

  async updateOrderStatus(orderId, newStatus, reason = null) {
    try {
      const Order = mongoose.model('Order');
      const order = await Order.findById(orderId);
      
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Validate status transition
      if (!this.isValidTransition(order.status, newStatus)) {
        throw new Error(`Invalid status transition: ${order.status} → ${newStatus}`);
      }

      // Update order
      order.status = newStatus;
      order.updatedAt = new Date();
      
      if (reason) {
        order.statusReason = reason;
      }

      await order.save();

      console.log(`✅ Order ${orderId} status updated: ${order.status} → ${newStatus} (Reason: ${reason || 'N/A'})`);

      // If moving to processing, schedule automatic progression
      if (newStatus === 'processing') {
        this.scheduleStatusProgression(orderId, 'processing', 'delivered');
      }

      return order;
    } catch (error) {
      console.error(`❌ Error updating order status: ${error.message}`);
      throw error;
    }
  }

  isValidTransition(currentStatus, newStatus) {
    const allowedNext = this.statusFlow[currentStatus]?.next || [];
    return allowedNext.includes(newStatus);
  }

  scheduleStatusProgression(orderId, fromStatus, toStatus) {
    const timeout = this.statusFlow[fromStatus]?.timeout;
    
    if (!timeout) return;

    console.log(`⏰ Scheduling ${fromStatus} → ${toStatus} for order ${orderId} in ${timeout/60000} minutes`);

    setTimeout(async () => {
      try {
        const Order = mongoose.model('Order');
        const order = await Order.findById(orderId);
        
        // Only auto-progress if still in the same state
        if (order && order.status === fromStatus) {
          console.log(`🔄 Auto-progressing order ${orderId} from ${fromStatus} to ${toStatus}`);
          
          // Check if vendor webhook has already updated it
          const hasDelivered = order.processingResults?.some(r => 
            r.status === 'delivered' || r.status === 'resolved'
          );
          
          if (!hasDelivered) {
            await this.updateOrderStatus(orderId, toStatus, 'Auto-progressed by system timer');
          } else {
            console.log(`⏭️ Skipping auto-progression for order ${orderId} - already delivered via webhook`);
          }
        }
      } catch (error) {
        console.error(`❌ Error in auto-progression: ${error.message}`);
      }
    }, timeout);
  }

  async getOrderStatusTimeline(orderId) {
    const Order = mongoose.model('Order');
    const order = await Order.findById(orderId);
    
    if (!order) return null;

    const timeline = [
      { 
        status: 'created', 
        timestamp: order.createdAt,
        description: 'Order created'
      },
      { 
        status: order.paymentStatus === 'success' ? 'paid' : 'payment_pending', 
        timestamp: order.updatedAt,
        description: order.paymentStatus === 'success' ? 'Payment successful' : 'Awaiting payment'
      }
    ];

    // Add status changes from webhook history
    if (order.webhookHistory) {
      order.webhookHistory.forEach(webhook => {
        timeline.push({
          status: webhook.status,
          timestamp: webhook.timestamp || webhook.receivedAt,
          description: `Vendor update: ${webhook.status}`,
          source: 'portal02_webhook'
        });
      });
    }

    // Add current status
    timeline.push({
      status: order.status,
      timestamp: order.updatedAt,
      description: this.statusFlow[order.status]?.description || 'Current status',
      source: 'current'
    });

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return {
      orderId,
      currentStatus: order.status,
      paymentStatus: order.paymentStatus,
      timeline,
      estimatedCompletion: this.getEstimatedCompletion(order),
      canCancel: this.canCancel(order.status),
      nextPossibleStatuses: this.statusFlow[order.status]?.next || []
    };
  }

  getEstimatedCompletion(order) {
    if (order.status === 'delivered' || order.status === 'cancelled' || order.status === 'failed') {
      return null;
    }

    const baseTime = new Date(order.createdAt);
    let totalTime = 25 * 60 * 1000; // 25 minutes default
    
    // Adjust based on current status
    if (order.status === 'placed') {
      totalTime = 25 * 60 * 1000; // 25 minutes from placed
    } else if (order.status === 'processing') {
      totalTime = 15 * 60 * 1000; // 15 minutes remaining
    }
    
    const estimate = new Date(baseTime.getTime() + totalTime);
    const timeRemaining = Math.max(0, estimate.getTime() - Date.now());
    
    return {
      estimatedAt: estimate,
      timeRemaining: timeRemaining,
      formatted: `${Math.ceil(timeRemaining / 60000)} minutes remaining`,
      percentComplete: Math.min(95, Math.floor(((Date.now() - baseTime.getTime()) / totalTime) * 100))
    };
  }

  canCancel(status) {
    const cancellableStatuses = ['placed', 'processing', 'processing_error'];
    return cancellableStatuses.includes(status);
  }

  async cancelOrder(orderId, reason = 'Cancelled by user') {
    try {
      const order = await this.updateOrderStatus(orderId, 'cancelled', reason);
      
      // Log cancellation
      console.log(`🗑️ Order ${orderId} cancelled: ${reason}`);
      
      return {
        success: true,
        order,
        message: 'Order cancelled successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async retryOrder(orderId) {
    try {
      const Order = mongoose.model('Order');
      const order = await Order.findById(orderId);
      
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Only retry from certain states
      if (!['processing_error', 'failed'].includes(order.status)) {
        throw new Error(`Cannot retry order from status: ${order.status}`);
      }

      // Update to processing
      order.status = 'processing';
      order.updatedAt = new Date();
      order.statusReason = 'Retrying order';
      await order.save();

      // Schedule progression again
      this.scheduleStatusProgression(orderId, 'processing', 'delivered');

      return {
        success: true,
        order,
        message: 'Order retry initiated'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new StatusService();