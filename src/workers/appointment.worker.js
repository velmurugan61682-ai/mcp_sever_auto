import { queueManager } from '../config/queueConfig.js';
import Appointment from '../models/Appointment.js';
import StructuredActivity from '../models/StructuredActivity.js';
import GoWhatsConnector from '../services/connectors/gowhats.js';

const gowhats = new GoWhatsConnector(process.env.GOWHATS_API_KEY, process.env.GOWHATS_WEBHOOK_SECRET);

/**
 * Worker: Dispatches asynchronous multi-channel appointment confirmations & reminders
 */
queueManager.registerWorker('appointment-reminders', async (job) => {
  const { appointmentId, channel = 'whatsapp', recipientPhone, customerName, serviceName, time } = job.data;

  try {
    if (channel === 'whatsapp') {
      await gowhats.sendMessage({
        to: recipientPhone,
        text: `Hi ${customerName}, your appointment for ${serviceName} is confirmed for ${time}. Reply 1 to confirm or 2 to reschedule.`,
      });
    }

    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        confirmationDeliveryStatus: 'sent',
        confirmationSentAt: new Date(),
        status: 'confirmed',
      });
    }

    await StructuredActivity.create({
      actor: 'Appointment Reminder Worker',
      actorType: 'workflow',
      mode: 'autonomous',
      action: `Worker Dispatched ${channel.toUpperCase()} Reminder`,
      category: 'appointments',
      customerName,
      detail: `Successfully processed queue job ${job.id} for ${serviceName}.`,
      outcome: 'success',
      linkedEntityId: appointmentId,
    });
  } catch (error) {
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        confirmationDeliveryStatus: 'failed',
      });
    }
    throw error;
  }
});
