import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';

const ROLE_PERMISSIONS = {
  owner: ['*'],
  admin: ['*'],
  manager: [
    'crm.read',
    'crm.write',
    'appointments.read',
    'appointments.write',
    'campaigns.execute',
    'social.publish',
    'calls.execute',
    'agents.manage',
    'approvals.review',
    'settings.manage',
    'integrations.manage'
  ],
  sales_manager: ['crm.read', 'crm.write', 'campaigns.execute', 'approvals.review'],
  support_manager: ['crm.read', 'crm.write', 'appointments.read', 'appointments.write', 'approvals.review'],
  finance_manager: ['crm.read', 'approvals.review', 'refund.approve'],
  agent: ['crm.read', 'appointments.read', 'appointments.write', 'calls.execute'],
  member: ['crm.read', 'appointments.read'],
  user: ['crm.read', 'appointments.read']
};

const normalizeRole = (role) => (role === 'user' ? 'member' : role || 'member');

const buildPermissions = (role, explicitPermissions = []) => {
  const resolved = new Set([...(ROLE_PERMISSIONS[normalizeRole(role)] || []), ...explicitPermissions]);
  return Array.from(resolved);
};

const resolveWorkspaceContext = async (user) => {
  if (user.workspaceId) {
    const membership = await Workspace.findOne({
      _id: user.workspaceId,
      $or: [{ ownerId: user._id }, { 'members.user': user._id }]
    }).select('_id');

    if (membership) return membership._id;
  }

  let workspace = await Workspace.findOne({
    $or: [{ ownerId: user._id }, { 'members.user': user._id }]
  }).select('_id');

  if (!workspace) {
    workspace = await Workspace.create({
      name: `${user.name || 'Default'} Workspace`,
      ownerId: user._id,
      members: [{ user: user._id, role: normalizeRole(user.role) === 'owner' ? 'admin' : 'member' }]
    });
  }

  if (!user.workspaceId || String(user.workspaceId) !== String(workspace._id)) {
    user.workspaceId = workspace._id;
    await user.save({ validateBeforeSave: false });
  }

  return workspace._id;
};

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User belonging to this token no longer exists' });
    }

    const workspaceId = await resolveWorkspaceContext(req.user);
    const role = normalizeRole(req.user.role);
    const permissions = buildPermissions(role, req.user.permissions);

    req.auth = {
      userId: req.user._id,
      workspaceId,
      role,
      permissions
    };
    req.workspaceId = workspaceId;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    const role = req.auth?.role || req.user?.role;
    if (!roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${role}' is not authorized to access this route`
      });
    }
    next();
  };
};

export const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    const permissions = req.auth?.permissions || [];
    if (permissions.includes('*') || requiredPermissions.some((permission) => permissions.includes(permission))) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action'
    });
  };
};

export { ROLE_PERMISSIONS, buildPermissions };
