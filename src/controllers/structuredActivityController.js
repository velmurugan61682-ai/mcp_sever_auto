import StructuredActivity from '../models/StructuredActivity.js';

export const getStructuredActivity = async (req, res) => {
  try {
    const { category, mode, customerName } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (mode) filter.mode = mode;
    if (customerName) filter.customerName = new RegExp(customerName, 'i');

    let activities = await StructuredActivity.find(filter).sort({ createdAt: -1 }).limit(100);

    if (activities.length === 0) {
      const seeded = [
        {
          actor: 'Sarah (Sales AI)',
          actorType: 'agent',
          mode: 'autonomous',
          action: 'Moved deal to Negotiation',
          category: 'crm_changes',
          customerName: 'Sarah Tan',
          detail: 'Auto-qualified lead based on positive WhatsApp response and moved deal ($18,500) to Negotiation stage.',
          outcome: 'success',
        },
        {
          actor: 'Ana (Appointment Agent)',
          actorType: 'agent',
          mode: 'autonomous',
          action: 'Booked in-person visit & sent WhatsApp confirmation',
          category: 'appointments',
          customerName: 'Arun Kumar',
          detail: 'Booked consultation for tomorrow at 11:00 AM at Downtown Branch. Confirmation delivered via GoWhats.in.',
          outcome: 'success',
        },
        {
          actor: 'Voz (Voice AI - MrAssistant.ai)',
          actorType: 'agent',
          mode: 'autonomous',
          action: 'Completed Inbound Phone Consultation',
          category: 'calls',
          customerName: 'Michael Chang',
          detail: 'Answered call (2m 22s), summarized key requirements, and generated follow-up task in CRM.',
          outcome: 'success',
        },
        {
          actor: 'Manager',
          actorType: 'human',
          mode: 'approved',
          action: 'Approved 15% Enterprise Contract Rebate',
          category: 'approvals',
          customerName: 'Michael Chang',
          detail: 'Authorized $4,200.00 goodwill credit on annual contract renewal.',
          outcome: 'success',
        },
        {
          actor: 'Sky (Social Media AI)',
          actorType: 'agent',
          mode: 'autonomous',
          action: 'Published Instagram Carousel via InstaxBot',
          category: 'social_posts',
          detail: 'Published Product Spotlight content to Instagram (@vertex_official) and LinkedIn.',
          outcome: 'success',
        },
      ];
      activities = await StructuredActivity.insertMany(seeded);
    }

    res.json({ success: true, count: activities.length, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
