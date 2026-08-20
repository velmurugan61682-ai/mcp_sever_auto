/**
 * Pricing & token cost calculation engine.
 */
export const calculateTokenCost = ({ tokensUsed = 0, model = 'gpt-4o' }) => {
  const rates = {
    'gpt-4o': 0.00001,
    'claude-3-5-sonnet': 0.000015,
    'deepseek-r1': 0.000005
  };

  const rate = rates[model] || 0.00001;
  return Number((tokensUsed * rate).toFixed(6));
};

export default { calculateTokenCost };
