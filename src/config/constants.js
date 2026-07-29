// ROLES
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  HR: 'HR',
  ACCOUNTANT: 'ACCOUNTANT',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
};

// ROLE HIERARCHY
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 6,
  ADMIN: 5,
  MANAGER: 4,
  HR: 3,
  ACCOUNTANT: 3,
  STAFF: 2,
  CUSTOMER: 1,
};

// WHO CAN CREATE WHAT ROLE
const ROLE_CREATION_PERMISSIONS = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'STAFF', 'CUSTOMER'],
  ADMIN: ['ACCOUNTANT', 'STAFF', 'CUSTOMER'],
  MANAGER: [],
  HR: [],
  ACCOUNTANT: [],
  STAFF: [],
  CUSTOMER: [],
};

// DEPARTMENTS
const DEPARTMENTS = {
  ADMINISTRATION: 'Administration',
  FINANCE: 'Finance',
  HUMAN_RESOURCES: 'Human Resources',
  FRONT_DESK: 'Front Desk',
  HOUSEKEEPING: 'Housekeeping',
  MAINTENANCE: 'Maintenance',
  SECURITY: 'Security',
  RESTAURANT: 'Restaurant',
};

// POSITIONS per department
const POSITIONS = {
  // Administration
  SUPER_ADMIN: 'Super Administrator',
  HOTEL_MANAGER: 'Hotel Manager',
  // Finance
  ACCOUNTANT: 'Accountant',
  FINANCE_OFFICER: 'Finance Officer',
  // HR
  HR_SPECIALIST: 'HR Specialist',
  HR_OFFICER: 'HR Officer',
  // Front Desk
  RECEPTIONIST: 'Receptionist',
  DESK_STAFF: 'Desk Staff',
  // Housekeeping
  CLEANING_STAFF: 'Cleaning Staff',
  HEAD_HOUSEKEEPER: 'Head Housekeeper',
  // Maintenance
  TECHNICIAN: 'Technician',
  MAINTENANCE_STAFF: 'Maintenance Staff',
  // Security
  SECURITY_SUPERVISOR: 'Security Supervisor',
  SECURITY_GUARD: 'Security Guard',
  // Restaurant
  CHEF: 'Chef',
  KITCHEN_STAFF: 'Kitchen Staff',
  ROOM_SERVICE_STAFF: 'Room Service Staff',
  RESTAURANT_MANAGER: 'Restaurant Manager',
};

// EMPLOYMENT STATUS
const EMPLOYMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
};

// RESERVATION STATUS
const RESERVATION_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  CANCELLED: 'CANCELLED',
  WAITLIST: 'WAITLIST',
};

// PAYMENT STATUS
const PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
};

// PAYMENT INTENT STATUS
const PAYMENT_INTENT_STATUS = {
  INITIATED: 'INITIATED',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
};

// ROOM STATUS
const ROOM_STATUS = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  MAINTENANCE: 'MAINTENANCE',
  BLOCKED: 'BLOCKED',
};

// MAINTENANCE STATUS
const MAINTENANCE_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

// PAYROLL APPROVAL STATUS
const PAYROLL_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
};

// FOOD ORDER STATUS
const FOOD_ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

// SYSTEM PERMISSIONS
const PERMISSIONS = {
  DASHBOARD: {
    VIEW: 'dashboard.view',
    VIEW_ANALYTICS: 'dashboard.analytics',
    VIEW_REVENUE: 'dashboard.revenue',
  },
  ROOMS: {
    VIEW: 'rooms.view',
    CREATE: 'rooms.create',
    EDIT: 'rooms.edit',
    DELETE: 'rooms.delete',
  },
  HALLS: {
    VIEW: 'halls.view',
    CREATE: 'halls.create',
    EDIT: 'halls.edit',
    DELETE: 'halls.delete',
  },
  RESERVATIONS: {
    VIEW: 'reservations.view',
    CREATE: 'reservations.create',
    EDIT: 'reservations.edit',
    CANCEL: 'reservations.cancel',
    APPROVE: 'reservations.approve',
  },
  PAYMENTS: {
    VIEW: 'payments.view',
    PROCESS: 'payments.process',
    REFUND: 'payments.refund',
    APPROVE: 'payments.approve',
  },
  PAYROLL: {
    VIEW: 'payroll.view',
    CREATE: 'payroll.create',
    EDIT: 'payroll.edit',
    DELETE: 'payroll.delete',
    APPROVE: 'payroll.approve',
  },
  USERS: {
    VIEW: 'users.view',
    CREATE: 'users.create',
    EDIT: 'users.edit',
    DELETE: 'users.delete',
    ASSIGN_ROLES: 'users.assignRoles',
    MANAGE_PERMISSIONS: 'users.managePermissions',
  },
  MAINTENANCE: {
    VIEW: 'maintenance.view',
    CREATE: 'maintenance.create',
    UPDATE: 'maintenance.update',
    RESOLVE: 'maintenance.resolve',
  },
  COMPLAINTS: {
    VIEW: 'complaints.view',
    EDIT: 'complaints.edit',
  },
  REPORTS: {
    VIEW: 'reports.view',
    EXPORT: 'reports.export',
  },
  NOTIFICATIONS: {
    SEND: 'notifications.send',
    MANAGE: 'notifications.manage',
  },
  CHAT: {
    PRIVATE: 'chat.private',
    DEPARTMENT: 'chat.department',
    BROADCAST: 'chat.broadcast',
  },
  SYSTEM: {
    AUDIT_LOGS: 'system.auditLogs',
    RESTORE_DATA: 'system.restoreData',
    SETTINGS: 'system.settings',
  },
  RESTAURANT: {
    VIEW: 'restaurant.view',
    MANAGE_FOOD: 'restaurant.manage_food',
    PROCESS_ORDERS: 'restaurant.process_orders',
  },
};

const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'dashboard.view', 'dashboard.analytics', 'dashboard.revenue',
    'rooms.view', 'rooms.create', 'rooms.edit', 'rooms.delete',
    'halls.view', 'halls.create', 'halls.edit', 'halls.delete',
    'reservations.view', 'reservations.create', 'reservations.edit', 'reservations.cancel', 'reservations.approve',
    'payments.view', 'payments.process', 'payments.refund', 'payments.approve',
    'users.view', 'users.create', 'users.edit',
    'maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.resolve',
    'complaints.view', 'complaints.edit',
    'reports.view', 'reports.export',
    'notifications.send', 'notifications.manage',
    'chat.private', 'chat.department', 'chat.broadcast',
    'restaurant.view', 'restaurant.manage_food', 'restaurant.process_orders',
  ],
  MANAGER: [
    'dashboard.view', 'dashboard.analytics',
    'rooms.view', 'rooms.create', 'rooms.edit',
    'halls.view', 'halls.create', 'halls.edit',
    'reservations.view', 'reservations.create', 'reservations.edit', 'reservations.cancel', 'reservations.approve',
    'payments.view', 'payments.process', 'payroll.approve',
    'users.view', 'users.create', 'users.edit',
    'maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.resolve',
    'complaints.view', 'complaints.edit',
    'reports.view',
    'notifications.send',
    'chat.private', 'chat.department',
    'restaurant.view', 'restaurant.process_orders',
  ],
  HR: [
    'dashboard.view',
    'users.view', 'users.create', 'users.edit',
    'payroll.view', 'payroll.create', 'payroll.edit', 'payroll.delete', 'payroll.approve',
    'reports.view',
  ],
  ACCOUNTANT: [
    'dashboard.view', 'dashboard.revenue',
    'payments.view', 'payments.process', 'payments.refund', 'payments.approve',
    'payroll.view', 'payroll.create', 'payroll.edit', 'payroll.approve',
    'reports.view', 'reports.export',
  ],
  STAFF: [
    'dashboard.view',
    'rooms.view',
    'halls.view',
    'reservations.view', 'reservations.create', 'reservations.edit',
    'maintenance.view', 'maintenance.create', 'maintenance.update',
    'complaints.view', 'complaints.edit',
    'chat.private', 'chat.department',
  ],
  CUSTOMER: [
    'reservations.view',
    'payments.view',
  ]
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  ROLE_CREATION_PERMISSIONS,
  DEPARTMENTS,
  POSITIONS,
  EMPLOYMENT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_INTENT_STATUS,
  ROOM_STATUS,
  MAINTENANCE_STATUS,
  PAYROLL_STATUS,
  FOOD_ORDER_STATUS,
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
};