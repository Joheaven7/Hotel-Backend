const mongoose = require('mongoose');
require('dotenv').config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    const Payroll = require('../src/models/Payroll');
    const payrolls = await Payroll.find({});
    console.log(`Found ${payrolls.length} payroll entries`);
    payrolls.forEach(p => {
      console.log(`ID: ${p._id}, Month: "${p.month}", StaffId: ${p.staffId}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
