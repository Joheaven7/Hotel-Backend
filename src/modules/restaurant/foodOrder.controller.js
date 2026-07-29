const FoodOrder = require('../../models/FoodOrder');
const { FOOD_ORDER_STATUS } = require('../../config/constants');
const { createNotification } = require('../../services/notificationService');
const { logAudit } = require('../../middlewares/auditLogger');

exports.getOrders = async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const orders = await FoodOrder.find(filter)
      .populate('room', 'roomNumber type floor')
      .populate('items.foodItem', 'name category image')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await FoodOrder.findById(req.params.id)
      .populate('room', 'roomNumber qrToken');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const validStatuses = Object.values(FOOD_ORDER_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const oldStatus = order.status;
    order.status = status;
    await order.save();

    await logAudit(req.user._id, 'UPDATE_FOOD_ORDER_STATUS', 'FoodOrder', order._id, { status: oldStatus }, { status }, req.ip);

    // Notify guest menu via Socket.io using the roomToken as the socket room identifier
    if (req.io) {
      req.io.to(`room_${order.room.qrToken}`).emit('orderStatusUpdated', {
        orderNumber: order.orderNumber,
        status: order.status,
      });

      // Also broadcast to staff dashboards depending on status
      if (status === FOOD_ORDER_STATUS.PREPARING || status === FOOD_ORDER_STATUS.READY) {
        req.io.to('staff_restaurant').emit('orderUpdated', order);
      }
    }

    // System notifications for specific transitions
    if (status === FOOD_ORDER_STATUS.READY) {
      createNotification(req.io, {
        title: 'Order Ready for Delivery',
        message: `Order ${order.orderNumber} for Room ${order.room.roomNumber} is ready.`,
        type: 'ORDER_READY',
        targetRoles: ['ROOM_SERVICE_STAFF', 'RESTAURANT_MANAGER', 'SUPER_ADMIN'],
        resourceId: order._id,
        resourceType: 'FoodOrder',
      });
    }

    if (status === FOOD_ORDER_STATUS.DELIVERED) {
      createNotification(req.io, {
        title: 'Order Delivered',
        message: `Order ${order.orderNumber} was delivered to Room ${order.room.roomNumber}.`,
        type: 'ORDER_DELIVERED',
        targetRoles: ['RESTAURANT_MANAGER', 'SUPER_ADMIN'],
        resourceId: order._id,
        resourceType: 'FoodOrder',
      });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
};
