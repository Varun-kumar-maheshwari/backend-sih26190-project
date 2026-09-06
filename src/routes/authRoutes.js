import express from 'express';
import cookieParser from 'cookie-parser';
import {
  login,
  refreshSession,
  refreshToken,
  logout,
} from '../controllers/authController.js';

const router = express.Router();

router.use(cookieParser());
router.post('/login', login);
router.get('/refresh', refreshSession ?? refreshToken);
router.post('/logout', logout);

export default router;
