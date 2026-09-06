import express from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import requireDepartment from '../middlewares/requireDepartment.js';
import validateJurisdiction from '../middlewares/validateJurisdiction.js';
import { registerStaff, resetPassword } from '../controllers/authController.js';
import requireRole from '../middlewares/requireRole.js'

const router = express.Router();

router.use(requireAuth);
router.post('/',requireRole('ADMIN') ,requireDepartment('CYBER_CELL'), validateJurisdiction, registerStaff);
router.patch('/:targetUserId/reset-password',requireRole('ADMIN') ,requireDepartment('CYBER_CELL'), resetPassword);

export default router;
