import crypto from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../config/db.js';
import httpError from '../utils/httpError.util.js';
import appendAuditLog from '../utils/auditLog.util.js';
import extractDeviceFingerprint from '../utils/telemetry.js';
import formatSection63Certificate from '../utils/bsaCertificate.js';
import {redaction} from '../services/aiBridge.js'
import { anchorRootHash } from '../utils/nicAnchor.js';


const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

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

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const assertDocumentCaseAccess = async (req, caseId) => {
  const hasGlobalAccess = ['ADMIN', 'FORENSIC_EXPERT'].includes(req.user.role);

  if (hasGlobalAccess) {
    return;
  }

  const caseAccess = await prisma.cases.findFirst({
    where: {
      id: caseId,
      OR: [
        { leadInvestigator: req.user.id },
        { assignedOfficers: { some: { id: req.user.id } } }
      ]
    },
    select: { id: true },
  });

  if (!caseAccess) {
    throw httpError(403, 'Access Denied: You are not assigned to this case.');
  }
};

const getPresignedUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    ResponseContentDisposition: 'inline', // Critical for preventing downloads
  });

  return getSignedUrl(s3Client, command, { expiresIn: 900 });
};

export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw httpError(400, 'File is required');
  }

  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(req.file.mimetype)) {
    throw httpError(415, 'Unsupported media type');
  }

  const { title, type } = req.body ?? {};
  const { caseId } = req.params;

  if (!title || !type || !caseId) {
    throw httpError(400, 'caseId, title, and type are required');
  }

  const caseRecord = await prisma.cases.findFirst({
    where: {
      id: caseId,
      OR: [
        { leadInvestigator: req.user.id },
        { assignedOfficers: { some: { id: req.user.id } } }
      ]
    }
  });

  if (!caseRecord) {
    throw httpError(404, 'Case not found or You are not an Assigned Officer to this case');
  }

  const fileHash = crypto
    .createHash('sha256')
    .update(req.file.buffer)
    .digest('hex');
  const documentId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const fileExtension = req.file.originalname.includes('.')
    ? req.file.originalname.slice(req.file.originalname.lastIndexOf('.'))
    : '';
  const originalFilePath = `original/${caseId}/${documentId}${fileExtension}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: originalFilePath,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  }));

  const document = await prisma.$transaction(async (tx) => {
    const doc = await tx.documents.create({
      data: {
        id: documentId,
        caseId,
        uploaderId: req.user.id,
        title,
        type,
        originalFilePath,
        fileHash,
        idempotencyKey,
        status: 'PENDING_REDACTION',
      },
    });

    await appendAuditLog('UPLOAD', doc.id, req.user.id, tx);

    return doc;
  });

  await anchorRootHash();

  redaction(req.file.buffer, req.file.originalname, req.file.mimetype, document.id, caseId)
    .catch((error) => {
      console.error('Background redaction failed:', error)
    });

  return res.status(201).json({ document });
});

export const getDocument = asyncHandler(async (req, res) => {
  const { documentId, caseId } = req.params;

  const document = await prisma.documents.findFirst({
    where: { id: documentId, caseId },
  });

  if (!document) {
    throw httpError(404, 'Document not found');
  }

  await assertDocumentCaseAccess(req, caseId);

  const canViewOriginal = ['INVESTIGATOR', 'ADMIN', 'FORENSIC_EXPERT'].includes(req.user.role);
  if (!canViewOriginal && document.status !== 'REDACTED') {
    throw httpError(423, 'Evidence is currently undergoing AI redaction. Please try again shortly.');
  }

  await appendAuditLog('VIEW', document.id, req.user.id);
  await anchorRootHash();

  const filePath = canViewOriginal
      ? document.originalFilePath
      : document.status === 'REDACTED'
          ? document.redactedFilePath
          : null;

  return res.status(200).json({
    document: {
      id: document.id,
      caseId: document.caseId,
      title: document.title,
      type: document.type,
      status: document.status,
      fileHash: document.fileHash,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      fileUrl: filePath ? await getPresignedUrl(filePath) : null,
    },
    viewerTelemetry: extractDeviceFingerprint(req),
  });
});

export const getBsaCertificate = asyncHandler(async (req, res) => {
  const { documentId, caseId } = req.params;
  const document = await prisma.documents.findFirst({
    where: { id: documentId, caseId },
  });

  if (!document) {
    throw httpError(404, 'Document not found');
  }

  await assertDocumentCaseAccess(req, caseId);

  const caseData = await prisma.cases.findUnique({
    where: { id: caseId },
  });
  const officerData = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, role: true },
  });

  await appendAuditLog('GENERATE_BSA_CERT', document.id, req.user.id);
  await anchorRootHash();

  const certificate = formatSection63Certificate(
    caseData,
    {
      ...document,
      originalFileName: document.originalFilePath?.split('/').pop(),
    },
    officerData,
    extractDeviceFingerprint(req),
  );

  return res.status(200).json(certificate);
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const { documentId, caseId } = req.params;
  const document = await prisma.documents.findFirst({
    where: { id: documentId, caseId },
    select: { id: true },
  });

  if (!document) {
    throw httpError(404, 'Document not found');
  }

  await assertDocumentCaseAccess(req, caseId);

  const logs = await prisma.audit_Logs.findMany({
    where: { documentId },
    orderBy: [{ timeStamp: 'asc' }, { id: 'asc' }],
    include: {
      user: {
        select: {
          email: true,
          role: true,
        },
      },
    },
  });

  return res.status(200).json(logs.map((log) => ({
    id: log.id,
    action: log.action,
    documentId: log.documentId,
    previousHash: log.previousHash,
    currentHash: log.currentHash,
    timestamp: log.timeStamp,
    officer: log.user
      ? { name: log.user.email, role: log.user.role }
      : null,
  })));
});

export const verifyDocumentIntegrity = asyncHandler(async (req, res) => {
  const { documentId, caseId } = req.params;
  const document = await prisma.documents.findFirst({
    where: { id: documentId, caseId },
    select: {
      id: true,
      caseId: true,
      originalFilePath: true,
      fileHash: true,
    },
  });

  if (!document) {
    throw httpError(404, 'Document not found');
  }

  await assertDocumentCaseAccess(req, caseId);

  const storageResponse = await s3Client.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: document.originalFilePath,
  }));

  if (!storageResponse.Body || typeof storageResponse.Body.transformToByteArray !== 'function') {
    throw httpError(500, 'Unable to read the original document from storage');
  }

  const actualFileHash = crypto
    .createHash('sha256')
    .update(Buffer.from(await storageResponse.Body.transformToByteArray()))
    .digest('hex');
  const fileIntegrity = actualFileHash === document.fileHash;

  const auditLogs = await prisma.audit_Logs.findMany({
    where: { documentId },
    orderBy: [{ timeStamp: 'asc' }, { id: 'asc' }],
    select: {
      action: true,
      documentId: true,
      userId: true,
      previousHash: true,
      currentHash: true,
      timeStamp: true,
    },
  });

  let previousHash = GENESIS_HASH;
  let auditChainValid = true;

  for (const log of auditLogs) {
    const expectedPayload = {
      action: log.action,
      documentId: log.documentId,
      userId: log.userId,
      timeStamp: log.timeStamp.toISOString(),
    };
    const expectedHash = crypto
      .createHash('sha256')
      .update(`${previousHash}${JSON.stringify(expectedPayload)}`, 'utf8')
      .digest('hex');

    if (log.previousHash !== previousHash || log.currentHash !== expectedHash) {
      auditChainValid = false;
      break;
    }

    previousHash = log.currentHash;
  }

  return res.status(200).json({
    fileIntegrity,
    auditChainValid,
    expectedFileHash: document.fileHash,
    actualFileHash,
    totalAuditEventsVerified: auditLogs.length,
    tamperDetected: !fileIntegrity || !auditChainValid,
  });
});

export const retryRedaction = asyncHandler(async (req, res) => {
  const { documentId, caseId } = req.params;

  const document = await prisma.documents.findFirst({
    where: {
      id: documentId,
      caseId,
    },
  });

  if (!document) {
    throw httpError(404, 'Document not found');
  }

  if (document.status === 'REDACTED') {
    throw httpError(400, 'Document is already redacted and cannot be retried');
  }

  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: document.originalFilePath,
  }));

  if (!response.Body || typeof response.Body.transformToByteArray !== 'function') {
    throw httpError(500, 'Unable to read the original document from storage');
  }

  const fileBuffer = Buffer.from(await response.Body.transformToByteArray());

  const updatedDocument = await prisma.documents.update({
    where: { id: document.id },
    data: {
      status: 'PENDING_REDACTION',
    },
  });

  await appendAuditLog('RETRY_REDACT', document.id, req.user.id);
  await anchorRootHash();

  // 1. Reconstruct filename so the Python server knows what parser to use
  const fileExtension = document.originalFilePath.includes('.')
      ? document.originalFilePath.slice(document.originalFilePath.lastIndexOf('.'))
      : '';
  const reconstructedFileName = `${document.title}${fileExtension}`;

  // 2. Derive exact MIME type for the Python FormData
  let mimeType = 'application/octet-stream';
  const extLower = fileExtension.toLowerCase();
  if (extLower === '.pdf') mimeType = 'application/pdf';
  if (extLower === '.jpg' || extLower === '.jpeg') mimeType = 'image/jpeg';
  if (extLower === '.png') mimeType = 'image/png';

  // Trigger AI Worker
  redaction(
      fileBuffer,
      reconstructedFileName,
      mimeType,
      document.id,
      document.caseId,
  ).catch((error) => {
    console.error('Background redaction retry failed:', error)
  });

  return res.status(200).json({
    message: 'Document redaction retry started successfully',
    document: updatedDocument,
  });
});

export const getAllDocuments = asyncHandler(async (req, res) => {

  const {caseId} = req.params;
  await assertDocumentCaseAccess(req, caseId);

  const documents = await prisma.documents.findMany({
    where: { caseId: req.params.caseId },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json({ documents });
});

export const searchDocuments = asyncHandler(async (req, res) => {
  const rawQuery = req.query?.q;
  const caseId = req.params?.caseId;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const searchTerms = (typeof rawQuery === 'string' ? rawQuery : '')
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!searchTerms.length) {
    throw httpError(400, 'A valid search query is required');
  }

  const searchQuery = searchTerms.join(' & ');
  const isGlobalSearch = ['ADMIN', 'FORENSIC_EXPERT'].includes(userRole);
  const where = {
    OR: [
      { extractedText: { search: searchQuery } },
      { title: { search: searchQuery } },
      { documentReference: { search: searchQuery } },
    ],
  };

  if (caseId) {
    where.caseId = caseId;
  }

  if (!isGlobalSearch) {
    if (!userId) {
      throw httpError(403, 'Authenticated user identity is required');
    }

    where.case = {
      OR: [
        { leadInvestigator: userId },
        { assignedOfficers: { some: { id: userId } } },
      ],
    };
  }

  const documents = await prisma.documents.findMany({
    where,
    orderBy: [
      {
        _relevance: {
          fields: ['extractedText', 'title'],
          search: searchQuery,
          sort: 'desc',
        },
      },
      { createdAt: 'desc' },
    ],
    take: 50,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      createdAt: true,
      case: {
        select: {
          id: true,
          caseNumber: true,
          title: true,
        },
      },
    },
  });

  return res.status(200).json({ documents });
});

export const getDocumentById = getDocument;

export default uploadDocument;