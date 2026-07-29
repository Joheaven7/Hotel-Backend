const Department = require('../../models/Department');
const User = require('../../models/User');

// Create a department
exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Department name is required' });
    }

    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Department already exists' });
    }

    const dept = new Department({ name: name.trim() });
    await dept.save();

    res.status(201).json({ message: 'Department created successfully', department: dept });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create department', error: error.message });
  }
};

// Get all departments
exports.getAllDepartments = async (req, res) => {
  try {
    const depts = await Department.find().sort({ name: 1 });
    res.json(depts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch departments', error: error.message });
  }
};

// Rename / Edit department
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const oldName = dept.name;

    if (name && name.trim() !== dept.name) {
      const existing = await Department.findOne({ name: name.trim() });
      if (existing) {
        return res.status(400).json({ message: 'Department name already exists' });
      }
      dept.name = name.trim();

      // If renamed, update all users currently belonging to it
      await User.updateMany({ department: oldName }, { department: name.trim() });
    }

    if (isActive !== undefined) {
      dept.isActive = isActive;
    }

    await dept.save();
    res.json({ message: 'Department updated successfully', department: dept });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update department', error: error.message });
  }
};

// Delete department if not in use
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check if any user belongs to this department
    const count = await User.countDocuments({ department: dept.name });
    if (count > 0) {
      return res.status(400).json({ message: 'Cannot delete department: It is currently assigned to users' });
    }

    await Department.findByIdAndDelete(id);
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete department', error: error.message });
  }
};

// View all users within a department
exports.getDepartmentUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const users = await User.find({ department: dept.name }).select('-password -refreshToken');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch department users', error: error.message });
  }
};
