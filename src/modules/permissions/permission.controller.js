const Permission = require('../../models/Permission');
const Role = require('../../models/Role');
const User = require('../../models/User');

// Create a permission
exports.createPermission = async (req, res) => {
  try {
    const { key, name, module } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ message: 'Permission key is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Permission display name is required' });
    }
    if (!module || !module.trim()) {
      return res.status(400).json({ message: 'Module category is required' });
    }

    const keyLower = key.trim().toLowerCase();
    const existing = await Permission.findOne({ key: keyLower });
    if (existing) {
      return res.status(400).json({ message: 'Permission key already exists' });
    }

    const permission = new Permission({
      key: keyLower,
      name: name.trim(),
      module: module.trim(),
    });
    await permission.save();

    res.status(201).json({ message: 'Permission created successfully', permission });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create permission', error: error.message });
  }
};

// Get all permissions
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find().sort({ module: 1, name: 1 });
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch permissions', error: error.message });
  }
};

// Update permission details / toggle isActive
exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, module, isActive } = req.body;

    const permission = await Permission.findById(id);
    if (!permission) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    if (name) permission.name = name.trim();
    if (module) permission.module = module.trim();
    if (isActive !== undefined) permission.isActive = isActive;

    await permission.save();
    res.json({ message: 'Permission updated successfully', permission });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update permission', error: error.message });
  }
};

// Delete unused permission
exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const permission = await Permission.findById(id);
    if (!permission) {
      return res.status(404).json({ message: 'Permission not found' });
    }

    const key = permission.key;

    // Check if any role is currently using this permission key
    const roleCount = await Role.countDocuments({ permissions: key });
    if (roleCount > 0) {
      return res.status(400).json({ message: 'Cannot delete permission: It is currently assigned to one or more roles' });
    }

    // Check if any user override is currently using this permission key
    const userCount = await User.countDocuments({ permissions: key });
    if (userCount > 0) {
      return res.status(400).json({ message: 'Cannot delete permission: It is currently assigned to one or more users as an override' });
    }

    await Permission.findByIdAndDelete(id);
    res.json({ message: 'Permission deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete permission', error: error.message });
  }
};
