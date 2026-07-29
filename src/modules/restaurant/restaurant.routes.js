const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');

const foodCategoryController = require('./foodCategory.controller');
const foodItemController = require('./foodItem.controller');
const foodOrderController = require('./foodOrder.controller');
const menuController = require('./menu.controller');

// ==========================================
// ADMIN / STAFF API
// ==========================================
// Auth middleware required

router.use(authMiddleware);

// Categories
router.get('/categories', requirePermission(PERMISSIONS.RESTAURANT.VIEW), foodCategoryController.getCategories);
router.post('/categories', requirePermission(PERMISSIONS.RESTAURANT.MANAGE_FOOD), foodCategoryController.createCategory);
router.put('/categories/:id', requirePermission(PERMISSIONS.RESTAURANT.MANAGE_FOOD), foodCategoryController.updateCategory);
router.delete('/categories/:id', requirePermission(PERMISSIONS.RESTAURANT.MANAGE_FOOD), foodCategoryController.deleteCategory);

// Items
router.get('/items', requirePermission(PERMISSIONS.RESTAURANT.VIEW), foodItemController.getItems);
router.post('/items', requirePermission(PERMISSIONS.RESTAURANT.MANAGE_FOOD), foodItemController.createItem);
router.put('/items/:id', requirePermission(PERMISSIONS.RESTAURANT.MANAGE_FOOD), foodItemController.updateItem);
router.delete('/items/:id', requirePermission(PERMISSIONS.RESTAURANT.MANAGE_FOOD), foodItemController.deleteItem);
router.patch('/items/:id/availability', requirePermission(PERMISSIONS.RESTAURANT.MANAGE_FOOD), foodItemController.toggleAvailability);

// Orders
router.get('/orders', requirePermission(PERMISSIONS.RESTAURANT.PROCESS_ORDERS), foodOrderController.getOrders);
router.patch('/orders/:id/status', requirePermission(PERMISSIONS.RESTAURANT.PROCESS_ORDERS), foodOrderController.updateOrderStatus);

module.exports = router;
