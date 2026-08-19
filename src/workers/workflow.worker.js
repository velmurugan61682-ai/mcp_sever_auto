import { queueManager } from '../config/queueConfig.js';
import StructuredActivity from '../models/StructuredActivity.js';

/**
 * Worker: Resumes asynchronous and delayed workflow node executions
 */
queueManager.registerWorker('workflow-execution', async (job) => {
  const { workflowId, workflowName, nodeId, nodeType, payload, executionStep = 1 } = job.data;

  // Enforce loop guard
  if (executionStep > 5) {
    console.warn(`[Workflow Worker] Loop guard tripped on workflow ${workflowName} at step ${executionStep}. Aborting run.`);
    return;
  }

  try {
    // Process resumed node action
    await StructuredActivity.create({
      actor: `Workflow Engine (${workflowName})`,
      actorType: 'workflow',
      mode: 'autonomous',
      action: `Executed Delayed Step (${nodeType})`,
      category: 'workflows',
      detail: `Resumed asynchronous job ${job.id} for node ${nodeId} at step ${executionStep}.`,
      outcome: 'success',
      linkedEntityId: workflowId,
    });
  } catch (error) {
    console.error(`[Workflow Worker] Error processing workflow ${workflowId}:`, error);
    throw error;
  }
});
