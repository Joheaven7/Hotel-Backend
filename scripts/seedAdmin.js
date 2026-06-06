require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function seed() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const existing = await User.findOne({ role: 'SUPER_ADMIN' });
  if (existing) {
    console.log('Super Admin already exists:', existing.email);
    process.exit(0);
  }

  const admin = await User.create({
    firstName: 'Hotel',
    lastName: 'Admin',
    email: 'admin@luxstay.com',
    password: 'ChangeMe123!',
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  console.log('Super Admin created:', admin.email);
  console.log('Employee ID:', admin.employeeId || 'N/A');
  console.log('Login with password: ChangeMe123!');
  console.log('CHANGE THIS PASSWORD IMMEDIATELY after first login.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
