/**
 * Zero-trust tenant scoping middleware.
 * Workspace context must already be resolved by authentication and never comes from the browser.
 */
export const enforceTenantScope = (req, res, next) => {
  const userWorkspaceId = req.auth?.workspaceId || req.user?.workspaceId;

  if (!userWorkspaceId) {
    return res.status(403).json({ success: false, message: 'No authorized workspace context' });
  }

  req.workspaceId = userWorkspaceId;

  if (req.body && typeof req.body === 'object') {
    delete req.body.workspaceId;
    delete req.body.tenantId;
    delete req.body.workspace_id;
    req.body.workspaceId = userWorkspaceId;
  }

  if (req.query && typeof req.query === 'object') {
    delete req.query.workspaceId;
    delete req.query.tenantId;
    delete req.query.workspace_id;
  }

  next();
};

export default enforceTenantScope;
