const RoomType = require('../../models/RoomType');
const HallType = require('../../models/HallType');

exports.getAllTypes = async (req, res) => {
  try {
    const { category } = req.query;

    let types = [];
    
    if (!category || category.toUpperCase() === 'ROOM') {
      const roomTypes = await RoomType.find({ isPublished: true, isDeleted: false }).lean();
      types = types.concat(roomTypes.map(rt => ({
        ...rt,
        category: 'ROOM',
        capacity: rt.baseCapacity || rt.capacity || 2, // Fallback if schema differs
        price: rt.basePricePerNight
      })));
    }

    if (!category || category.toUpperCase() === 'HALL') {
      const hallTypes = await HallType.find({ isPublished: true, isDeleted: false }).lean();
      types = types.concat(hallTypes.map(ht => ({
        ...ht,
        category: 'HALL',
        capacity: ht.capacity,
        price: ht.basePricePerHour
      })));
    }

    res.json({
      message: 'Types retrieved successfully',
      types
    });
  } catch (error) {
    console.error('Error fetching types:', error);
    res.status(500).json({
      message: 'Failed to fetch types',
      error: error.message
    });
  }
};
