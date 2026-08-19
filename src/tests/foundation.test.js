import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAvailableSlots } from '../services/availabilityEngine.js';
import { buildPermissions } from '../middleware/authMiddleware.js';

test('availability blocks partial overlaps, not only identical starts', () => {
  const result = calculateAvailableSlots({
    dateStr: '2026-08-19',
    serviceDurationMinutes: 30,
    bufferMinutes: 0,
    existingBookings: [
      {
        startTime: '2026-08-19T10:00:00.000Z',
        endTime: '2026-08-19T11:00:00.000Z',
        status: 'confirmed'
      }
    ]
  });

  const blocked = result.slots.find((slot) => slot.time === '10:30');
  const available = result.slots.find((slot) => slot.time === '11:00');

  assert.equal(blocked, undefined);
  assert.equal(available?.available, true);
});

test('admin role gets wildcard permission and member does not get crm.write', () => {
  assert.deepEqual(buildPermissions('admin'), ['*']);
  assert.equal(buildPermissions('member').includes('crm.write'), false);
});
