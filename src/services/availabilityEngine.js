/**
 * Availability Engine for In-Person & Remote Appointments
 * Calculates bookable slots and rejects any active interval overlap.
 */

const overlaps = (slotStart, slotEnd, booking) => {
  const bookingStart = new Date(booking.startTime);
  const bookingEnd = new Date(booking.endTime);
  return slotStart < bookingEnd && slotEnd > bookingStart;
};

export const calculateAvailableSlots = ({
  dateStr,
  serviceDurationMinutes = 30,
  bufferMinutes = 10,
  branchOpeningHour = 9,
  branchClosingHour = 18,
  breakStartHour = 13,
  breakEndHour = 14,
  existingBookings = [],
}) => {
  const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
  const dayOfWeek = targetDate.getUTCDay();

  if (dayOfWeek === 0) {
    return {
      available: false,
      reason: 'Branch is closed on Sundays.',
      slots: [],
    };
  }

  const slots = [];
  const slotIntervalMinutes = serviceDurationMinutes + bufferMinutes;
  const closingMinuteOffset = branchClosingHour * 60;
  const breakStartMin = breakStartHour * 60;
  const breakEndMin = breakEndHour * 60;

  for (let currentMinuteOffset = branchOpeningHour * 60; currentMinuteOffset + serviceDurationMinutes <= closingMinuteOffset; currentMinuteOffset += slotIntervalMinutes) {
    const slotEndMin = currentMinuteOffset + serviceDurationMinutes;
    const isDuringBreak = currentMinuteOffset < breakEndMin && slotEndMin > breakStartMin;

    if (isDuringBreak) continue;

    const slotHour = Math.floor(currentMinuteOffset / 60);
    const slotMin = currentMinuteOffset % 60;
    const formattedTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
    const slotStart = new Date(`${dateStr}T${formattedTime}:00.000Z`);
    const slotEnd = new Date(slotStart.getTime() + serviceDurationMinutes * 60000);

    const isBooked = existingBookings.some((booking) => booking.status !== 'cancelled' && booking.status !== 'no_show' && overlaps(slotStart, slotEnd, booking));

    if (!isBooked) {
      slots.push({
        time: formattedTime,
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        durationMinutes: serviceDurationMinutes,
        available: true,
      });
    }
  }

  return {
    available: slots.length > 0,
    date: dateStr,
    totalSlots: slots.length,
    slots,
  };
};

export default {
  calculateAvailableSlots,
};
