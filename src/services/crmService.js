import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import Company from '../models/Company.js';
import Deal from '../models/Deal.js';
import Pipeline from '../models/Pipeline.js';
import Ticket from '../models/Ticket.js';
import Task from '../models/Task.js';
import Note from '../models/Note.js';
import SavedSegment from '../models/SavedSegment.js';
import { AuditLog } from '../models/AuditLog.js';

export const CRM_MODELS = {
  contacts: Contact,
  companies: Company,
  deals: Deal,
  pipelines: Pipeline,
  tickets: Ticket,
  tasks: Task,
  notes: Note,
  segments: SavedSegment
};

export const CRM_ENTITY_TYPES = {
  contacts: 'contact',
  companies: 'company',
  deals: 'deal',
  pipelines: 'pipeline',
  tickets: 'ticket',
  tasks: 'task',
  notes: 'note',
  segments: 'saved_segment'
};

const ARCHIVE_STATUS_BY_RESOURCE = {
  contacts: 'archived',
  deals: 'archived',
  tickets: 'archived',
  tasks: 'archived'
};

export class CrmError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const getCrmModel = (resource) => {
  const model = CRM_MODELS[resource];
  if (!model) throw new CrmError(404, 'CRM resource not found');
  return model;
};

export const scopedResourceQuery = ({ id, workspaceId, includeArchived = false }) => {
  const query = { _id: id, workspaceId };
  if (!includeArchived) query.archivedAt = { $exists: false };
  return query;
};

export const requireScopedDocument = async ({ model, id, workspaceId, includeArchived = false }) => {
  const doc = await model.findOne(scopedResourceQuery({ id, workspaceId, includeArchived }));
  if (!doc) throw new CrmError(404, 'Resource not found');
  return doc;
};

export const serializeDoc = (doc) => (doc?.toObject ? doc.toObject() : doc);

export const writeAudit = async ({ workspaceId, userId, actorType = 'human', actorId, source = 'human', action, entityType, entityId, before, after, outcome = 'success', severity = 'info', reason, correlationId, details = {} }) => {
  return AuditLog.create({
    workspaceId,
    userId,
    actorType,
    actorId,
    source,
    action,
    category: action?.startsWith('GOVERNANCE_') ? 'governance' : 'crm',
    entityType,
    entityId,
    before,
    after,
    outcome,
    severity,
    reason,
    correlationId,
    details
  });
};


export const applyArchiveFields = ({ record, resource, userId, archivedAt = new Date() }) => {
  record.archivedAt = archivedAt;
  record.archivedBy = userId;
  if (ARCHIVE_STATUS_BY_RESOURCE[resource]) record.status = ARCHIVE_STATUS_BY_RESOURCE[resource];
  return record;
};

export const buildBulkContactUpdate = ({ action, value, userId, archivedAt = new Date() }) => {
  if (action === 'assign_owner') return { $set: { ownerId: value } };
  if (action === 'tag') return { $addToSet: { tags: value } };
  if (action === 'archive') return { $set: { archivedAt, archivedBy: userId, status: 'archived' } };
  throw new CrmError(400, 'Unsupported bulk action');
};
export const buildListQuery = ({ workspaceId, queryParams = {}, searchableFields = [] }) => {
  const { search, status, source, ownerId, tag, minScore, notContactedInDays, archived } = queryParams;
  const query = { workspaceId };

  if (archived === 'true' || archived === true) {
    query.archivedAt = { $exists: true };
  } else if (archived === 'all') {
    // explicit no-op
  } else {
    query.archivedAt = { $exists: false };
  }

  if (status && status !== 'all') query.status = status;
  if (source && source !== 'all') query.source = source;
  if (ownerId && ownerId !== 'all') query.ownerId = ownerId;
  if (tag) query.tags = tag;
  if (minScore !== undefined) query.score = { $gte: Number(minScore) };
  if (notContactedInDays !== undefined) {
    const cutoff = new Date(Date.now() - Number(notContactedInDays) * 24 * 60 * 60 * 1000);
    query.$or = [{ lastContactedAt: { $lte: cutoff } }, { lastContactedAt: { $exists: false } }];
  }
  if (search) {
    const pattern = { $regex: search, $options: 'i' };
    query.$and = query.$and || [];
    query.$and.push({ $or: searchableFields.map((field) => ({ [field]: pattern })) });
  }

  return query;
};

export const listResources = async ({ resource, workspaceId, queryParams }) => {
  const model = getCrmModel(resource);
  const searchableFields = resource === 'contacts'
    ? ['name', 'email', 'phone', 'tags']
    : resource === 'companies'
      ? ['name', 'domain', 'phone', 'tags']
      : resource === 'deals'
        ? ['name', 'tags']
        : resource === 'tickets'
          ? ['title', 'description', 'tags']
          : ['title', 'description'];
  const query = buildListQuery({ workspaceId, queryParams, searchableFields });
  const limit = Math.min(Number(queryParams.limit || 50), 100);
  const cursor = queryParams.cursor;
  if (cursor) query._id = { $lt: cursor };

  const items = await model.find(query).sort({ _id: -1 }).limit(limit + 1);
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  return {
    items: page,
    nextCursor: hasMore ? String(page[page.length - 1]._id) : null
  };
};

export const createResource = async ({ resource, workspaceId, userId, payload, source = 'human' }) => {
  const model = getCrmModel(resource);
  const doc = await model.create({ ...payload, workspaceId, ownerId: payload.ownerId || userId });
  await writeAudit({ workspaceId, userId, source, action: `${resource.toUpperCase()}_CREATED`, entityType: CRM_ENTITY_TYPES[resource], entityId: doc._id, after: serializeDoc(doc) });
  return doc;
};

export const updateResource = async ({ resource, id, workspaceId, userId, payload, source = 'human' }) => {
  const model = getCrmModel(resource);
  const existing = await requireScopedDocument({ model, id, workspaceId });
  const before = serializeDoc(existing);
  Object.assign(existing, payload, { workspaceId });
  await existing.save();
  await writeAudit({ workspaceId, userId, source, action: `${resource.toUpperCase()}_UPDATED`, entityType: CRM_ENTITY_TYPES[resource], entityId: existing._id, before, after: serializeDoc(existing) });
  return existing;
};

export const archiveResource = async ({ resource, id, workspaceId, userId, source = 'human' }) => {
  const model = getCrmModel(resource);
  const existing = await requireScopedDocument({ model, id, workspaceId });
  const before = serializeDoc(existing);
  applyArchiveFields({ record: existing, resource, userId });
  await existing.save();
  await writeAudit({ workspaceId, userId, source, action: `${resource.toUpperCase()}_ARCHIVED`, entityType: CRM_ENTITY_TYPES[resource], entityId: existing._id, before, after: serializeDoc(existing) });
  return existing;
};

export const detectDuplicateContactsQuery = ({ workspaceId, email, phone, name, excludeId }) => {
  const or = [];
  if (email) or.push({ email: String(email).toLowerCase().trim() });
  if (phone) or.push({ phone: String(phone).trim() });
  if (name) or.push({ name: { $regex: `^${String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });

  const query = { workspaceId, archivedAt: { $exists: false }, $or: or };
  if (excludeId) query._id = { $ne: excludeId };
  return query;
};

export const detectDuplicateContacts = async ({ workspaceId, contact }) => {
  const query = detectDuplicateContactsQuery({ workspaceId, email: contact.email, phone: contact.phone, name: contact.name, excludeId: contact._id });
  if (!query.$or.length) return [];
  return Contact.find(query).limit(25);
};

export const bulkUpdateContacts = async ({ workspaceId, userId, contactIds, action, value }) => {
  const filter = { _id: { $in: contactIds }, workspaceId, archivedAt: { $exists: false } };
  const update = {};

  if (action === 'assign_owner') update.$set = { ownerId: value };
  else if (action === 'tag') update.$addToSet = { tags: value };
  else if (action === 'archive') update.$set = { archivedAt: new Date(), archivedBy: userId, status: 'archived' };
  else throw new CrmError(400, 'Unsupported bulk action');

  const result = await Contact.updateMany(filter, update);
  await writeAudit({ workspaceId, userId, action: `CONTACTS_BULK_${action.toUpperCase()}`, entityType: 'contact', outcome: 'success', details: { contactIds, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
  return result;
};

export const createTasksForContacts = async ({ workspaceId, userId, contactIds, task }) => {
  const contacts = await Contact.find({ _id: { $in: contactIds }, workspaceId, archivedAt: { $exists: false } }).select('_id');
  const docs = contacts.map((contact) => ({ ...task, workspaceId, contactId: contact._id, ownerId: task.ownerId || userId, source: task.source || 'human' }));
  const created = docs.length ? await Task.insertMany(docs) : [];
  await writeAudit({ workspaceId, userId, action: 'CONTACTS_BULK_TASKS_CREATED', entityType: 'task', details: { contactIds, createdCount: created.length } });
  return created;
};

export const mergeContacts = async ({ workspaceId, userId, keepId, mergeId }) => {
  if (String(keepId) === String(mergeId)) throw new CrmError(400, 'Cannot merge a contact into itself');
  const keep = await requireScopedDocument({ model: Contact, id: keepId, workspaceId });
  const merged = await requireScopedDocument({ model: Contact, id: mergeId, workspaceId });
  const before = { keep: serializeDoc(keep), merged: serializeDoc(merged) };

  keep.tags = Array.from(new Set([...(keep.tags || []), ...(merged.tags || [])]));
  keep.email = keep.email || merged.email;
  keep.phone = keep.phone || merged.phone;
  keep.companyId = keep.companyId || merged.companyId;
  keep.customFields = { ...(serializeDoc(merged).customFields || {}), ...(serializeDoc(keep).customFields || {}) };
  keep.lastContactedAt = keep.lastContactedAt && merged.lastContactedAt
    ? new Date(Math.max(keep.lastContactedAt.getTime(), merged.lastContactedAt.getTime()))
    : keep.lastContactedAt || merged.lastContactedAt;
  await keep.save();

  await Promise.all([
    Deal.updateMany({ workspaceId, contactId: merged._id }, { $set: { contactId: keep._id } }),
    Ticket.updateMany({ workspaceId, contactId: merged._id }, { $set: { contactId: keep._id } }),
    Task.updateMany({ workspaceId, contactId: merged._id }, { $set: { contactId: keep._id } }),
    Note.updateMany({ workspaceId, entityType: 'contact', entityId: merged._id }, { $set: { entityId: keep._id } })
  ]);

  merged.archivedAt = new Date();
  merged.archivedBy = userId;
  merged.status = 'archived';
  await merged.save();

  await writeAudit({ workspaceId, userId, action: 'CONTACTS_MERGED', entityType: 'contact', entityId: keep._id, before, after: { keep: serializeDoc(keep), archivedMergedId: merged._id } });
  return keep;
};

export const renamePipelineStage = async ({ workspaceId, userId, pipelineId, oldKey, newKey, newName }) => {
  const pipeline = await requireScopedDocument({ model: Pipeline, id: pipelineId, workspaceId });
  const before = serializeDoc(pipeline);
  const stage = pipeline.stages.find((item) => item.key === oldKey);
  if (!stage) throw new CrmError(404, 'Pipeline stage not found');

  stage.key = newKey;
  stage.name = newName;
  await pipeline.save();
  const dealResult = await Deal.updateMany({ workspaceId, pipelineId, stageKey: oldKey }, { $set: { stageKey: newKey } });

  await writeAudit({ workspaceId, userId, action: 'PIPELINE_STAGE_RENAMED', entityType: 'pipeline', entityId: pipeline._id, before, after: serializeDoc(pipeline), details: { oldKey, newKey, migratedDeals: dealResult.modifiedCount } });
  return { pipeline, migratedDeals: dealResult.modifiedCount };
};

export const createSavedSegment = async ({ workspaceId, userId, payload }) => {
  const segment = await SavedSegment.create({ ...payload, workspaceId, createdBy: userId });
  await writeAudit({ workspaceId, userId, action: 'SAVED_SEGMENT_CREATED', entityType: 'saved_segment', entityId: segment._id, after: serializeDoc(segment) });
  return segment;
};

export const listSavedSegments = async ({ workspaceId, entityType }) => {
  return SavedSegment.find({ workspaceId, ...(entityType ? { entityType } : {}) }).sort({ createdAt: -1 });
};

export const exportContactsCsv = async ({ workspaceId, queryParams }) => {
  const query = buildListQuery({ workspaceId, queryParams, searchableFields: ['name', 'email', 'phone', 'tags'] });
  const contacts = await Contact.find(query).sort({ _id: -1 }).limit(10000);
  const rows = [['name', 'email', 'phone', 'source', 'status', 'score', 'tags']];
  for (const contact of contacts) {
    rows.push([contact.name, contact.email, contact.phone, contact.source, contact.status, contact.score, (contact.tags || []).join('|')]);
  }
  return rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
};

export default {
  getCrmModel,
  scopedResourceQuery,
  requireScopedDocument,
  listResources,
  createResource,
  updateResource,
  archiveResource,
  detectDuplicateContacts,
  detectDuplicateContactsQuery,
  bulkUpdateContacts,
  createTasksForContacts,
  mergeContacts,
  renamePipelineStage,
  createSavedSegment,
  listSavedSegments,
  exportContactsCsv,
  applyArchiveFields,
  buildBulkContactUpdate
};

