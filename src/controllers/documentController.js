import crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import prisma from '../config/db.js';
import fs from 'fs/promises';

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
      where: { idempotencyKey:idempotencyKey },
    });
    if(docExist) {
      return res.status(409).json({message: 'doc is already on db '})
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
    const fileName = `${caseId}-${Date.now()}-${req.file.originalname}`;
    await mkdir(uploadDir, { recursive: true });

    const fileExtension = path.extname(req.file.originalname) || '.bin';
    const savedFileName = `${Date.now()}${fileExtension}`;
    const savedFilePath = path.join('uploads', savedFileName);
    const absolutePath = path.join(process.cwd(), savedFilePath);

    await writeFile(absolutePath, req.file.buffer);
    await fs.mkdir(uploadDir, { recursive: true }); // Ensures the folder exists
    await fs.writeFile(savedFilePath, req.file.buffer);

    const document = await prisma.documents.create({
      data: {
        caseId,
        uploaderId: req.user.id,
        title,
        type,
        originalFilePath: savedFilePath,
        fileHash: calculatedHash,
        idempotencyKey
      },
    });

    return res.status(201).json({
      document,
      hash: calculatedHash,
    });
  } catch (error) {
    console.error('Document upload error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export default uploadDocument;
