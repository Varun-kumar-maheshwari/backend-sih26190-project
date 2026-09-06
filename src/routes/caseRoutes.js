import express from 'express';
import {
  assignOfficerToCase,
  createCase,
  getCases,
  getCaseById,
} from '../controllers/caseController.js';
import requireAuth from '../middlewares/requireAuth.js';
import requireCaseJurisdiction from '../middlewares/requireCaseJurisdiction.js';
import requireRole from '../middlewares/requireRole.js';
import documentRoutes from './documentRoutes.js';

const router = express.Router();

router.use(requireAuth);

router.post('/', requireRole(['ADMIN', 'INVESTIGATOR']), createCase);
router.get('/', getCases);
router.get('/:id', requireCaseJurisdiction('id'), getCaseById);
router.patch('/:caseId/officers/:officerId', requireCaseJurisdiction('caseId'), assignOfficerToCase);
router.use('/:caseId/documents', documentRoutes);

export default router;
