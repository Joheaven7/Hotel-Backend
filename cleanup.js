const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Delete all users
    const result = await User.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} users`);
    
    // Now seed with correct fields (name NOT firstName/lastName)
    const seedResult = await User.insertMany([
      {
        name: 'Admin User',
        email: 'admin@hotel.com',
        password: 'password123',
        role: 'SUPER_ADMIN',
      },
      {
        name: 'Manager User',
        email: 'manager@hotel.com',
        password: 'password123',
        role: 'ADMIN',
      },
      {
        name: 'Accountant User',
        email: 'accountant@hotel.com',
        password: 'password123',
        role: 'ACCOUNTANT',
      },
      {
        name: 'Staff User',
        email: 'staff@hotel.com',
        password: 'password123',
        role: 'STAFF',
      },
      {
        name: 'Guest User',
        email: 'guest@hotel.com',
        password: 'password123',
        role: 'CUSTOMER',
      },
    ]);
    
    console.log(`✅ Created ${seedResult.length} users`);
    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanup();