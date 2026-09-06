import axios from 'axios';
import FormData from 'form-data';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import prisma from '../config/db.js';
import appendAuditLog from '../utils/auditLog.util.js';

const AI_REDACTION_URL = 'http://localhost:8080/api/ai/redactionService';
const AI_ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const bucketName = process.env.MINIO_BUCKET || process.env.S3_BUCKET || 'sakshyasetu-evidence';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT,
  forcePathStyle: Boolean(process.env.MINIO_ENDPOINT),
  credentials: process.env.S3_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const redaction = async (fileBuffer, originalName, mimetype, docId, caseId) => {
  try {
    const form = new FormData();
    form.append('docId', docId);
    form.append('file', fileBuffer, {
      filename: originalName,
      contentType: mimetype,
    });

    const response = await axios.post(AI_REDACTION_URL, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxBodyLength: Infinity,
    });

    const redactedFileBuffer = Buffer.from(response.data.redactedFileBase64, 'base64');
    const redactedFileKey = `redacted/${caseId}/${docId}_redacted${path.extname(originalName) || '.bin'}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: redactedFileKey,
      Body: redactedFileBuffer,
      ContentType: mimetype,
    }));

    return await prisma.$transaction(async (tx) => {
      const document = await tx.documents.update({
        where: { id: docId },
        data: {
          redactedFilePath: redactedFileKey,
          extractedText: response.data.extractedText,
          status: 'REDACTED',
        },
      });

      await appendAuditLog('REDACT', docId, AI_ACTOR_ID, tx);
      return document;
    });
  } catch (error) {
    console.error('Redaction failed:', error);

    await prisma.documents.update({
      where: { id: docId },
      data: { status: 'FAILED' },
    });

    throw error;
  }
};

const mockRedaction = async (filePath, docId) => {
  try {
    console.log(`[MOCK] Simulating AI for document ${docId}...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await prisma.documents.update({
      where: { id: docId },
      data: {
        extractedText: 'FIR Report: Suspect apprehended near Ayodhya Bypass with a stolen Glock 19. Case registered under IPC 302.',
        redactedFilePath: filePath,
        status: 'REDACTED',
      },
    });

    console.log(`[MOCK] Document ${docId} processed successfully.`);
  } catch (error) {
    console.error('[MOCK] Failed:', error);
    await prisma.documents.update({
      where: { id: docId },
      data: { status: 'FAILED' },
    });
    throw error;
  }
};

export { mockRedaction, redaction };
