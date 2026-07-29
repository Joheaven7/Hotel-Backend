const FoodCategory = require('../../models/FoodCategory');
const { logAudit } = require('../../middlewares/auditLogger');

exports.createCategory = async (req, res) => {
  try {
    const category = new FoodCategory(req.body);
    await category.save();

    await logAudit(req.user._id, 'CREATE_FOOD_CATEGORY', 'FoodCategory', category._id, {}, req.body, req.ip);

    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Category name already exists' });
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await FoodCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const originalData = category.toObject();
    Object.assign(category, req.body);
    await category.save();

    await logAudit(req.user._id, 'UPDATE_FOOD_CATEGORY', 'FoodCategory', category._id, originalData, req.body, req.ip);

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await FoodCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    category.isDeleted = true;
    category.isActive = false;
    await category.save();

    await logAudit(req.user._id, 'DELETE_FOOD_CATEGORY', 'FoodCategory', category._id, { isDeleted: false }, { isDeleted: true }, req.ip);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await FoodCategory.find({ isDeleted: false }).sort({ displayOrder: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};
