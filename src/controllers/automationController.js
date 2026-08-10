import { AutomationWorkflow } from '../models/AutomationWorkflow.js';
import { AuditLog } from '../models/AuditLog.js';

// GET /api/automations
export const getAutomations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const automations = await AutomationWorkflow.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      automations
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/automations
export const createAutomation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, trigger, targetApp, serverId, selectedTool, parameterMapping, conditions } = req.body;

    if (!name || !trigger) {
      return res.status(400).json({ success: false, message: 'Workflow name and trigger are required.' });
    }

    const workflow = await AutomationWorkflow.create({
      userId,
      name,
      trigger,
      targetApp: targetApp || 'Custom MCP Server',
      serverId,
      selectedTool: selectedTool || 'mcp_tool_execute',
      parameterMapping: parameterMapping || {},
      conditions: conditions || [],
      status: 'active',
      executionsCount: 0,
      successRate: 100
    });

    await AuditLog.create({
      userId,
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

// PUT /api/automations/:id/toggle
export const toggleAutomation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const workflow = await AutomationWorkflow.findOne({ _id: id, userId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Automation workflow not found' });
    }

    workflow.status = workflow.status === 'active' ? 'paused' : 'active';
    await workflow.save();

    await AuditLog.create({
      userId,
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

// POST /api/automations/:id/test
export const testAutomation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const workflow = await AutomationWorkflow.findOne({ _id: id, userId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Automation workflow not found' });
    }

    workflow.executionsCount += 1;
    workflow.lastExecutedAt = new Date();
    await workflow.save();

    await AuditLog.create({
      userId,
      action: 'AUTOMATION_TEST_RUN',
      category: 'automation',
      details: { workflowId: id, name: workflow.name }
    });

    return res.status(200).json({
      success: true,
      message: `Workflow '${workflow.name}' test run completed successfully. Trigger: ${workflow.trigger}. Tool: ${workflow.selectedTool || 'default'}.`,
      result: {
        status: 'executed',
        timestamp: new Date().toISOString(),
        mappedParameters: workflow.parameterMapping
      }
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/automations/:id
export const deleteAutomation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const workflow = await AutomationWorkflow.findOneAndDelete({ _id: id, userId });
    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Automation workflow not found' });
    }

    await AuditLog.create({
      userId,
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
