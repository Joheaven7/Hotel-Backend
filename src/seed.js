require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');
const Hall = require('./models/Hall');
const RoomType = require('./models/RoomType');
const HallType = require('./models/HallType');
const Department = require('./models/Department');
const Role = require('./models/Role');
const Permission = require('./models/Permission');
const FoodCategory = require('./models/FoodCategory');
const FoodItem = require('./models/FoodItem');

const seedDatabase = async () => {
  try {
    console.log('MONGO_URI =', process.env.MONGO_URI);

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Creating seed data...');

    // Clear old data
    await Permission.deleteMany({});
    await Role.deleteMany({});
    await Department.deleteMany({});
    await User.deleteMany({});

    // 1. Seed Permissions
    const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, DEPARTMENTS } = require('./config/constants');
    const permissionDocs = [];
    for (const modKey of Object.keys(PERMISSIONS)) {
      const moduleName = modKey.charAt(0).toUpperCase() + modKey.slice(1).toLowerCase();
      for (const actionKey of Object.keys(PERMISSIONS[modKey])) {
        const key = PERMISSIONS[modKey][actionKey];
        const name = actionKey.charAt(0).toUpperCase() + actionKey.slice(1).replace('_', ' ').toLowerCase() + ' ' + moduleName;
        const perm = new Permission({
          key,
          name,
          module: moduleName,
          isActive: true
        });
        await perm.save();
        permissionDocs.push(perm);
      }
    }
    console.log(`Seeded ${permissionDocs.length} permissions.`);

    // 2. Seed Roles
    const roleDocs = [];
    for (const roleName of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
      const role = new Role({
        name: roleName,
        permissions: DEFAULT_ROLE_PERMISSIONS[roleName],
        isActive: true
      });
      await role.save();
      roleDocs.push(role);
    }
    console.log(`Seeded ${roleDocs.length} roles.`);

    // 3. Seed Departments
    const departmentDocs = [];
    for (const deptKey of Object.keys(DEPARTMENTS)) {
      const dept = new Department({
        name: DEPARTMENTS[deptKey],
        isActive: true
      });
      await dept.save();
      departmentDocs.push(dept);
    }
    console.log(`Seeded ${departmentDocs.length} departments.`);

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
        email: 'gm@hotel.com',
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

    // ── Seed Menu Categories & Items ────────────────────────────────────────
    await FoodCategory.deleteMany({});
    await FoodItem.deleteMany({});

    const catBreakfast = await FoodCategory.create({
      name: 'Breakfast & Brunch',
      description: 'Start your morning with fresh, hot dishes and traditional favorites.',
      displayOrder: 1,
    });

    const catMains = await FoodCategory.create({
      name: 'Main Courses & Specialties',
      description: 'Chef signature dishes, grilled steaks, pasta, and Ethiopian specialties.',
      displayOrder: 2,
    });

    const catBurgers = await FoodCategory.create({
      name: 'Burgers & Snacks',
      description: 'Gourmet burgers, artisanal pizzas, and crispy side snacks.',
      displayOrder: 3,
    });

    const catDesserts = await FoodCategory.create({
      name: 'Desserts & Sweets',
      description: 'Indulgent sweet treats, cakes, and artisanal ice cream.',
      displayOrder: 4,
    });

    const catDrinks = await FoodCategory.create({
      name: 'Beverages & Juices',
      description: 'Fresh organic fruit juices, Ethiopian highland coffee, and cold drinks.',
      displayOrder: 5,
    });

    const foodItems = await FoodItem.insertMany([
      {
        name: 'Classic Ethiopian Breakfast Combo',
        category: catBreakfast._id,
        description: 'Traditional Chechebsa with spiced butter, honey, Ful Medames, and scrambled eggs.',
        price: 350,
        image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Eggs', 'Flour bread', 'Spiced Butter', 'Fava Beans', 'Honey'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 15,
        isFeatured: true,
      },
      {
        name: 'Avocado Toast & Poached Eggs',
        category: catBreakfast._id,
        description: 'Toasted sourdough topped with mashed avocado, organic poached eggs, and microgreens.',
        price: 280,
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Sourdough', 'Avocado', 'Eggs', 'Cherry Tomatoes'],
        allergens: ['Gluten', 'Egg'],
        preparationTime: 12,
        isFeatured: false,
      },
      {
        name: 'Fluffy Pancakes with Maple Syrup',
        category: catBreakfast._id,
        description: 'Golden stack of buttermilk pancakes served with fresh berries, butter, and pure maple syrup.',
        price: 240,
        image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Flour', 'Milk', 'Butter', 'Maple Syrup', 'Berries'],
        allergens: ['Gluten', 'Dairy', 'Egg'],
        preparationTime: 15,
        isFeatured: false,
      },
      {
        name: 'Special Beef Tibs',
        category: catMains._id,
        description: 'Sautéed tender beef cubes with onions, garlic, rosemary, and green chili served on soft Injera.',
        price: 450,
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Tenderloin Beef', 'Onions', 'Garlic', 'Rosemary', 'Injera'],
        allergens: [],
        preparationTime: 20,
        isFeatured: true,
      },
      {
        name: 'Grilled Salmon Supreme',
        category: catMains._id,
        description: 'Fresh Atlantic salmon fillet with lemon herb butter sauce, garlic roasted potatoes, and asparagus.',
        price: 650,
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Salmon Fillet', 'Lemon', 'Butter', 'Potatoes', 'Asparagus'],
        allergens: ['Fish', 'Dairy'],
        preparationTime: 25,
        isFeatured: true,
      },
      {
        name: 'Creamy Chicken Fettuccine Alfredo',
        category: catMains._id,
        description: 'Fettuccine pasta tossed in rich parmesan cream sauce with grilled chicken breast and garlic toast.',
        price: 380,
        image: 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Fettuccine', 'Chicken', 'Heavy Cream', 'Parmesan', 'Garlic'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 20,
        isFeatured: false,
      },
      {
        name: 'LuxStay Gourmet Cheeseburger',
        category: catBurgers._id,
        description: 'Prime Angus beef patty, aged cheddar, caramelized onions, crisp lettuce, and secret sauce on brioche.',
        price: 390,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Angus Beef', 'Cheddar', 'Brioche Bun', 'Fries'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 18,
        isFeatured: true,
      },
      {
        name: 'Wood-Fired Margherita Pizza',
        category: catBurgers._id,
        description: 'Artisanal thin crust pizza topped with San Marzano tomato sauce, fresh mozzarella, and fresh basil.',
        price: 340,
        image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Pizza Dough', 'Tomato Sauce', 'Mozzarella', 'Basil'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 20,
        isFeatured: false,
      },
      {
        name: 'Decadent Chocolate Lava Cake',
        category: catDesserts._id,
        description: 'Warm chocolate cake with molten cocoa center, served with vanilla bean ice cream.',
        price: 220,
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Dark Chocolate', 'Butter', 'Eggs', 'Vanilla Ice Cream'],
        allergens: ['Gluten', 'Dairy', 'Egg'],
        preparationTime: 12,
        isFeatured: true,
      },
      {
        name: 'Classic New York Cheesecake',
        category: catDesserts._id,
        description: 'Smooth and creamy baked cheesecake topped with fresh strawberry compote.',
        price: 200,
        image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Cream Cheese', 'Graham Crust', 'Strawberries'],
        allergens: ['Gluten', 'Dairy'],
        preparationTime: 10,
        isFeatured: false,
      },
      {
        name: 'Fresh Mixed Fruit Spris Juice',
        category: catDrinks._id,
        description: 'Freshly blended layered avocado, mango, and papaya fruit smoothie.',
        price: 120,
        image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Avocado', 'Mango', 'Papaya', 'Lime'],
        allergens: [],
        preparationTime: 8,
        isFeatured: true,
      },
      {
        name: 'Ethiopian Highlands Macchiato',
        category: catDrinks._id,
        description: 'Double shot of freshly roasted Yirgacheffe espresso layered with steamed milk froth.',
        price: 80,
        image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80',
        ingredients: ['Coffee Beans', 'Whole Milk'],
        allergens: ['Dairy'],
        preparationTime: 5,
        isFeatured: false,
      },
    ]);

    console.log('✅ Seed data created successfully!');
    console.log(`Created ${users.length} users`);
    console.log(`Created ${rooms.length} rooms (linked to types)`);
    console.log(`Created ${halls.length} halls (linked to types)`);
    console.log(`Created ${foodItems.length} food items across 5 categories`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();