import { parseAndExecuteCommand } from '../services/buzzzCommandEngine.js';
import StructuredActivity from '../models/StructuredActivity.js';

export const executeBuzzzCommand = async (req, res) => {
  try {
    const { commandText } = req.body;
    if (!commandText) {
      return res.status(400).json({ success: false, message: 'commandText is required' });
    }

    const executionResult = await parseAndExecuteCommand(commandText, {});

    // Record to activity ledger
    await StructuredActivity.create({
      actor: 'BUZZZ AI Assistant',
      actorType: 'agent',
      mode: 'autonomous',
      action: `Executed Natural Language Command: "${commandText.slice(0, 50)}..."`,
      category: 'governance',
      detail: executionResult.resultMessage,
      outcome: 'success',
    });

    res.json({
      success: true,
      data: executionResult,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
