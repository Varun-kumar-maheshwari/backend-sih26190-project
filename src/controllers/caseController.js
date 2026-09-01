import prisma from '../config/db.js';

export const createCase = async (req, res) => {
  const { caseNumber, title, description } = req.body;

  if (!caseNumber || !title) {
    return res.status(400).json({
      message: 'caseNumber and title are required',
    });
  }

  try {
    const createdCase = await prisma.cases.create({
      data: {
        caseNumber,
        title,
        description,
        status: 'OPEN',
        leadInvestigator: req.user.id,
      },
    });

    return res.status(201).json(createdCase);
  } catch (error) {
    if (error?.code === 'P2002' && error?.meta?.target?.includes('caseNumber')) {
      return res.status(409).json({
        message: 'A case with this caseNumber already exists',
      });
    }

    throw error;
  }
};

export const getAllCases = async (req, res) => {
  const cases = await prisma.cases.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      user: {
        select: {
          email: true,
          department: true,
        },
      },
    },
  });

  return res.status(200).json({ cases });
};

export const getCaseById = async (req, res) => {
  const { id } = req.params;

  const foundCase = await prisma.cases.findUnique({
    where: { id },
    include: {
      user: true,
    },
  });

  if (!foundCase) {
    return res.status(404).json({ message: 'Case not found' });
  }

  return res.status(200).json(foundCase);
};
