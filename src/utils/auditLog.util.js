import crypto from 'node:crypto';
import prisma from '../config/db.js';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const appendAuditLog = async (action, documentId, userId, tx = prisma) => {
  const previousAudit = await tx.audit_Logs.findFirst({
    orderBy: [{ timeStamp: 'desc' }, { id: 'desc' }],
    select: { currentHash: true },
  });

  const previousHash = previousAudit?.currentHash ?? GENESIS_HASH;
  const timeStamp = new Date();
  const payload = {
    action,
    documentId,
    userId,
    timeStamp: timeStamp.toISOString(),
  };
  const serializedPayload = JSON.stringify(payload);
  const currentHash = crypto
    .createHash('sha256')
    .update(`${previousHash}${serializedPayload}`, 'utf8')
    .digest('hex');

  return tx.audit_Logs.create({
    data: {
      documentId,
      userId,
      previousHash,
      currentHash,
      action,
      timeStamp,
    },
  });
};

export default appendAuditLog;
export { appendAuditLog };
