import { AuditLog } from '../models/AuditLog.js';

export const getAuditLogs = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { category } = req.query;

    const query = { userId };
    if (category && category !== 'all') {
      query.category = category;
    }

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(100);

    return res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    next(error);
  }
};
