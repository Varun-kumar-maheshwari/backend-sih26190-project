import prisma from '../config/db.js';

const requireCaseJurisdiction = (caseParam = 'caseId') => {
  return async (req, res, next) => {
    try {
      // 1. Admins and Forensic Experts bypass local jurisdiction checks
      if (['ADMIN', 'FORENSIC_EXPERT'].includes(req.user?.role)) {
        return next();
      }

      const caseId = req.params?.[caseParam];

      if (!caseId) {
        return res.status(400).json({ message: 'Case ID is required' });
      }

      const caseRecord = await prisma.cases.findUnique({
        where: { id: caseId },
        select: {
          state: true,
          district: true,
          policeStation: true,
        },
      });

      if (!caseRecord) {
        return res.status(404).json({ message: 'Case not found' });
      }

      // 2. Supervisory ranks check district level; local officers check station level
      const isSupervisoryOfficer = ['DSP', 'SP'].includes(req.user?.rank);
      const sameJurisdiction = isSupervisoryOfficer
          ? req.user?.state === caseRecord.state && req.user?.district === caseRecord.district
          : req.user?.state === caseRecord.state &&
          req.user?.district === caseRecord.district &&
          req.user?.policeStation === caseRecord.policeStation;

      if (!sameJurisdiction) {
        return res.status(403).json({ message: 'Jurisdiction boundary crossed' });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export default requireCaseJurisdiction;
export { requireCaseJurisdiction };