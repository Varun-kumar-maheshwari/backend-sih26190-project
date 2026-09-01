const requireDepartment = (allowedDepartment) => {
  return (req, res, next) => {
    const isAdmin = req.user?.role === 'ADMIN';
    const isAllowedDepartment = req.user?.department === allowedDepartment;

    if (!req.user || !isAdmin || !isAllowedDepartment) {
      return res.status(403).json({
        error: `Access denied. Requires Admin clearance in ${allowedDepartment}`,
      });
    }

    return next();
  };
};

export default requireDepartment;
