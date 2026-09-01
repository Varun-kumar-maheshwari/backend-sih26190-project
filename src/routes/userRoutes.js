import express from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import requireDepartment from '../middlewares/requireDepartment.js';
import {
  registerStaff,
  adminResetUserPassword,
} from '../controllers/userController.js';

const router = express.Router();

router.use(requireAuth);

router.post('/', requireDepartment('CYBER_CELL'), registerStaff);
router.patch('/:userId/reset-password', requireDepartment('CYBER_CELL'), adminResetUserPassword);

export default router;
