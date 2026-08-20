/**
 * Pure workflow graph execution engine.
 * Takes a workflow definition (nodes, edges) and initial context payload.
 */
export const runWorkflow = async (workflow, initialContext = {}) => {
  const { nodes = [], edges = [] } = workflow;
  const executionLog = [];
  let currentContext = { ...initialContext };

  const startNode = nodes.find((n) => n.type === 'trigger' || n.type === 'start') || nodes[0];
  if (!startNode) {
    return { success: false, reason: 'No start/trigger node found in workflow graph', executionLog };
  }

  let currentNodeId = startNode.id;
  const visited = new Set();

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    executionLog.push({
      nodeId: node.id,
      type: node.type,
      timestamp: new Date().toISOString(),
      status: 'executed'
    });

    if (node.type === 'delay') {
      currentContext.delayedNodeId = node.id;
      return { success: true, status: 'paused_delay', nextNodeId: node.id, executionLog, context: currentContext };
    }

    if (node.type === 'approval_gate') {
      return { success: true, status: 'queued_approval', gateNodeId: node.id, executionLog, context: currentContext };
    }

    const nextEdge = edges.find((e) => e.source === currentNodeId);
    currentNodeId = nextEdge ? nextEdge.target : null;
  }

  return {
    success: true,
    status: 'completed',
    executionLog,
    context: currentContext
  };
};

export default { runWorkflow };
