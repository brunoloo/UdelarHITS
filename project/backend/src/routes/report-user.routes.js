import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';
import { reportUser, getPendingReports, resolveReport } from '../controllers/report-user.controller.js';

const router = Router();

router.post('/:nickname/report', protect, reportUser);
router.get('/pending', protect, isAdmin, getPendingReports);
router.patch('/:id/resolve', protect, isAdmin, resolveReport);

export default router;