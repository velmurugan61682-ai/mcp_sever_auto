import { calculateAvailableSlots } from '../services/availabilityEngine.js';

export { calculateAvailableSlots };

export const checkSlotOverlap = (existingBookings, startTimeStr, endTimeStr) => {
  const targetStart = new Date(startTimeStr).getTime();
  const targetEnd = new Date(endTimeStr).getTime();

  return existingBookings.some((booking) => {
    if (booking.status === 'cancelled') return false;
    const bStart = new Date(booking.startTime).getTime();
    const bEnd = new Date(booking.endTime).getTime();
    return targetStart < bEnd && targetEnd > bStart;
  });
};

export default {
  calculateAvailableSlots,
  checkSlotOverlap
};
