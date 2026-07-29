const FoodItem = require('../../models/FoodItem');
const { logAudit } = require('../../middlewares/auditLogger');

exports.createItem = async (req, res) => {
  try {
    const item = new FoodItem(req.body);
    await item.save();

    await logAudit(req.user._id, 'CREATE_FOOD_ITEM', 'FoodItem', item._id, {}, req.body, req.ip);

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error creating food item', error: error.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Food item not found' });

    const originalData = item.toObject();
    Object.assign(item, req.body);
    await item.save();

    await logAudit(req.user._id, 'UPDATE_FOOD_ITEM', 'FoodItem', item._id, originalData, req.body, req.ip);

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error updating food item', error: error.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Food item not found' });

    item.isDeleted = true;
    item.isAvailable = false;
    await item.save();

    await logAudit(req.user._id, 'DELETE_FOOD_ITEM', 'FoodItem', item._id, { isDeleted: false }, { isDeleted: true }, req.ip);

    res.json({ message: 'Food item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting food item', error: error.message });
  }
};

exports.getItems = async (req, res) => {
  try {
    const items = await FoodItem.find({ isDeleted: false })
      .populate('category', 'name isActive')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching food items', error: error.message });
  }
};

exports.toggleAvailability = async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Food item not found' });

    item.isAvailable = !item.isAvailable;
    await item.save();

    await logAudit(req.user._id, 'TOGGLE_FOOD_ITEM_AVAILABILITY', 'FoodItem', item._id, { isAvailable: !item.isAvailable }, { isAvailable: item.isAvailable }, req.ip);

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error toggling availability', error: error.message });
  }
};
