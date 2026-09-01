import express from 'express';
import { createCase, getAllCases, getCaseById } from '../controllers/caseController.js';
import requireAuth from '../middlewares/requireAuth.js';
import requireRole from '../middlewares/requireRole.js';
import documentRoutes from "../routes/documentRoutes.js";


const router = express.Router();

router.use(requireAuth);

router.post('/', requireRole(['ADMIN', 'INVESTIGATOR']), createCase);
router.get('/', getAllCases);
router.get('/:id', getCaseById);
router.use('/:caseId/documents', documentRoutes)
export default router;
