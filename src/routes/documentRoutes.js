import express from 'express';
import { uploadDocument } from '../controllers/documentController.js';
import upload from '../middlewares/uploadMiddleware.js';
import requireAuth from '../middlewares/requireAuth.js';
import requireRole from '../middlewares/requireRole.js';

const router = express.Router({ mergeParams: true });1

router.use(requireAuth);
router.post('/', requireRole(['ADMIN', 'INVESTIGATOR']), upload.single('file'), uploadDocument);

export default router;
