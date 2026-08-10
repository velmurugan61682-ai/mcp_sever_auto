import { z } from 'zod';

export const getTimeToolDefinition = {
  name: 'get_current_time',
  description: 'Returns the current date and time in the specified timezone (or UTC/local).',
  inputSchema: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'Timezone identifier e.g. "Asia/Kolkata", "America/New_York", "UTC"'
      }
    }
  }
};

export const getTimeInputSchema = z.object({
  timezone: z.string().optional().default('UTC')
});

export const executeGetTime = async (args) => {
  const { timezone } = getTimeInputSchema.parse(args || {});
  const now = new Date();
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'medium'
    }).format(now);

    return {
      success: true,
      timestamp: now.toISOString(),
      timezone,
      formattedTime: formatted
    };
  } catch (err) {
    // Fallback to UTC if timezone string is invalid
    return {
      success: true,
      timestamp: now.toISOString(),
      timezone: 'UTC (fallback)',
      formattedTime: now.toUTCString(),
      warning: `Invalid timezone '${timezone}'. Fallback to UTC.`
    };
  }
};
