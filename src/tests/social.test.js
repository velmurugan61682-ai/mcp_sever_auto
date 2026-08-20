import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { generateAICaption, generateAIImage } from '../controllers/socialController.js';

test('Social Manager: AI Caption returns 400 when no BYOK key configured', async () => {
  const req = { workspaceId: new mongoose.Types.ObjectId() };
  let statusCode = 0;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  await generateAICaption(req, res);
  assert.equal(statusCode, 400);
  assert.equal(responseData.success, false);
  assert.equal(responseData.message.includes('No OpenAI API key configured'), true);
});

test('Social Manager: AI Image returns 400 when no BYOK key configured', async () => {
  const req = { workspaceId: new mongoose.Types.ObjectId() };
  let statusCode = 0;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  await generateAIImage(req, res);
  assert.equal(statusCode, 400);
  assert.equal(responseData.success, false);
  assert.equal(responseData.message.includes('No Image Generation API key configured'), true);
});
