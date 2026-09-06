import express from 'express';
import {
  uploadDocument,
  getAllDocuments,
  getDocumentById,
  retryRedaction,
  getBsaCertificate,
  getAuditLogs,
  verifyDocumentIntegrity,
} from '../controllers/documentController.js';
import upload from '../middlewares/uploadMiddleware.js';
import requireAuth from '../middlewares/requireAuth.js';
import requireCaseJurisdiction from '../middlewares/requireCaseJurisdiction.js';
import requireRole from '../middlewares/requireRole.js';

const router = express.Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireCaseJurisdiction('caseId'));

router.post('/', requireRole(['ADMIN', 'INVESTIGATOR']), upload.single('file'), uploadDocument);
router.get('/', getAllDocuments);
router.get('/:documentId', getDocumentById);
router.post('/:documentId/retry-redaction', retryRedaction);
router.get('/:documentId/certificate', getBsaCertificate);
router.get('/:documentId/audit-logs', getAuditLogs);
router.get('/:documentId/verify', verifyDocumentIntegrity);

export default router;
