import { blockUserService, unblockUserService, getBlockedUsersService } from '../services/block.service.js';

const blockUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    await blockUserService(req.user.id, nickname);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const unblockUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    await unblockUserService(req.user.id, nickname);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getBlockedUsers = async (req, res) => {
  try {
    const users = await getBlockedUsersService(req.user.id);
    return res.status(200).json({ ok: true, data: users });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { blockUser, unblockUser, getBlockedUsers };
