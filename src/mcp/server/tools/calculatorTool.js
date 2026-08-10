import { z } from 'zod';

export const calculatorToolDefinition = {
  name: 'calculator',
  description: 'Performs basic mathematical operations (add, subtract, multiply, divide).',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'Operation to perform'
      },
      a: { type: 'number', description: 'First number' },
      b: { type: 'number', description: 'Second number' }
    },
    required: ['operation', 'a', 'b']
  }
};

export const calculatorInputSchema = z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number(),
  b: z.number()
});

export const executeCalculator = async (args) => {
  const { operation, a, b } = calculatorInputSchema.parse(args);
  let result = 0;

  switch (operation) {
    case 'add':
      result = a + b;
      break;
    case 'subtract':
      result = a - b;
      break;
    case 'multiply':
      result = a * b;
      break;
    case 'divide':
      if (b === 0) {
        throw new Error('Division by zero is not allowed');
      }
      result = a / b;
      break;
  }

  return {
    success: true,
    operation,
    a,
    b,
    result
  };
};
