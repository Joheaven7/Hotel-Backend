const mongoose = require('mongoose');
require('dotenv').config();

async function dropCollection() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Drop users collection
    await mongoose.connection.collection('users').drop();
    console.log('✅ Dropped users collection');
    
    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    if (error.message.includes('ns not found')) {
      console.log('✅ Collection already dropped or doesn\'t exist');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

dropCollection();