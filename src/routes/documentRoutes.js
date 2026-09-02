import express from 'express';
import { uploadDocument, getAllDocuments, getDocumentById } from '../controllers/documentController.js';
import upload from '../middlewares/uploadMiddleware.js';
import requireAuth from '../middlewares/requireAuth.js';
import requireRole from '../middlewares/requireRole.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);
router.post('/', requireRole(['ADMIN', 'INVESTIGATOR']), upload.single('file'), uploadDocument);
router.get('/', getAllDocuments);
router.get('/:documentId', getDocumentById);

export default router;
