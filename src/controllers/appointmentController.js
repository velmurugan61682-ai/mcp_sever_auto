import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import { calculateAvailableSlots } from '../services/availabilityEngine.js';
import StructuredActivity from '../models/StructuredActivity.js';
import { appointmentQueue, QueueUnavailableError } from '../config/queueConfig.js';

const getWorkspaceId = (req) => req.auth.workspaceId;
const activeAppointmentStatuses = ['awaiting_confirmation', 'confirmed', 'rescheduled'];

const enqueueConfirmation = async ({ appointment, channel, correlationId }) => {
  const job = await appointmentQueue.add(
    'appointment.confirmation',
    {
      workspaceId: String(appointment.workspaceId),
      jobType: 'appointment.confirmation',
      entityId: String(appointment._id),
      appointmentId: String(appointment._id),
      idempotencyKey: `appointment-confirmation:${appointment._id}:${channel}`,
      correlationId,
      channel,
      recipientPhone: appointment.customerPhone,
      recipientEmail: appointment.customerEmail,
      customerName: appointment.customerName,
      serviceName: appointment.serviceName,
      time: appointment.startTime.toISOString()
    },
    {
      jobId: `appointment-confirmation:${appointment._id}:${channel}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    }
  );

  appointment.confirmationQueuedAt = new Date();
  appointment.confirmationDeliveryStatus = 'queued';
  appointment.confirmationChannel = channel;
  appointment.confirmationJobId = String(job.id);
  await appointment.save();

  return job;
};

export const getAppointments = async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const appointments = await Appointment.find({ workspaceId }).sort({ startTime: 1 });
    res.json({ success: true, count: appointments.length, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const workspaceId = getWorkspaceId(req);
    const {
      customerName,
      customerPhone,
      customerEmail,
      serviceName,
      serviceDurationMinutes,
      meetingType,
      locationName,
      locationAddress,
      staffMember,
      startTime,
      notes,
    } = req.body;

    if (!customerName || !startTime) {
      return res.status(400).json({ success: false, message: 'Customer name and start time are required' });
    }

    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid appointment start time' });
    }

    const duration = Number(serviceDurationMinutes || 30);
    if (!Number.isFinite(duration) || duration <= 0) {
      return res.status(400).json({ success: false, message: 'Service duration must be a positive number' });
    }

    const end = new Date(start.getTime() + duration * 60000);
    const staff = staffMember || 'Dr. Emily Vance';
    let appointment;

    await session.withTransaction(async () => {
      appointment = await Appointment.reserveSlotAtomic(
        {
          workspaceId,
          customerName,
          customerPhone,
          customerEmail,
          serviceName: serviceName || 'General Consultation',
          serviceDurationMinutes: duration,
          meetingType: meetingType || 'in_person',
          locationName: locationName || 'Downtown Branch',
          locationAddress: locationAddress || '100 Market St, Suite 400',
          staffMember: staff,
          startTime: start,
          endTime: end,
          status: 'awaiting_confirmation',
          bookedBy: 'ai_agent',
          notes,
          reservationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          reservationLockExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
        { session }
      );

      await StructuredActivity.create(
        [
          {
            workspaceId,
            actor: 'Ana (Appointment Agent)',
            actorType: 'agent',
            mode: 'autonomous',
            action: 'Booked appointment',
            category: 'appointments',
            customerName,
            detail: `${serviceName || 'Consultation'} booked for ${start.toISOString()} at ${locationName || 'Downtown Branch'}.`,
            outcome: 'success',
            linkedEntityId: appointment._id.toString(),
          }
        ],
        { session }
      );
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    if (error.message?.startsWith('Slot conflict')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

export const sendConfirmation = async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const { channel = 'whatsapp' } = req.body;

    const appointment = await Appointment.findOne({ _id: id, workspaceId });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const job = await enqueueConfirmation({ appointment, channel, correlationId: req.headers['x-correlation-id'] });

    await StructuredActivity.create({
      workspaceId,
      actor: 'BUZZZ Automated Workflow',
      actorType: 'workflow',
      mode: 'autonomous',
      action: `Queued appointment confirmation via ${channel}`,
      category: 'appointments',
      customerName: appointment.customerName,
      detail: `Confirmation job ${job.id} queued for ${appointment.customerPhone || appointment.customerEmail}.`,
      outcome: 'success',
      linkedEntityId: appointment._id.toString(),
    });

    res.status(202).json({
      success: true,
      message: `Confirmation queued for ${channel}`,
      data: appointment,
      jobId: job.id
    });
  } catch (error) {
    const statusCode = error instanceof QueueUnavailableError || error.code === 'QUEUE_UNAVAILABLE' ? 503 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const sendAllPendingConfirmations = async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { channel = 'whatsapp' } = req.body;
    const pending = await Appointment.find({ workspaceId, status: 'awaiting_confirmation' });
    const jobs = [];

    for (const appt of pending) {
      const job = await enqueueConfirmation({ appt, appointment: appt, channel, correlationId: req.headers['x-correlation-id'] });
      jobs.push(job.id);
    }

    res.status(202).json({
      success: true,
      queuedCount: jobs.length,
      message: `Queued confirmations for ${jobs.length} appointments.`,
      jobs,
    });
  } catch (error) {
    const statusCode = error instanceof QueueUnavailableError || error.code === 'QUEUE_UNAVAILABLE' ? 503 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

export const checkSlots = async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { date = new Date().toISOString().split('T')[0], duration = 30, staffMember } = req.query;
    const existing = await Appointment.find({
      workspaceId,
      status: { $in: activeAppointmentStatuses },
      ...(staffMember ? { staffMember } : {})
    });
    const result = calculateAvailableSlots({
      dateStr: date,
      serviceDurationMinutes: Number(duration),
      existingBookings: existing,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
