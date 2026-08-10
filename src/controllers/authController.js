import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/env.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const generateToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
};

// @desc    Register new user
// @route   POST /api/auth/register
export const registerUser = asyncWrapper(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email address already registered' });
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role === 'admin' ? 'admin' : 'user'
  });

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      settings: user.settings
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
export const loginUser = asyncWrapper(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      settings: user.settings
    }
  });
});

// @desc    Get current authenticated user
// @route   GET /api/auth/me
export const getMe = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      settings: user.settings
    }
  });
});

// @desc    Update user settings
// @route   PATCH /api/auth/settings
export const updateSettings = asyncWrapper(async (req, res) => {
  const { settings } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { settings: { ...req.user.settings, ...settings } },
    { new: true }
  );

  res.status(200).json({
    success: true,
    settings: user.settings
  });
});

// @desc    Google OAuth / quick auth
// @route   POST /api/auth/google
export const googleUser = asyncWrapper(async (req, res) => {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Google email address is required' });
  }

  let user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    const randomPassword = 'google_pwd_' + Math.random().toString(36).slice(-10) + '!A1';
    const userName = name || email.split('@')[0] || 'Google User';
    user = await User.create({
      name: userName,
      email: email.toLowerCase().trim(),
      password: randomPassword,
      role: 'user'
    });
  }

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      settings: user.settings
    }
  });
});

