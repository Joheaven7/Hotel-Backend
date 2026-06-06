const User = require('../../models/User');
const AuditLog = require('../../models/AuditLog');
const { createNotification } = require('../../services/notificationService');
const { encryptEmail } = require('../../utils/encryption');
const {
  ROLES,
  ROLE_CREATION_PERMISSIONS,
  ROLE_HIERARCHY,
} = require('../../config/constants');

// Create user (with role hierarchy validation)
const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role, department, baseSalary } = req.body;



    // Check if user already exists
    const existingUser = await User.findOne({ email: encryptEmail(email) });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Validate role hierarchy - can only create users of lower or equal role
    const creatorRole = req.user.role;
    const allowedRoles = ROLE_CREATION_PERMISSIONS[creatorRole];

    if (!allowedRoles || !allowedRoles.includes(role)) {
      return res.status(403).json({
        message: `${creatorRole} cannot create ${role} users`,
        allowedRoles,
      });
    }

    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
      isActive: true, // CRITICAL: Set default to true
      ...(role !== ROLES.CUSTOMER && { department, baseSalary }),
    });



    await newUser.save();



    if (['STAFF', 'ACCOUNTANT', 'HR'].includes(role)) {
      try {
        await createNotification(req.io, {
          title: 'New Staff Member Added',
          message: `${firstName} ${lastName} joined as ${role}.`,
          type: 'STAFF_CREATED',
          targetRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'],
          resourceId: newUser._id,
          resourceType: 'User',
        });
      } catch (notifErr) {
        console.error('Failed to create notification for new user:', notifErr);
      }
    }

    res.status(201).json({
      message: 'User created successfully',
      user: newUser.toJSON(),
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};

// Get all users (with role-based filtering)
const getAllUsers = async (req, res) => {
  try {
    const { role, roles, excludeRole, excludeRoles, search, page = 1, limit = 20, includeDeleted, isActive } = req.query;

    const query = {};

    // SUPER_ADMIN can view soft-deleted users
    let includeDeletedFlag = false;
    if (includeDeleted === 'true' && req.user.role === ROLES.SUPER_ADMIN) {
      includeDeletedFlag = true;
    }

    const rolesList = (roles || role || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const excludeRolesList = (excludeRoles || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (rolesList.length > 0) {
      query.role = rolesList.length === 1 ? rolesList[0] : { $in: rolesList };
    } else if (excludeRole) {
      query.role = { $ne: excludeRole.trim() };
    } else if (excludeRolesList.length > 0) {
      query.role = { $nin: excludeRolesList };
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      const sanitizedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const encryptedSearch = encryptEmail(search);
      query.$or = [
        { firstName: { $regex: sanitizedSearch, $options: 'i' } },
        { lastName: { $regex: sanitizedSearch, $options: 'i' } },
        { email: encryptedSearch },
        { name: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.find(query).setOptions({ includeDeleted: includeDeletedFlag }).countDocuments();
    const users = await User.find(query)
      .setOptions({ includeDeleted: includeDeletedFlag })
      .select('-password -refreshToken')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Get single user
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;



    const user = await User.findById(userId).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Role-based access: users can only see their own data unless they're ADMIN+
    if (req.user._id.toString() !== userId && req.user.role === ROLES.CUSTOMER) {
      return res.status(403).json({ message: 'Cannot access other users data' });
    }



    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

// Update user - ENHANCED with proper status handling
// Update user - self or admin+
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterRole = req.user.role;
    const requesterId = req.user._id.toString();

    // Non-admin users can only update their own profile
    if (
      !['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(requesterRole) &&
      requesterId !== userId
    ) {
      return res.status(403).json({ message: 'You can only update your own profile' });
    }

    // Destructure — separate privileged from safe fields
    const {
      role, isActive, baseSalary, department,
      position, workDescription, employmentStatus, hireDate,
      ...safeFields
    } = req.body;

    const updateData = { ...safeFields };

    // Only SUPER_ADMIN can change roles
    if (role !== undefined && requesterRole === ROLES.SUPER_ADMIN) {
      updateData.role = role;
    }

    // SUPER_ADMIN and ADMIN can toggle isActive
    if (isActive !== undefined && ['SUPER_ADMIN', 'ADMIN'].includes(requesterRole)) {
      updateData.isActive = isActive;
    }

    // SUPER_ADMIN, ADMIN, MANAGER, HR can update employment fields
    if (['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR'].includes(requesterRole)) {
      if (baseSalary !== undefined) updateData.baseSalary = Math.max(0, Number(baseSalary));
      if (department !== undefined) updateData.department = department;
      if (position !== undefined) updateData.position = position;
      if (workDescription !== undefined) updateData.workDescription = workDescription;
      if (hireDate !== undefined) updateData.hireDate = hireDate;
      if (employmentStatus !== undefined &&
        ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'].includes(employmentStatus)) {
        updateData.employmentStatus = employmentStatus;
      }
    }

    if (req.body.password) {
      // Require current password verification when user is editing themselves
      if (requesterId === userId) {
        if (!req.body.currentPassword) {
          return res.status(400).json({ message: 'Current password is required to set a new password' });
        }
        // Load user with password field
        const userWithPwd = await User.findById(userId).select('+password');
        if (!userWithPwd) {
          return res.status(404).json({ message: 'User not found' });
        }
        const isMatch = await userWithPwd.comparePassword(req.body.currentPassword);
        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
      }
      // ADMIN/SUPER_ADMIN can set password without knowing the current one
      updateData.password = req.body.password;
    }
    updateData.updatedBy = req.user._id;

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Apply updates
    Object.keys(updateData).forEach((key) => {
      userToUpdate[key] = updateData[key];
    });

    await userToUpdate.save();

    const sanitizedUser = userToUpdate.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshToken;

    res.json({ message: 'User updated successfully', user: sanitizedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

// Delete user (soft delete - set isActive to false)
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user._id.toString();

    // Cannot delete own account
    if (userId === requesterId) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Protect last SUPER_ADMIN
    if (targetUser.role === ROLES.SUPER_ADMIN) {
      const superAdminCount = await User.countDocuments({ role: ROLES.SUPER_ADMIN, deletedAt: null });
      if (superAdminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last Super Admin' });
      }
    }

    // Soft delete
    targetUser.deletedAt = new Date();
    targetUser.isActive = false;
    targetUser.updatedBy = req.user._id;
    await targetUser.save();

    res.json({ message: 'User deactivated successfully', userId });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

// Restore user
const restoreUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Must explicitly bypass the soft-delete pre-find hook to find deleted user
    const user = await User.findOne({ _id: userId }).setOptions({ includeDeleted: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = true;
    user.deletedAt = null;    // ← clear soft-delete timestamp
    user.updatedBy = req.user._id;
    await user.save();

    res.json({
      message: 'User restored successfully',
      user: { ...user.toObject(), password: undefined, refreshToken: undefined },
    });
  } catch (error) {
    console.error('restoreUser error:', error);
    res.status(500).json({ message: 'Failed to restore user' });
  }
};

// Assign role (SUPER_ADMIN only)
const assignRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;

    // Only SUPER_ADMIN can assign roles
    if (req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        message: 'Only SUPER_ADMIN can assign roles',
      });
    }

    // Validate role
    if (!Object.values(ROLES).includes(newRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const oldUser = await User.findById(userId);
    if (!oldUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldRole = oldUser.role;

    const user = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true }
    ).select('-password -refreshToken');

    if (oldRole !== newRole) {
      await AuditLog.create({
        userId: req.user._id,
        actionType: 'ROLE_CHANGE',
        resource: `User:${userId}`,
        details: {
          targetUserId: userId,
          oldRole,
          newRole,
        },
        ipAddress: req.ip || req.socket.remoteAddress,
      });
    }

    res.json({
      message: `User role changed to ${newRole}`,
      user,
    });
  } catch (error) {
    console.error('assignRole error:', error);
    res.status(500).json({ message: 'Failed to assign role' });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  restoreUser,
  assignRole,
};