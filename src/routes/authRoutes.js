import express from 'express';
import cookieParser from 'cookie-parser';
import { login, refreshToken, logout } from '../controllers/authController.js';

const router = express.Router();

router.use(cookieParser());
router.post('/login', login);
router.get('/refresh', refreshToken);
router.post('/logout', logout);

export default router;
