import { CRMLead } from '../models/CRMLead.js';
import { AuditLog } from '../models/AuditLog.js';

// GET /api/crm/leads
export const getLeads = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, search, stage, platform } = req.query;

    const query = { userId };

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

    // Summary stats
    const totalLeads = await CRMLead.countDocuments({ userId });
    const hotLeads = await CRMLead.countDocuments({ userId, status: 'hot' });
    const qualifiedLeads = await CRMLead.countDocuments({ userId, stage: 'Qualified' });
    const followUpsDue = await CRMLead.countDocuments({ userId, stage: { $in: ['New', 'Contacted'] } });

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

// POST /api/crm/leads
export const createLead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, email, phone, company, title, status, stage, leadScore, sourcePlatform, tags, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Lead name is required' });
    }

    const newLead = await CRMLead.create({
      userId,
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
      action: 'CRM_LEAD_CREATED',
      category: 'crm',
      details: { leadId: newLead._id, name: newLead.name }
    });

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      lead: newLead
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/crm/leads/:id
export const updateLead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const lead = await CRMLead.findOne({ _id: id, userId });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const updated = await CRMLead.findByIdAndUpdate(id, { ...req.body, updatedAt: new Date() }, { new: true });

    await AuditLog.create({
      userId,
      action: 'CRM_LEAD_UPDATED',
      category: 'crm',
      details: { leadId: id, name: updated.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Lead updated',
      lead: updated
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/crm/leads/:id
export const deleteLead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const lead = await CRMLead.findOneAndDelete({ _id: id, userId });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    await AuditLog.create({
      userId,
      action: 'CRM_LEAD_DELETED',
      category: 'crm',
      details: { leadId: id, name: lead.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/crm/leads/:id/notes
export const addLeadNote = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Note content is required' });
    }

    const lead = await CRMLead.findOne({ _id: id, userId });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    lead.notes.push({ content, author: req.user.name, createdAt: new Date() });
    lead.lastInteractionAt = new Date();
    await lead.save();

    return res.status(200).json({
      success: true,
      message: 'Note added',
      lead
    });
  } catch (error) {
    next(error);
  }
};
