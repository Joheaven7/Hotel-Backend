const checkOverlap = (newCheckIn, newCheckOut, existingCheckIn, existingCheckOut) => {
  return (
    new Date(newCheckIn) < new Date(existingCheckOut) &&
    new Date(newCheckOut) > new Date(existingCheckIn)
  );
};

const getDaysCount = (checkIn, checkOut) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil(
    (new Date(checkOut) - new Date(checkIn)) / msPerDay
  );
};

const calculateTotalPrice = (pricePerNight, checkIn, checkOut) => {
  const days = getDaysCount(checkIn, checkOut);
  return pricePerNight * days;
};

module.exports = {
  checkOverlap,
  getDaysCount,
  calculateTotalPrice,
};