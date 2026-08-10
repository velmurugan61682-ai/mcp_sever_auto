import { z } from 'zod';
import { Note } from '../../../models/Note.js';

export const searchNotesToolDefinition = {
  name: 'search_saved_notes',
  description: 'Searches the authenticated user\'s saved notes by keyword in title or content.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term or keyword' },
      userId: { type: 'string', description: 'User ID context (automatically provided)' }
    },
    required: ['query']
  }
};

export const createNoteToolDefinition = {
  name: 'create_note',
  description: 'Creates a new note for the authenticated user.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the note' },
      content: { type: 'string', description: 'Main text content of the note' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Optional tag array' },
      userId: { type: 'string', description: 'User ID context (automatically provided)' }
    },
    required: ['title', 'content']
  }
};

export const searchNotesInputSchema = z.object({
  query: z.string(),
  userId: z.string().optional()
});

export const createNoteInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  userId: z.string().optional()
});

export const executeSearchNotes = async (args, contextUserId) => {
  const { query, userId } = searchNotesInputSchema.parse(args);
  const targetUserId = userId || contextUserId;

  let notes = [];
  try {
    const filter = {};
    if (targetUserId) {
      filter.user = targetUserId;
    }
    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }
    notes = await Note.find(filter).sort({ updatedAt: -1 }).limit(20);
  } catch (err) {
    console.warn('[executeSearchNotes] DB query fallback:', err.message);
  }

  return {
    success: true,
    count: notes.length,
    query,
    notes: notes.map((n) => ({
      id: n._id,
      title: n.title,
      content: n.content,
      tags: n.tags,
      updatedAt: n.updatedAt
    }))
  };
};

export const executeCreateNote = async (args, contextUserId) => {
  const { title, content, tags, userId } = createNoteInputSchema.parse(args);
  const targetUserId = userId || contextUserId;

  if (!targetUserId) {
    throw new Error('User context required to create a note');
  }

  const newNote = await Note.create({
    user: targetUserId,
    title,
    content,
    tags
  });

  return {
    success: true,
    message: 'Note created successfully',
    note: {
      id: newNote._id,
      title: newNote.title,
      content: newNote.content,
      tags: newNote.tags,
      createdAt: newNote.createdAt
    }
  };
};
