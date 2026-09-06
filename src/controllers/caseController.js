import crypto from 'node:crypto';
import prisma from '../config/db.js';
import httpError from '../utils/httpError.util.js'

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const supervisoryRanks = new Set(['DSP', 'SP']);

const getCaseAccessFilter = (user) => {
  const jurisdiction = {
    state: user.state,
    district: user.district,
    policeStation: user.policeStation,
  };

  if (supervisoryRanks.has(user.rank) || user.isSHO === true) {
    return jurisdiction;
  }

  return {
    AND: [
      jurisdiction,
      {
        OR: [
          { leadInvestigator: user.id },
          { assignedOfficers: { some: { id: user.id } } },
        ],
      },
    ],
  };
};

const assignedOfficerSelect = {
  id: true,
  email: true,
  role: true,
  rank: true,
  isSHO: true,
  department: true,
  state: true,
  district: true,
  policeStation: true,
};

export const createCase = asyncHandler(async (req, res) => {
  const { title, description } = req.body ?? {};

  if (!title) {
    throw httpError(400, 'title is required');
  }

  const createdCase = await prisma.cases.create({
    data: {
      caseNumber: `CAS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      title,
      description,
      state: req.user.state,
      district: req.user.district,
      policeStation: req.user.policeStation,
      leadInvestigator: req.user.id,
      status: 'OPEN',
    },
  });

  return res.status(201).json(createdCase);
});

export const getCases = asyncHandler(async (req, res) => {
  const cases = await prisma.cases.findMany({
    where: getCaseAccessFilter(req.user),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      caseNumber: true,
      title: true,
      status: true,
      policeStation: true,
    },
  });

  return res.status(200).json({ cases });
});

export const getCaseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const foundCase = await prisma.cases.findUnique({
    where: { id },
    include: {
      documents: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
      },
      assignedOfficers: {
        select: assignedOfficerSelect,
      },
    },
  });

  if (!foundCase) {
    throw httpError(404, 'Case not found');
  }

  const accessFilter = getCaseAccessFilter(req.user);
  const hasAccess = await prisma.cases.findFirst({
    where: {
      AND: [
        { id },
        accessFilter,
      ],
    },
    select: { id: true },
  });

  if (!hasAccess) {
    throw httpError(403, 'Jurisdiction boundary crossed');
  }

  return res.status(200).json(foundCase);
});

export const assignOfficerToCase = asyncHandler(async (req, res) => {
  const { caseId, officerId } = req.params;
  const targetCase = await prisma.cases.findUnique({
    where: { id: caseId },
  });

  if (!targetCase) {
    throw httpError(404, 'Case not found');
  }

  const canAssign =
    targetCase.leadInvestigator === req.user.id ||
    (req.user.isSHO === true && req.user.policeStation === targetCase.policeStation);

  if (!canAssign) {
    throw httpError(403, 'Not authorized to assign officers to this case');
  }

  const officer = await prisma.user.findUnique({
    where: { id: officerId },
  });

  if (!officer) {
    throw httpError(404, 'Officer not found');
  }

  if (officer.district !== targetCase.district) {
    throw httpError(403, 'Officer must belong to the same district');
  }

  const updatedCase = await prisma.cases.update({
    where: { id: caseId },
    data: {
      assignedOfficers: {
        connect: { id: officerId },
      },
    },
    include: {
      assignedOfficers: {
        select: assignedOfficerSelect,
      },
    },
  });

  return res.status(200).json(updatedCase);
});

export const getAllCases = getCases;
