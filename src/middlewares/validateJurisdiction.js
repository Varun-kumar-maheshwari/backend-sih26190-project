import jurisdictions from '../config/jurisdictions.js';

const validateJurisdiction = (req, res, next) => {
  const { state, district, policeStation } = req.body ?? {};

  const isValid = Boolean(
    state &&
      district &&
      policeStation &&
      jurisdictions[state] &&
      jurisdictions[state][district] &&
      jurisdictions[state][district].includes(policeStation)
  );

  if (!isValid) {
    return res.status(400).json({
      error: 'Invalid or incomplete jurisdiction',
    });
  }

  return next();
};

export default validateJurisdiction;
export { validateJurisdiction };
