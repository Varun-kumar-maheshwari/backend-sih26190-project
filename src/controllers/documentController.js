import crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import prisma from '../config/db.js';
import {mockRedaction, redaction} from '../services/aiBridge.js'

export const uploadDocument = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { title, type } = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;

    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    if (!caseId) {
      return res.status(400).json({ message: 'Case ID is required' });
    }

    if (!title || !type) {
      return res.status(400).json({ message: 'title and docType are required' });
    }

    const docExist = await prisma.documents.findUnique({
      where: { idempotencyKey },
    });

    if (docExist) {
      return res.status(409).json({ message: 'doc is already on db' });
    }

    const caseRecord = await prisma.cases.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord) {
      return res.status(404).json({ message: 'Case not found' });
    }

    const calculatedHash = crypto
      .createHash('sha256')
      .update(req.file.buffer)
      .digest('hex');

    const uploadDir = path.join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const fileExtension = path.extname(req.file.originalname) || '.bin';
    const savedFileName = `${Date.now()}${fileExtension}`;
    const savedFilePath = path.join('uploads', savedFileName);
    const absolutePath = path.join(process.cwd(), savedFilePath);

    await writeFile(absolutePath, req.file.buffer);

    const document = await prisma.documents.create({
      data: {
        caseId,
        uploaderId: req.user.id,
        title,
        type,
        originalFilePath: savedFilePath,
        fileHash: calculatedHash,
        idempotencyKey,
      },
    });

    res.status(201).json({
      document,
      hash: calculatedHash,
    });
    mockRedaction(absolutePath, document.id)
  } catch (error) {
    console.error('Document upload error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllDocuments = async (req, res) => {
  const { caseId } = req.params;
  const documents = await prisma.documents.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({ documents });
};

export const getDocumentById = async (req, res) => {
  const { caseId, documentId } = req.params;
  const document = await prisma.documents.findFirst({
    where: { id: documentId, caseId },
  });

  if (!document) {
    return res.status(404).json({ message: 'Document not found' });
  }

  return res.status(200).json({ document });
};

export default uploadDocument;
