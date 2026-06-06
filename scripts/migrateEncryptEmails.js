const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

const isDryRun = process.argv.includes('--dry-run');

async function migrate() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY is not defined in environment variables.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected successfully.');

  // Disable default deletedAt filter to migrate all users
  const users = await User.find({}).setOptions({ includeDeleted: true });
  console.log(`Found ${users.length} users in the database.`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    // Read raw email from the database without triggering Mongoose getters
    const rawEmail = user.get('email', null, { getters: false });
    
    // Check if the email is already encrypted (format iv:authTag:encrypted)
    const isEncrypted = rawEmail && rawEmail.includes(':') && rawEmail.split(':').length === 3;

    if (!isEncrypted) {
      console.log(`[MIGRATE] Encrypting email for user: ${rawEmail} (ID: ${user._id})`);
      migratedCount++;
      
      if (!isDryRun) {
        // Assigning raw email triggers the Mongoose schema setter (encryptEmail)
        user.email = rawEmail;
        // Save user to database
        await user.save();
      }
    } else {
      skippedCount++;
    }
  }

  console.log('\nMigration Summary:');
  console.log(`- Total users scanned: ${users.length}`);
  console.log(`- Users migrated: ${migratedCount} ${isDryRun ? '(Dry Run - NO database changes)' : ''}`);
  console.log(`- Users skipped (already encrypted): ${skippedCount}`);

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
