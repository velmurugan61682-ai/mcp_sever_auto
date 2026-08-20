import { Agent } from '../models/Agent.js';
import { AutomationWorkflow } from '../models/AutomationWorkflow.js';
import { AIKeySetting } from '../models/AIKeySetting.js';
import { StructuredActivity } from '../models/StructuredActivity.js';
import { checkEntitlement } from '../engines/entitlements.js';

export const INDUSTRY_PACK_TEMPLATES = {
  clinics_hospitals: {
    name: 'Clinics & Hospitals Pack',
    agents: [
      { name: 'Dr. Sarah — Triage & Intake AI', role: 'Patient Intake Specialist', defaultAutonomy: 2, permissions: ['CAN_SEND_MESSAGE', 'CAN_BOOK_APPOINTMENT'], tools: ['messaging', 'calendar'], channels: ['chat', 'whatsapp'] },
      { name: 'Dr. Alex — Appointment Coordinator', role: 'Patient Scheduling Specialist', defaultAutonomy: 2, permissions: ['CAN_BOOK_APPOINTMENT'], tools: ['calendar'], channels: ['chat', 'whatsapp'] },
      { name: 'Nurse Maya — Patient Follow-up AI', role: 'Post-Care Coordinator', defaultAutonomy: 2, permissions: ['CAN_SEND_MESSAGE'], tools: ['messaging'], channels: ['chat', 'email'] }
    ],
    workflows: [
      { name: 'Patient Triage & Appointment Booking', trigger: 'New message received', nodes: [{ id: '1', type: 'trigger', data: { triggerType: 'New message received' } }] },
      { name: 'Post-Care Follow-up Ladder', trigger: 'New lead created', nodes: [{ id: '1', type: 'trigger', data: { triggerType: 'New lead created' } }] },
      { name: 'Appointment Reminder & Confirmation', trigger: 'Scheduled time', nodes: [{ id: '1', type: 'trigger', data: { triggerType: 'Scheduled time' } }] }
    ]
  },
  salons_spas: {
    name: 'Salons & Spas Pack',
    agents: [
      { name: 'Bella — Spa Receptionist AI', role: 'Booking Coordinator', defaultAutonomy: 2, permissions: ['CAN_SEND_MESSAGE', 'CAN_BOOK_APPOINTMENT'], tools: ['messaging', 'calendar'], channels: ['chat', 'whatsapp'] },
      { name: 'Chloe — VIP Care Specialist', role: 'Client Retention Agent', defaultAutonomy: 2, permissions: ['CAN_SEND_MESSAGE'], tools: ['messaging'], channels: ['chat', 'email'] }
    ],
    workflows: [
      { name: 'Session Booking & Service Selector', trigger: 'New message received', nodes: [{ id: '1', type: 'trigger', data: { triggerType: 'New message received' } }] },
      { name: '24h Session Reminder Sequence', trigger: 'Scheduled time', nodes: [{ id: '1', type: 'trigger', data: { triggerType: 'Scheduled time' } }] }
    ]
  },
  real_estate: {
    name: 'Real Estate Agencies Pack',
    agents: [
      { name: 'Marcus — Property Inquiries AI', role: 'Buyer Qualification Specialist', defaultAutonomy: 2, permissions: ['CAN_SEND_MESSAGE', 'CAN_CREATE_LEAD'], tools: ['messaging', 'crm'], channels: ['chat', 'whatsapp'] },
      { name: 'Elena — Site Viewing Scheduler', role: 'Viewing Coordinator', defaultAutonomy: 2, permissions: ['CAN_BOOK_APPOINTMENT'], tools: ['calendar'], channels: ['chat', 'whatsapp'] }
    ],
    workflows: [
      { name: 'Property Inquiry Lead Capture', trigger: 'Keyword detected', nodes: [{ id: '1', type: 'trigger', data: { triggerType: 'Keyword detected' } }] },
      { name: 'Site Viewing Booking Flow', trigger: 'New message received', nodes: [{ id: '1', type: 'trigger', data: { triggerType: 'New message received' } }] }
    ]
  }
};

export const deployIndustryPackTemplates = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { industryPackId = 'clinics_hospitals' } = req.body;

    const pack = INDUSTRY_PACK_TEMPLATES[industryPackId] || INDUSTRY_PACK_TEMPLATES.clinics_hospitals;

    // Check entitlement limit
    const existingAgentsCount = await Agent.countDocuments({ workspaceId });
    const entitlementCheck = checkEntitlement('pro', 'maxAgents', existingAgentsCount);
    if (!entitlementCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: `Deployment blocked: Workspace agent limit of ${entitlementCheck.limit} reached.`
      });
    }

    // Get workspace autonomy ceiling
    const settings = await AIKeySetting.findOne({ workspaceId });
    const ceiling = settings?.workspaceAutonomyCeiling ?? 4;

    let keptExistingAgents = 0;
    let createdNewAgents = 0;
    const deployedAgents = [];

    for (const tplAgent of pack.agents) {
      const existing = await Agent.findOne({ workspaceId, name: tplAgent.name });
      if (existing) {
        keptExistingAgents += 1;
        deployedAgents.push(existing);
      } else {
        const effectiveAutonomy = Math.min(tplAgent.defaultAutonomy, ceiling);
        const newAgent = await Agent.create({
          workspaceId,
          name: tplAgent.name,
          role: tplAgent.role,
          status: 'paused',
          autonomyLevel: effectiveAutonomy,
          permissions: tplAgent.permissions,
          tools: tplAgent.tools,
          channels: tplAgent.channels
        });
        createdNewAgents += 1;
        deployedAgents.push(newAgent);
      }
    }

    let keptExistingWorkflows = 0;
    let createdNewWorkflows = 0;
    const deployedWorkflows = [];

    for (const tplWf of pack.workflows) {
      const existing = await AutomationWorkflow.findOne({ workspaceId, name: tplWf.name });
      if (existing) {
        keptExistingWorkflows += 1;
        deployedWorkflows.push(existing);
      } else {
        const newWf = await AutomationWorkflow.create({
          workspaceId,
          userId: req.user?._id,
          name: tplWf.name,
          trigger: tplWf.trigger,
          status: 'paused',
          nodes: tplWf.nodes
        });
        createdNewWorkflows += 1;
        deployedWorkflows.push(newWf);
      }
    }

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: req.user?._id,
      action: 'DEPLOY_INDUSTRY_PACK_TEMPLATES',
      outcome: 'success',
      details: {
        industryPackId,
        createdNewAgents,
        keptExistingAgents,
        createdNewWorkflows,
        keptExistingWorkflows
      }
    }).catch(() => {});

    res.json({
      success: true,
      message: `Deployed ${pack.name}: kept ${keptExistingAgents} existing agents, created ${createdNewAgents} new; kept ${keptExistingWorkflows} existing workflows, created ${createdNewWorkflows} new.`,
      summary: {
        keptExistingAgents,
        createdNewAgents,
        keptExistingWorkflows,
        createdNewWorkflows
      },
      deployedAgents,
      deployedWorkflows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default { deployIndustryPackTemplates, INDUSTRY_PACK_TEMPLATES };
