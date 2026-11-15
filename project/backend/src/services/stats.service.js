import { getCommunityStats } from '../repositories/stats.repository.js';

const getCommunityStatsService = async () => {
  return await getCommunityStats();
};

export { getCommunityStatsService };
