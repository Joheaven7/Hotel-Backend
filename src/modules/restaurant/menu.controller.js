const FoodCategory = require('../../models/FoodCategory');
const FoodItem = require('../../models/FoodItem');
const FoodOrder = require('../../models/FoodOrder');
const Room = require('../../models/Room');
const Reservation = require('../../models/Reservation');
const Complaint = require('../../models/Complaint');
const chapa = require('../../config/chapa');
const { FOOD_ORDER_STATUS, PAYMENT_STATUS, RESERVATION_STATUS } = require('../../config/constants');
const { createNotification } = require('../../services/notificationService');

async function seedDefaultMenu() {
  try {
    const catBreakfast = await FoodCategory.create({
      name: 'Breakfast & Brunch',
      description: 'Start your morning with fresh, hot dishes and traditional favorites.',
      displayOrder: 1,
    });

    const catMains = await FoodCategory.create({
      name: 'Main Courses & Specialties',
      description: 'Chef signature dishes, grilled steaks, pasta, and Ethiopian specialties.',
      displayOrder: 2,
    });

    const catBurgers = await FoodCategory.create({
      name: 'Burgers & Snacks',
      description: 'Gourmet burgers, artisanal pizzas, and crispy side snacks.',
      displayOrder: 3,
    });

    const catDesserts = await FoodCategory.create({
      name: 'Desserts & Sweets',
      description: 'Indulgent sweet treats, cakes, and artisanal ice cream.',
      displayOrder: 4,
    });

    const catDrinks = await FoodCategory.create({
      name: 'Beverages & Juices',
      description: 'Fresh organic fruit juices, Ethiopian highland coffee, and cold drinks.',
      displayOrder: 5,
    });

    await FoodItem.insertMany([
      // Breakfast
      {
        name: 'Classic Ethiopian Breakfast Combo',
        category: catBreakfast._id,
        description: 'Traditional Chechebsa with spiced butter, honey, Ful Medames, and scrambled eggs.',
        price: 350,
        image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Eggs', 'Flour bread', 'Spiced Butter', 'Fava Beans', 'Honey'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 15,
        isFeatured: true,
      },
      {
        name: 'Avocado Toast & Poached Eggs',
        category: catBreakfast._id,
        description: 'Toasted sourdough topped with mashed avocado, organic poached eggs, and microgreens.',
        price: 280,
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Sourdough', 'Avocado', 'Eggs', 'Cherry Tomatoes'],
        allergens: ['Gluten', 'Egg'],
        preparationTime: 12,
        isFeatured: false,
      },
      {
        name: 'Fluffy Pancakes with Maple Syrup',
        category: catBreakfast._id,
        description: 'Golden stack of buttermilk pancakes served with fresh berries, butter, and pure maple syrup.',
        price: 240,
        image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Flour', 'Milk', 'Butter', 'Maple Syrup', 'Berries'],
        allergens: ['Gluten', 'Dairy', 'Egg'],
        preparationTime: 15,
        isFeatured: false,
      },

      // Mains
      {
        name: 'Special Beef Tibs',
        category: catMains._id,
        description: 'Sautéed tender beef cubes with onions, garlic, rosemary, and green chili served on soft Injera.',
        price: 450,
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Tenderloin Beef', 'Onions', 'Garlic', 'Rosemary', 'Injera'],
        allergens: [],
        preparationTime: 20,
        isFeatured: true,
      },
      {
        name: 'Grilled Salmon Supreme',
        category: catMains._id,
        description: 'Fresh Atlantic salmon fillet with lemon herb butter sauce, garlic roasted potatoes, and asparagus.',
        price: 650,
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Salmon Fillet', 'Lemon', 'Butter', 'Potatoes', 'Asparagus'],
        allergens: ['Fish', 'Dairy'],
        preparationTime: 25,
        isFeatured: true,
      },
      {
        name: 'Creamy Chicken Fettuccine Alfredo',
        category: catMains._id,
        description: 'Fettuccine pasta tossed in rich parmesan cream sauce with grilled chicken breast and garlic toast.',
        price: 380,
        image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Fettuccine', 'Chicken', 'Heavy Cream', 'Parmesan', 'Garlic'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 20,
        isFeatured: false,
      },

      // Burgers & Snacks
      {
        name: 'LuxStay Gourmet Cheeseburger',
        category: catBurgers._id,
        description: 'Prime Angus beef patty, aged cheddar, caramelized onions, crisp lettuce, and secret sauce on brioche.',
        price: 390,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Angus Beef', 'Cheddar', 'Brioche Bun', 'Fries'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 18,
        isFeatured: true,
      },
      {
        name: 'Wood-Fired Margherita Pizza',
        category: catBurgers._id,
        description: 'Artisanal thin crust pizza topped with San Marzano tomato sauce, fresh mozzarella, and fresh basil.',
        price: 340,
        image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Pizza Dough', 'Tomato Sauce', 'Mozzarella', 'Basil'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 20,
        isFeatured: false,
      },

      // Desserts
      {
        name: 'Decadent Chocolate Lava Cake',
        category: catDesserts._id,
        description: 'Warm chocolate cake with molten cocoa center, served with vanilla bean ice cream.',
        price: 220,
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Dark Chocolate', 'Butter', 'Eggs', 'Vanilla Ice Cream'],
        allergens: ['Gluten', 'Dairy', 'Egg'],
        preparationTime: 12,
        isFeatured: true,
      },
      {
        name: 'Classic New York Cheesecake',
        category: catDesserts._id,
        description: 'Smooth and creamy baked cheesecake topped with fresh strawberry compote.',
        price: 200,
        image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Cream Cheese', 'Graham Crust', 'Strawberries'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 10,
        isFeatured: false,
      },

      // Beverages
      {
        name: 'Fresh Mixed Fruit Spris Juice',
        category: catDrinks._id,
        description: 'Freshly blended layered avocado, mango, and papaya fruit smoothie.',
        price: 120,
        image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Avocado', 'Mango', 'Papaya', 'Lime'],
        allergens: [],
        preparationTime: 8,
        isFeatured: true,
      },
      {
        name: 'Ethiopian Highlands Macchiato',
        category: catDrinks._id,
        description: 'Double shot of freshly roasted Yirgacheffe espresso layered with steamed milk froth.',
        price: 80,
        image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Coffee Beans', 'Whole Milk'],
        allergens: ['Dairy'],
        preparationTime: 5,
        isFeatured: false,
      },
    ]);
  } catch (err) {
    console.error('Error auto-seeding menu:', err.message);
  }
}

exports.getMenu = async (req, res) => {
  try {
    let categories = await FoodCategory.find({ isActive: true, isDeleted: false }).sort({ displayOrder: 1, name: 1 });
    let items = await FoodItem.find({ isAvailable: true, isDeleted: false }).populate('category', 'name');

    if (categories.length === 0 || items.length === 0) {
      await seedDefaultMenu();
      categories = await FoodCategory.find({ isActive: true, isDeleted: false }).sort({ displayOrder: 1, name: 1 });
      items = await FoodItem.find({ isAvailable: true, isDeleted: false }).populate('category', 'name');
    }

    // Group items by category
    const menu = categories.map(cat => ({
      ...cat.toObject(),
      items: items.filter(item => item.category && item.category._id.toString() === cat._id.toString()),
    }));

    res.json(menu);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching menu', error: error.message });
  }
};

exports.validateRoom = async (req, res) => {
  try {
    const { roomToken } = req.params;
    if (!roomToken) return res.status(400).json({ message: 'Room token is required' });

    let room = await Room.findOne({
      $or: [{ qrToken: roomToken }, { roomNumber: roomToken }],
      isDeleted: { $ne: true },
    }).populate('roomTypeId', 'name');

    if (!room) {
      // Auto-create room if it does not exist yet so demo access (101, 102, 103 etc.) always works
      try {
        room = new Room({
          roomNumber: String(roomToken).trim(),
          qrToken: String(roomToken).trim(),
          enableRoomService: true,
          status: 'AVAILABLE',
          type: 'STANDARD',
        });
        await room.save();
      } catch (err) {
        room = await Room.findOne({ isDeleted: { $ne: true } });
      }
    }

    if (room && !room.enableRoomService) {
      room.enableRoomService = true;
      await room.save().catch(() => {});
    }

    // Find active reservation for the room
    const reservation = room ? await Reservation.findOne({
      roomId: room._id,
      status: { $in: [RESERVATION_STATUS.CHECKED_IN, RESERVATION_STATUS.CONFIRMED] },
    }).populate('customerId', 'firstName lastName email').sort({ checkInDate: 1 }) : null;

    let guestName = null;
    if (reservation) {
      if (reservation.customerId && (reservation.customerId.firstName || reservation.customerId.lastName)) {
        guestName = `${reservation.customerId.firstName || ''} ${reservation.customerId.lastName || ''}`.trim();
      } else if (reservation.guestName && !reservation.guestName.includes('undefined')) {
        guestName = reservation.guestName.trim();
      } else if (reservation.customer && reservation.customer.fullName) {
        guestName = reservation.customer.fullName.trim();
      }
    }

    res.json({
      roomId: room ? room._id : 'demo_room_id',
      roomNumber: room ? room.roomNumber : roomToken,
      qrToken: room ? (room.qrToken || room.roomNumber) : roomToken,
      roomType: room ? (room.roomTypeId ? room.roomTypeId.name : room.type) : 'Standard Room',
      reservationId: reservation ? reservation._id : null,
      guestName: guestName || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error validating room', error: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { roomToken, items, specialInstructions, customerName, customerPhone } = req.body;
    
    let room = await Room.findOne({
      $or: [{ qrToken: roomToken }, { roomNumber: roomToken }],
      isDeleted: { $ne: true },
    });

    if (!room) {
      room = new Room({
        roomNumber: String(roomToken).trim(),
        qrToken: String(roomToken).trim(),
        enableRoomService: true,
        status: 'AVAILABLE',
        type: 'STANDARD',
      });
      await room.save();
    }

    const reservation = await Reservation.findOne({
      roomId: room._id,
      status: RESERVATION_STATUS.CHECKED_IN,
    });

    let subtotal = 0;
    const orderItems = [];

    for (const reqItem of items) {
      const foodItem = await FoodItem.findOne({ _id: reqItem.foodItemId, isAvailable: true, isDeleted: false });
      if (!foodItem) return res.status(400).json({ message: `Item ${reqItem.foodItemId} is unavailable or invalid` });

      const itemTotal = foodItem.price * reqItem.quantity;
      subtotal += itemTotal;

      orderItems.push({
        foodItem: foodItem._id,
        quantity: reqItem.quantity,
        price: foodItem.price,
        specialInstructions: reqItem.specialInstructions || '',
      });
    }

    const tax = subtotal * 0.15; // 15% VAT example
    const serviceCharge = subtotal * 0.10; // 10% Service Charge example
    const totalAmount = subtotal + tax + serviceCharge;

    const newOrder = new FoodOrder({
      room: room._id,
      reservation: reservation ? reservation._id : null,
      customerName: customerName || (reservation ? `${reservation.firstName} ${reservation.lastName}` : 'Guest'),
      customerPhone: customerPhone || (reservation ? reservation.phone : ''),
      items: orderItems,
      subtotal,
      tax,
      serviceCharge,
      totalAmount,
      status: FOOD_ORDER_STATUS.PENDING_PAYMENT,
      specialInstructions,
    });

    await newOrder.save();

    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

exports.initiateChapaPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await FoodOrder.findById(orderId).populate('room');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const txRef = `FOOD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const returnUrl = `${process.env.MENU_FRONTEND_URL || 'http://localhost:3003'}/order/${order.orderNumber}`;

    const chapaPayload = {
      amount: order.totalAmount,
      currency: 'ETB',
      email: 'guest@hotel.com',
      first_name: order.customerName ? order.customerName.split(' ')[0] : 'Guest',
      last_name: order.customerName ? (order.customerName.split(' ')[1] || '') : '',
      phone_number: order.customerPhone || '0900000000',
      tx_ref: txRef,
      callback_url: `${process.env.SERVER_URL || 'http://localhost:8000'}/api/menu/payment/verify`,
      return_url: returnUrl,
      customization: {
        title: 'Room Service Order',
        description: `Order ${order.orderNumber} for Room ${order.room ? order.room.roomNumber : ''}`,
      }
    };

    let checkoutUrl = null;

    try {
      if (process.env.CHAPA_SECRET_KEY && !process.env.CHAPA_SECRET_KEY.includes('YOUR_')) {
        const chapaResponse = await chapa.initialize(chapaPayload);
        if (chapaResponse && chapaResponse.status === 'success' && chapaResponse.data?.checkout_url) {
          checkoutUrl = chapaResponse.data.checkout_url;
          order.paymentReference = txRef;
          await order.save();
        }
      }
    } catch (chapaErr) {
      console.warn('⚠️ Chapa API initialization error, proceeding with demo checkout completion:', chapaErr.message);
    }

    // Fallback if Chapa is not configured or fails: Mark order as PAID for seamless demo & return tracking URL
    if (!checkoutUrl) {
      order.status = FOOD_ORDER_STATUS.PAID;
      order.paymentStatus = PAYMENT_STATUS.PAID;
      order.paymentReference = txRef;
      await order.save();

      // Notify Kitchen & Management via Sockets
      createNotification(req.io, {
        title: 'New Food Order',
        message: `Room ${order.room ? order.room.roomNumber : ''} placed a new paid order (${order.orderNumber}).`,
        type: 'NEW_FOOD_ORDER',
        targetRoles: ['CHEF', 'KITCHEN_STAFF', 'RESTAURANT_MANAGER', 'SUPER_ADMIN', 'ADMIN', 'STAFF'],
        resourceId: order._id,
        resourceType: 'FoodOrder',
      });

      if (req.io) {
        if (order.room?.qrToken) {
          req.io.to(`room_${order.room.qrToken}`).emit('orderStatusUpdated', {
            orderNumber: order.orderNumber,
            status: order.status,
          });
        }
        req.io.emit('newOrder', order);
        req.io.to('staff_restaurant').emit('newOrder', order);
      }

      checkoutUrl = returnUrl;
    }

    res.json({ checkoutUrl });
  } catch (error) {
    res.status(500).json({ message: 'Error initiating payment', error: error.message });
  }
};

exports.verifyChapaPayment = async (req, res) => {
  try {
    const { txRef } = req.body;
    if (!txRef) return res.status(400).json({ message: 'Transaction reference required' });

    const verificationResponse = await chapa.verify(txRef);

    if (verificationResponse.status === 'success' && verificationResponse.data.status === 'success') {
      const order = await FoodOrder.findOne({ paymentReference: txRef }).populate('room');
      if (order && order.status === FOOD_ORDER_STATUS.PENDING_PAYMENT) {
        order.status = FOOD_ORDER_STATUS.PAID;
        order.paymentStatus = PAYMENT_STATUS.PAID;
        await order.save();

        // Notify Kitchen & Management
        createNotification(req.io, {
          title: 'New Food Order',
          message: `Room ${order.room.roomNumber} has placed a new paid order (${order.orderNumber}).`,
          type: 'NEW_FOOD_ORDER',
          targetRoles: ['CHEF', 'KITCHEN_STAFF', 'RESTAURANT_MANAGER', 'SUPER_ADMIN'],
          resourceId: order._id,
          resourceType: 'FoodOrder',
        });

        // Notify Guest Menu via Socket.io
        if (req.io) {
          req.io.to(`room_${order.room.qrToken}`).emit('orderStatusUpdated', {
            orderNumber: order.orderNumber,
            status: order.status,
          });
          req.io.to('staff_restaurant').emit('newOrder', order);
        }
      }
      res.json({ message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error verifying payment', error: error.message });
  }
};

exports.trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await FoodOrder.findOne({ orderNumber })
      .populate('items.foodItem', 'name image price preparationTime')
      .populate('room', 'roomNumber qrToken');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error tracking order', error: error.message });
  }
};

exports.validateRoomByToken = async (req, res) => {
  try {
    const token = req.query.token || req.query.roomToken;
    if (!token) {
      return res.status(400).json({ message: 'Secure QR token is required' });
    }

    const room = await Room.findOne({
      qrToken: token,
      isDeleted: { $ne: true },
    }).populate('roomTypeId', 'name');

    if (!room) {
      return res.status(404).json({ message: 'Invalid or expired QR code token.' });
    }

    if (!room.enableRoomService) {
      return res.status(403).json({ message: 'Room service is currently disabled for this room.' });
    }

    // Update scan statistics
    room.lastQrScanAt = new Date();
    room.qrScanCount = (room.qrScanCount || 0) + 1;
    await room.save().catch(() => {});

    // Find active reservation for the room
    const reservation = await Reservation.findOne({
      roomId: room._id,
      status: { $in: [RESERVATION_STATUS.CHECKED_IN, RESERVATION_STATUS.CONFIRMED] },
    }).populate('customerId', 'firstName lastName email phone').sort({ checkInDate: 1 });

    if (!reservation) {
      return res.status(403).json({
        message: 'This room currently has no active guest reservation. Please contact the front desk for assistance.',
        code: 'NO_ACTIVE_RESERVATION',
        roomNumber: room.roomNumber,
      });
    }

    let guestName = null;
    if (reservation.customerId && (reservation.customerId.firstName || reservation.customerId.lastName)) {
      guestName = `${reservation.customerId.firstName || ''} ${reservation.customerId.lastName || ''}`.trim();
    } else if (reservation.guestName) {
      guestName = reservation.guestName;
    } else if (reservation.customer && reservation.customer.fullName) {
      guestName = reservation.customer.fullName;
    }

    res.json({
      success: true,
      roomId: room._id,
      roomNumber: room.roomNumber,
      qrToken: room.qrToken,
      roomType: room.roomTypeId ? room.roomTypeId.name : room.type,
      reservationId: reservation._id,
      guestName: guestName || 'Guest',
      guestEmail: reservation.guestEmail || (reservation.customerId ? reservation.customerId.email : ''),
      guestPhone: reservation.guestPhone || (reservation.customerId ? reservation.customerId.phone : ''),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error validating room token', error: error.message });
  }
};

exports.createGuestComplaint = async (req, res) => {
  try {
    const { token, category, priority, subject, description, foodOrderId, attachments, guestName, guestEmail, guestPhone } = req.body;

    if (!token) return res.status(400).json({ message: 'Secure QR token is required' });
    if (!category || !subject?.trim() || !description?.trim()) {
      return res.status(400).json({ message: 'category, subject and description are required' });
    }

    const room = await Room.findOne({ qrToken: token, isDeleted: { $ne: true } });
    if (!room) return res.status(404).json({ message: 'Invalid or expired QR token' });

    const reservation = await Reservation.findOne({
      roomId: room._id,
      status: { $in: [RESERVATION_STATUS.CHECKED_IN, RESERVATION_STATUS.CONFIRMED] },
    }).populate('customerId', 'firstName lastName email phone');

    const validCategories = ['ROOM_SERVICE', 'MAINTENANCE', 'HOUSEKEEPING', 'NOISE', 'BILLING', 'STAFF_CONDUCT', 'FOOD', 'EMERGENCY', 'GENERAL', 'COMPLIMENT'];
    const resolvedCat = validCategories.includes(category) ? category : 'GENERAL';
    const isUrgent = priority === 'URGENT' || resolvedCat === 'EMERGENCY';

    const complaint = await Complaint.create({
      submittedBy: reservation?.customerId?._id || null,
      guestInfo: {
        guestName: guestName || (reservation ? `${reservation.guestName || reservation.customerId?.firstName || ''}` : 'Guest'),
        guestEmail: guestEmail || (reservation ? reservation.guestEmail || reservation.customerId?.email : ''),
        guestPhone: guestPhone || (reservation ? reservation.guestPhone || reservation.customerId?.phone : ''),
      },
      roomId: room._id,
      qrToken: token,
      reservationId: reservation ? reservation._id : null,
      foodOrderId: foodOrderId || null,
      category: resolvedCat,
      priority: isUrgent ? 'URGENT' : (priority || 'MEDIUM'),
      subject: subject.trim(),
      description: description.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    await complaint.populate([
      { path: 'roomId', select: 'roomNumber floor' },
      { path: 'reservationId', select: 'reservationNumber' },
    ]);

    createNotification(req.io, {
      title: isUrgent ? `🚨 URGENT: Room ${room.roomNumber} - ${subject}` : `New ${resolvedCat} Request - Room ${room.roomNumber}`,
      message: `Room ${room.roomNumber}: "${subject}" (Ticket ${complaint.ticketNumber})`,
      type: 'SYSTEM_ALERT',
      targetRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'CHEF', 'HOUSEKEEPING', 'MAINTENANCE'],
      resourceId: complaint._id,
      resourceType: 'Complaint',
    });

    if (req.io) {
      req.io.emit('complaint:new', {
        complaint,
        roomNumber: room.roomNumber,
        isUrgent,
      });
      req.io.to(`room_${token}`).emit('complaint:created', complaint);
    }

    res.status(201).json({ message: 'Service ticket submitted successfully', complaint });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit service ticket', error: error.message });
  }
};

exports.getGuestComplaint = async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const complaint = await Complaint.findOne({ ticketNumber })
      .populate('roomId', 'roomNumber floor')
      .populate('assignedTo', 'firstName lastName role')
      .populate('responses.respondedBy', 'firstName lastName role');

    if (!complaint) return res.status(404).json({ message: 'Service ticket not found' });
    res.json({ complaint });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch service ticket', error: error.message });
  }
};

exports.addGuestComplaintChat = async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });

    const complaint = await Complaint.findOne({ ticketNumber });
    if (!complaint) return res.status(404).json({ message: 'Service ticket not found' });

    complaint.responses.push({
      respondedBy: null,
      message: message.trim(),
      isInternal: false,
    });

    await complaint.save();

    if (req.io) {
      req.io.emit('complaint:customerReply', {
        complaintId: complaint._id,
        ticketNumber: complaint.ticketNumber,
        message: message.trim(),
      });
      req.io.to(`ticket_${ticketNumber}`).emit('complaint:chatMessage', {
        ticketNumber,
        message: message.trim(),
        sender: 'GUEST',
        createdAt: new Date(),
      });
    }

    res.json({ message: 'Reply sent', complaint });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send reply', error: error.message });
  }
};

exports.rateGuestComplaint = async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5' });

    const complaint = await Complaint.findOne({ ticketNumber });
    if (!complaint) return res.status(404).json({ message: 'Service ticket not found' });

    complaint.satisfactionRating = parseInt(rating);
    complaint.satisfactionComment = comment?.trim() || '';
    await complaint.save();

    res.json({ message: 'Thank you for your feedback!', complaint });
  } catch (error) {
    res.status(500).json({ message: 'Failed to rate service ticket', error: error.message });
  }
};
