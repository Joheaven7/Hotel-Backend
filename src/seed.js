const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');
const Hall = require('./models/Hall');
const RoomType = require('./models/RoomType');
const HallType = require('./models/HallType');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    console.log('MONGO_URI =', process.env.MONGO_URI);

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Creating seed data...');

    await User.deleteMany({});
    // Create users
    const usersData = [
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@hotel.com',
        password: 'password123',
        role: 'SUPER_ADMIN',
        phone: '+1234567890',
      },
      {
        firstName: 'General',
        lastName: 'Manager',
        email: 'admin@hotel.com',
        password: 'password123',
        role: 'ADMIN',
        phone: '+1234567891',
      },
      {
        firstName: 'Manager',
        lastName: 'User',
        email: 'manager@hotel.com',
        password: 'password123',
        role: 'ADMIN',
        phone: '+1234567891',
      },
      {
        firstName: 'Accountant',
        lastName: 'User',
        email: 'accountant@hotel.com',
        password: 'password123',
        role: 'ACCOUNTANT',
        phone: '+1234567892',
      },
      {
        firstName: 'Staff',
        lastName: 'Member',
        email: 'staff@hotel.com',
        password: 'password123',
        role: 'STAFF',
        phone: '+1234567893',
        department: 'Housekeeping',
        baseSalary: 2000,
      },
      {
        firstName: 'John',
        lastName: 'Guest',
        email: 'guest@hotel.com',
        password: 'password123',
        role: 'CUSTOMER',
        phone: '+1234567894',
      },
      {
        firstName: 'HR',
        lastName: 'Manager',
        email: 'hr@hotel.com',
        password: 'password123',
        role: 'HR',
        phone: '+1234567895',
        department: 'Human Resources',
        baseSalary: 3000,
      },
    ];

    const users = [];
    for (const u of usersData) {
      const user = new User(u);
      await user.save();
      users.push(user);
    }

    // ── Seed RoomTypes first ────────────────────────────────────────────────
    await RoomType.deleteMany({});

    const singleType = await RoomType.create({
      name: 'Single Room',
      description: 'A cozy boutique space featuring a comfortable plush bed, dedicated workspace, and garden views.',
      basePricePerNight: 120,
      maxOccupancy: 1,
      amenities: ['WiFi', 'AC', 'TV'],
      images: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80'],
    });

    const doubleType = await RoomType.create({
      name: 'Double Room',
      description: 'Spacious guestroom with two premium queen beds, custom layout, and panoramic details.',
      basePricePerNight: 180,
      maxOccupancy: 2,
      amenities: ['WiFi', 'AC', 'TV', 'Mini Bar'],
      images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80'],
    });

    const deluxeType = await RoomType.create({
      name: 'Deluxe Room',
      description: 'Elegant deluxe accommodation offering a private balcony, custom furnishings, and scenic forest views.',
      basePricePerNight: 250,
      maxOccupancy: 3,
      amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony'],
      images: ['https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80'],
    });

    const suiteType = await RoomType.create({
      name: 'Suite Room',
      description: 'Sophisticated executive suite boasting a separate living area, custom desk, and upscale amenities.',
      basePricePerNight: 350,
      maxOccupancy: 4,
      amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Jacuzzi'],
      images: ['https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80'],
    });

    // ── Seed Rooms linked to types ──────────────────────────────────────────
    await Room.deleteMany({});
    
    // Save each document one by one to ensure pre-save triggers and copies legacy fields
    const roomTemplates = [
      { roomNumber: '101', roomTypeId: singleType._id, floor: 1 },
      { roomNumber: '102', roomTypeId: doubleType._id, floor: 1 },
      { roomNumber: '201', roomTypeId: deluxeType._id, floor: 2 },
      { roomNumber: '202', roomTypeId: suiteType._id, floor: 2 },
      { roomNumber: '301', roomTypeId: suiteType._id, floor: 3 },
      { roomNumber: '302', roomTypeId: deluxeType._id, floor: 3 },
    ];

    const rooms = [];
    for (const rTpl of roomTemplates) {
      const rm = new Room(rTpl);
      await rm.save();
      rooms.push(rm);
    }

    // ── Seed HallTypes first ────────────────────────────────────────────────
    await HallType.deleteMany({});

    const grandWeddingType = await HallType.create({
      name: 'Grand Wedding Hall',
      description: 'A magnificent ballroom with crystal chandeliers, private garden entrance, and custom wedding banquet setups.',
      basePricePerHour: 450,
      maxOccupancy: 300,
      amenities: ['Sound System', 'Catering Kitchen', 'Lighting Rig'],
      images: ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80'],
    });

    const execConfType = await HallType.create({
      name: 'Executive Conference Hall',
      description: 'State-of-the-art conference space with high-end AV equipment, interactive whiteboards, and ergonomic business seating.',
      basePricePerHour: 300,
      maxOccupancy: 120,
      amenities: ['Projector', 'Video Conferencing', 'High-Speed Wi-Fi'],
      images: ['https://images.unsplash.com/photo-1517502884422-41eaaced0168?auto=format&fit=crop&w=800&q=80'],
    });

    const royalBanquetType = await HallType.create({
      name: 'Royal Banquet Hall',
      description: 'Elegant banquet hall ideal for corporate dinners and cocktail parties, featuring gold-accented styling.',
      basePricePerHour: 380,
      maxOccupancy: 200,
      amenities: ['Live Barbecue Kitchen', 'Stage area', 'Cocktail Lounge'],
      images: ['https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=800&q=80'],
    });

    // ── Seed Halls linked to types ──────────────────────────────────────────
    await Hall.deleteMany({});
    
    const hallTemplates = [
      { hallName: 'Grand Wedding Hall', hallTypeId: grandWeddingType._id, floor: 1 },
      { hallName: 'Executive Conference Hall', hallTypeId: execConfType._id, floor: 1 },
      { hallName: 'Royal Banquet Hall', hallTypeId: royalBanquetType._id, floor: 1 },
    ];

    const halls = [];
    for (const hTpl of hallTemplates) {
      const hl = new Hall(hTpl);
      await hl.save();
      halls.push(hl);
    }

    console.log('✅ Seed data created successfully!');
    console.log(`Created ${users.length} users`);
    console.log(`Created ${rooms.length} rooms (linked to types)`);
    console.log(`Created ${halls.length} halls (linked to types)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();