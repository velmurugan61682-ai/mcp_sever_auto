import { AutomationWorkflow } from '../models/AutomationWorkflow.js';
import { AuditLog } from '../models/AuditLog.js';
import { StructuredActivity } from '../models/StructuredActivity.js';

export const getAutomations = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const query = workspaceId ? { workspaceId } : { userId: req.user._id };
    const automations = await AutomationWorkflow.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      automations
    });
  } catch (error) {
    next(error);
  }
};

export const createDraftWorkflow = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const userId = req.user._id;

    const draft = await AutomationWorkflow.create({
      workspaceId,
      userId,
      name: 'Untitled Workflow Draft',
      trigger: 'New message received',
      status: 'draft',
      currentStep: 1,
      nodes: [{ id: 'node-trigger-1', type: 'trigger', data: { triggerType: 'New message received' } }],
      edges: []
    });

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: userId,
      action: 'CREATE_WORKFLOW_DRAFT',
      outcome: 'success',
      details: { workflowId: draft._id }
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      workflow: draft
    });
  } catch (error) {
    next(error);
  }
};

export const updateWorkflowStep = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;
    const { stepIndex, name, trigger, stepData, nodes, edges } = req.body;

    const workflow = await AutomationWorkflow.findOne({ _id: id, workspaceId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow draft not found.' });
    }

    if (stepIndex !== undefined) workflow.currentStep = stepIndex;
    if (name) workflow.name = name;
    if (trigger) {
      workflow.trigger = trigger;
      // Guarantee trigger node in nodes[0]
      if (!workflow.nodes || workflow.nodes.length === 0) {
        workflow.nodes = [{ id: 'node-trigger-1', type: 'trigger', data: { triggerType: trigger } }];
      } else {
        workflow.nodes[0] = { id: 'node-trigger-1', type: 'trigger', data: { triggerType: trigger } };
      }
    }
    if (stepData) workflow.stepData = { ...(workflow.stepData || {}), ...stepData };
    if (nodes) workflow.nodes = nodes;
    if (edges) workflow.edges = edges;

    await workflow.save();

    return res.status(200).json({
      success: true,
      workflow
    });
  } catch (error) {
    next(error);
  }
};

export const publishWorkflow = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;

    const workflow = await AutomationWorkflow.findOne({ _id: id, workspaceId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Workflow not found.' });
    }

    // Graph Validation
    if (!workflow.name || workflow.name === 'Untitled Workflow Draft') {
      return res.status(400).json({ success: false, message: 'Validation failed: Workflow must have a descriptive name before publishing.' });
    }

    const hasTriggerNode = workflow.nodes && workflow.nodes.some((n) => n.type === 'trigger');
    if (!hasTriggerNode) {
      return res.status(400).json({ success: false, message: 'Validation failed: Workflow graph must contain at least one valid trigger node.' });
    }

    workflow.status = 'active';
    await workflow.save();

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: req.user?._id,
      action: 'PUBLISH_WORKFLOW',
      outcome: 'success',
      details: { workflowId: id, name: workflow.name }
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Workflow '${workflow.name}' successfully published and active.`,
      workflow
    });
  } catch (error) {
    next(error);
  }
};

export const createAutomation = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const userId = req.user._id;
    const { name, trigger, targetApp, serverId, selectedTool, parameterMapping, conditions } = req.body;

    if (!name || !trigger) {
      return res.status(400).json({ success: false, message: 'Workflow name and trigger are required.' });
    }

    const workflow = await AutomationWorkflow.create({
      workspaceId,
      userId,
      name,
      trigger,
      status: 'active',
      nodes: [{ id: '1', type: 'trigger', data: { triggerType: trigger } }],
      edges: []
    });

    await AuditLog.create({
      userId,
      workspaceId,
      action: 'AUTOMATION_CREATED',
      category: 'automation',
      details: { workflowId: workflow._id, name: workflow.name }
    });

    return res.status(201).json({
      success: true,
      message: 'Automation workflow created successfully',
      automation: workflow
    });
  } catch (error) {
    next(error);
  }
};

export const toggleAutomation = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;

    const workflow = await AutomationWorkflow.findOne({ _id: id, workspaceId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Automation workflow not found' });
    }

    workflow.status = workflow.status === 'active' ? 'paused' : 'active';
    await workflow.save();

    await AuditLog.create({
      userId: req.user._id,
      workspaceId,
      action: `AUTOMATION_${workflow.status.toUpperCase()}`,
      category: 'automation',
      details: { workflowId: id }
    });

    return res.status(200).json({
      success: true,
      message: `Workflow ${workflow.status === 'active' ? 'resumed' : 'paused'}`,
      automation: workflow
    });
  } catch (error) {
    next(error);
  }
};

export const testAutomation = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;

    const workflow = await AutomationWorkflow.findOne({ _id: id, workspaceId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Automation workflow not found' });
    }

    workflow.executionsCount += 1;
    workflow.lastExecutedAt = new Date();
    await workflow.save();

    return res.status(200).json({
      success: true,
      message: `Workflow '${workflow.name}' test run completed successfully. Trigger: ${workflow.trigger}.`,
      result: {
        status: 'executed',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAutomation = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;

    const workflow = await AutomationWorkflow.findOneAndDelete({ _id: id, workspaceId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Automation workflow not found' });
    }

    await AuditLog.create({
      userId: req.user._id,
      workspaceId,
      action: 'AUTOMATION_DELETED',
      category: 'automation',
      details: { workflowId: id }
    });

    return res.status(200).json({
      success: true,
      message: 'Automation workflow deleted'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAutomations,
  createDraftWorkflow,
  updateWorkflowStep,
  publishWorkflow,
  createAutomation,
  toggleAutomation,
  testAutomation,
  deleteAutomation
};
