const Role = require('../../models/Role');
const User = require('../../models/User');

// Create a role
exports.createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    const existing = await Role.findOne({ name: name.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Role already exists' });
    }

    const role = new Role({
      name: name.trim().toUpperCase(),
      permissions: permissions || [],
    });
    await role.save();

    res.status(201).json({ message: 'Role created successfully', role });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create role', error: error.message });
  }
};

// Get all roles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch roles', error: error.message });
  }
};

// Update / Rename / Assign permissions
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions, isActive } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (role.name === 'SUPER_ADMIN' && name && name.trim().toUpperCase() !== 'SUPER_ADMIN') {
      return res.status(400).json({ message: 'Cannot rename the SUPER_ADMIN role' });
    }

    const oldName = role.name;

    if (name && name.trim().toUpperCase() !== role.name) {
      const existing = await Role.findOne({ name: name.trim().toUpperCase() });
      if (existing) {
        return res.status(400).json({ message: 'Role name already exists' });
      }
      role.name = name.trim().toUpperCase();

      // Update all users who currently have this role
      await User.updateMany({ role: oldName }, { role: name.trim().toUpperCase() });
    }

    if (permissions !== undefined) {
      // SUPER_ADMIN permissions cannot be removed or modified
      if (role.name === 'SUPER_ADMIN') {
        role.permissions = ['*'];
      } else {
        role.permissions = permissions;
      }
    }

    if (isActive !== undefined) {
      if (role.name === 'SUPER_ADMIN' && isActive === false) {
        return res.status(400).json({ message: 'Cannot disable the SUPER_ADMIN role' });
      }
      role.isActive = isActive;
    }

    await role.save();
    res.json({ message: 'Role updated successfully', role });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update role', error: error.message });
  }
};

// Clone a role
exports.cloneRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ message: 'New role name is required' });
    }

    const targetRole = await Role.findById(id);
    if (!targetRole) {
      return res.status(404).json({ message: 'Role to clone not found' });
    }

    const existing = await Role.findOne({ name: newName.trim().toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Role name already exists' });
    }

    const newRole = new Role({
      name: newName.trim().toUpperCase(),
      permissions: targetRole.permissions,
      isActive: true,
    });
    await newRole.save();

    res.status(201).json({ message: 'Role cloned successfully', role: newRole });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clone role', error: error.message });
  }
};

// Delete unused role
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (role.name === 'SUPER_ADMIN') {
      return res.status(400).json({ message: 'Cannot delete the SUPER_ADMIN role' });
    }

    // Check if any user belongs to this role
    const count = await User.countDocuments({ role: role.name });
    if (count > 0) {
      return res.status(400).json({ message: 'Cannot delete role: It is currently assigned to users' });
    }

    await Role.findByIdAndDelete(id);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete role', error: error.message });
  }
};
