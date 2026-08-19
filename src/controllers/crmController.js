import { CRMLead } from '../models/CRMLead.js';
import { AuditLog } from '../models/AuditLog.js';
import * as crmService from '../services/crmService.js';

const getWorkspaceId = (req) => req.auth.workspaceId;
const getUserId = (req) => req.auth.userId;

const sendCrmError = (res, error) => {
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
  return res.status(500).json({ success: false, message: error.message });
};

// Backward-compatible lead endpoints for the existing frontend.
export const getLeads = async (req, res, next) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { status, search, stage, platform } = req.query;

    const query = { workspaceId };

    if (status && status !== 'all') query.status = status;
    if (stage && stage !== 'all') query.stage = stage;
    if (platform && platform !== 'all') query.sourcePlatform = platform;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const leads = await CRMLead.find(query).sort({ updatedAt: -1 });

    const totalLeads = await CRMLead.countDocuments({ workspaceId });
    const hotLeads = await CRMLead.countDocuments({ workspaceId, status: 'hot' });
    const qualifiedLeads = await CRMLead.countDocuments({ workspaceId, stage: 'Qualified' });
    const followUpsDue = await CRMLead.countDocuments({ workspaceId, stage: { $in: ['New', 'Contacted'] } });

    return res.status(200).json({
      success: true,
      leads,
      stats: {
        totalLeads,
        hotLeads,
        qualifiedLeads,
        followUpsDue,
        conversionRate: totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createLead = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const workspaceId = getWorkspaceId(req);
    const { name, email, phone, company, title, status, stage, leadScore, sourcePlatform, tags, notes } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Lead name is required' });

    const newLead = await CRMLead.create({
      userId,
      workspaceId,
      name,
      email: email || '',
      phone: phone || '',
      company: company || '',
      title: title || '',
      status: status || 'warm',
      stage: stage || 'New',
      leadScore: leadScore || (status === 'hot' ? 85 : status === 'cold' ? 30 : 60),
      sourcePlatform: sourcePlatform || 'Manual Entry',
      tags: tags || ['Lead'],
      notes: notes ? [{ content: notes, author: req.user.name }] : []
    });

    await AuditLog.create({
      userId,
      workspaceId,
      action: 'CRM_LEAD_CREATED',
      category: 'crm',
      entityType: 'crm_lead',
      entityId: newLead._id,
      after: newLead.toObject(),
      details: { leadId: newLead._id, name: newLead.name }
    });

    return res.status(201).json({ success: true, message: 'Lead created successfully', lead: newLead });
  } catch (error) {
    next(error);
  }
};

export const updateLead = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const before = await CRMLead.findOne({ _id: id, workspaceId });
    if (!before) return res.status(404).json({ success: false, message: 'Lead not found' });

    const updated = await CRMLead.findOneAndUpdate({ _id: id, workspaceId }, { ...req.body, workspaceId, updatedAt: new Date() }, { new: true });

    await AuditLog.create({
      userId,
      workspaceId,
      action: 'CRM_LEAD_UPDATED',
      category: 'crm',
      entityType: 'crm_lead',
      entityId: updated._id,
      before: before.toObject(),
      after: updated.toObject(),
      details: { leadId: id, name: updated.name }
    });

    return res.status(200).json({ success: true, message: 'Lead updated', lead: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;

    const lead = await CRMLead.findOne({ _id: id, workspaceId });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.stage = 'Lost';
    lead.tags = Array.from(new Set([...(lead.tags || []), 'Archived']));
    await lead.save();

    await AuditLog.create({
      userId,
      workspaceId,
      action: 'CRM_LEAD_ARCHIVED',
      category: 'crm',
      entityType: 'crm_lead',
      entityId: lead._id,
      after: lead.toObject(),
      details: { leadId: id, name: lead.name }
    });

    return res.status(200).json({ success: true, message: 'Lead archived successfully' });
  } catch (error) {
    next(error);
  }
};

export const addLeadNote = async (req, res, next) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { id } = req.params;
    const { content } = req.body;

    if (!content) return res.status(400).json({ success: false, message: 'Note content is required' });

    const lead = await CRMLead.findOne({ _id: id, workspaceId });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.notes.push({ content, author: req.user.name, createdAt: new Date() });
    lead.lastInteractionAt = new Date();
    await lead.save();

    return res.status(200).json({ success: true, message: 'Note added', lead });
  } catch (error) {
    next(error);
  }
};

export const listCrmResources = async (req, res) => {
  try {
    const result = await crmService.listResources({ resource: req.params.resource, workspaceId: getWorkspaceId(req), queryParams: req.query });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const getCrmResource = async (req, res) => {
  try {
    const model = crmService.getCrmModel(req.params.resource);
    const item = await crmService.requireScopedDocument({ model, id: req.params.id, workspaceId: getWorkspaceId(req), includeArchived: req.query.archived === 'true' });
    return res.json({ success: true, item });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const createCrmResource = async (req, res) => {
  try {
    const item = await crmService.createResource({ resource: req.params.resource, workspaceId: getWorkspaceId(req), userId: getUserId(req), payload: req.body });
    return res.status(201).json({ success: true, item });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const updateCrmResource = async (req, res) => {
  try {
    const item = await crmService.updateResource({ resource: req.params.resource, id: req.params.id, workspaceId: getWorkspaceId(req), userId: getUserId(req), payload: req.body });
    return res.json({ success: true, item });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const archiveCrmResource = async (req, res) => {
  try {
    const item = await crmService.archiveResource({ resource: req.params.resource, id: req.params.id, workspaceId: getWorkspaceId(req), userId: getUserId(req) });
    return res.json({ success: true, item });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const detectContactDuplicates = async (req, res) => {
  try {
    const duplicates = await crmService.detectDuplicateContacts({ workspaceId: getWorkspaceId(req), contact: req.body });
    return res.json({ success: true, duplicates });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const bulkContacts = async (req, res) => {
  try {
    const { contactIds = [], action, value, task } = req.body;
    if (action === 'create_tasks') {
      const created = await crmService.createTasksForContacts({ workspaceId: getWorkspaceId(req), userId: getUserId(req), contactIds, task: task || {} });
      return res.status(201).json({ success: true, created });
    }
    const result = await crmService.bulkUpdateContacts({ workspaceId: getWorkspaceId(req), userId: getUserId(req), contactIds, action, value });
    return res.json({ success: true, result });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const mergeContacts = async (req, res) => {
  try {
    const item = await crmService.mergeContacts({ workspaceId: getWorkspaceId(req), userId: getUserId(req), keepId: req.body.keepId, mergeId: req.body.mergeId });
    return res.json({ success: true, item });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const renamePipelineStage = async (req, res) => {
  try {
    const result = await crmService.renamePipelineStage({ workspaceId: getWorkspaceId(req), userId: getUserId(req), pipelineId: req.params.id, oldKey: req.body.oldKey, newKey: req.body.newKey, newName: req.body.newName });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const createSavedSegment = async (req, res) => {
  try {
    const segment = await crmService.createSavedSegment({ workspaceId: getWorkspaceId(req), userId: getUserId(req), payload: req.body });
    return res.status(201).json({ success: true, segment });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const listSavedSegments = async (req, res) => {
  try {
    const segments = await crmService.listSavedSegments({ workspaceId: getWorkspaceId(req), entityType: req.query.entityType });
    return res.json({ success: true, segments });
  } catch (error) {
    return sendCrmError(res, error);
  }
};

export const exportContactsCsv = async (req, res) => {
  try {
    const csv = await crmService.exportContactsCsv({ workspaceId: getWorkspaceId(req), queryParams: req.query });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    return res.send(csv);
  } catch (error) {
    return sendCrmError(res, error);
  }
};
