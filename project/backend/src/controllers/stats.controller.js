import { getCommunityStatsService } from '../services/stats.service.js';

const getCommunityStats = async (req, res, next) => {
  try {
    const stats = await getCommunityStatsService();
    return res.status(200).json({ ok: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export { getCommunityStats };
