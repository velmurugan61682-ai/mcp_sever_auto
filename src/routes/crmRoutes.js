import express from 'express';
import { protect, requirePermission } from '../middleware/authMiddleware.js';
import enforceTenantScope from '../middleware/tenantScope.js';
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  addLeadNote,
  listCrmResources,
  getCrmResource,
  createCrmResource,
  updateCrmResource,
  archiveCrmResource,
  detectContactDuplicates,
  bulkContacts,
  mergeContacts,
  renamePipelineStage,
  createSavedSegment,
  listSavedSegments,
  exportContactsCsv
} from '../controllers/crmController.js';

const router = express.Router();

router.use(protect, enforceTenantScope);

// Backward-compatible CRMLead endpoints used by the existing React CRM page.
router.get('/leads', requirePermission('crm.read'), getLeads);
router.post('/leads', requirePermission('crm.write'), createLead);
router.put('/leads/:id', requirePermission('crm.write'), updateLead);
router.delete('/leads/:id', requirePermission('crm.write'), deleteLead);
router.post('/leads/:id/notes', requirePermission('crm.write'), addLeadNote);

// Phase B production CRM endpoints.
router.get('/segments', requirePermission('crm.read'), listSavedSegments);
router.post('/segments', requirePermission('crm.write'), createSavedSegment);
router.post('/contacts/duplicates', requirePermission('crm.read'), detectContactDuplicates);
router.post('/contacts/bulk', requirePermission('crm.write'), bulkContacts);
router.post('/contacts/merge', requirePermission('crm.write'), mergeContacts);
router.get('/contacts/export.csv', requirePermission('crm.read'), exportContactsCsv);
router.post('/pipelines/:id/stages/rename', requirePermission('crm.write'), renamePipelineStage);

router.get('/:resource', requirePermission('crm.read'), listCrmResources);
router.post('/:resource', requirePermission('crm.write'), createCrmResource);
router.get('/:resource/:id', requirePermission('crm.read'), getCrmResource);
router.put('/:resource/:id', requirePermission('crm.write'), updateCrmResource);
router.patch('/:resource/:id', requirePermission('crm.write'), updateCrmResource);
router.delete('/:resource/:id', requirePermission('crm.write'), archiveCrmResource);
router.post('/:resource/:id/archive', requirePermission('crm.write'), archiveCrmResource);

export default router;
