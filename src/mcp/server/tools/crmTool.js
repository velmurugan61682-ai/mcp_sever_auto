import { CRMLead } from '../../../models/CRMLead.js';

export const createCrmLeadToolDefinition = {
  name: 'create_crm_lead',
  description: 'Create a new CRM lead or contact from customer information',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Full name of the lead' },
      email: { type: 'string', description: 'Email address' },
      company: { type: 'string', description: 'Company name' },
      status: { type: 'string', enum: ['hot', 'warm', 'cold'], description: 'Lead priority/status' },
      sourcePlatform: { type: 'string', description: 'Platform source (e.g. Chat, Gmail, LinkedIn)' }
    },
    required: ['name']
  }
};

export const executeCreateCrmLead = async (args, userId) => {
  if (!args.name) {
    throw new Error('Lead name is required.');
  }

  const lead = await CRMLead.create({
    userId,
    name: args.name,
    email: args.email || '',
    company: args.company || 'Independent',
    status: args.status || 'warm',
    sourcePlatform: args.sourcePlatform || 'AI Chat',
    leadScore: args.status === 'hot' ? 85 : 55,
    tags: ['AI-Captured'],
    notes: [{ content: 'Lead created via AI Assistant conversation', author: 'MCP.ai Assistant' }]
  });

  return {
    success: true,
    message: `CRM Lead '${lead.name}' created successfully.`,
    leadId: lead._id,
    lead
  };
};
