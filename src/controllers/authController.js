import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import httpError from '../utils/httpError.util.js'

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const isProduction = false;

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction?'strict':'lax',
  maxAge: REFRESH_COOKIE_MAX_AGE,
};

const accessTokenPayload = (user) => ({
  id: user.id,
  role: user.role,
  rank: user.rank,
  isSHO: user.isSHO,
  department: user.department,
  state: user.state,
  district: user.district,
  policeStation: user.policeStation,
});

export const registerStaff = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    rank,
    isSHO,
    department,
    state,
    district,
    policeStation,
  } = req.body ?? {};

  if (
    !name ||
    !email ||
    !password ||
    !role ||
    !rank ||
    typeof isSHO !== 'boolean' ||
    !department ||
    !state ||
    !district ||
    !policeStation
  ) {
    throw httpError(400, 'All user and jurisdiction fields are required');
  }

  // 1. Only Admins or SHOs are allowed to register new staff
  if (req.user.role !== 'ADMIN' && !req.user.isSHO) {
    throw httpError(403, 'Access Denied: Only Administrators or SHOs can register staff.');
  }

  // 2. Nobody can create an ADMIN via the API (must be done via DB seed)
  if (role === 'ADMIN') {
    throw httpError(403, 'Security Violation: Cannot provision ADMIN accounts via the API.');
  }

  // 3. Only an ADMIN can create another SHO
  if (isSHO && req.user.role !== 'ADMIN') {
    throw httpError(403, 'Security Violation: Only Administrators can provision an SHO.');
  }

  // --- END PRIVILEGE ESCALATION GUARDS ---

  if (req.user.state !== state || req.user.district !== district) {
    throw httpError(
        403,
        `Cross-jurisdiction provisioning denied. You can only create users for ${req.user.district}, ${req.user.state}.`
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw httpError(409, 'A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      rank,
      isSHO,
      department,
      state,
      district,
      policeStation,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      rank: true,
      isSHO: true,
      department: true,
      state: true,
      district: true,
      policeStation: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.status(201).json(createdUser);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    throw httpError(400, 'Email and password are required');
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    throw httpError(401, 'Invalid credentials');
  }

  const accessToken = jwt.sign(accessTokenPayload(user), process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(
    { tokenId: crypto.randomBytes(32).toString('hex'), userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  res.cookie('refreshToken', refreshToken, refreshCookieOptions);

  return res.status(200).json({
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rank: user.rank,
      isSHO: user.isSHO,
      department: user.department,
      state: user.state,
      district: user.district,
      policeStation: user.policeStation,
    },
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { targetUserId, userId } = req.params;
  const { newPassword } = req.body ?? {};
  const targetId = targetUserId ?? userId;

  if (!targetId || !newPassword || newPassword.length < 6) {
    throw httpError(400, 'A target user and a password of at least 6 characters are required');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
  });

  if (!targetUser) {
    throw httpError(404, 'User not found');
  }

  if (
    req.user.state !== targetUser.state ||
    req.user.district !== targetUser.district
  ) {
    throw httpError(403, 'Cross-jurisdiction admin action denied');
  }

  if (targetUser.rank === 'DSP' || targetUser.rank === 'SP') {
    throw httpError(403, 'Cannot reset supervisory officer credentials');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: targetId },
    data: {
      passwordHash,
      refreshToken: null,
    },
  });

  return res.status(200).json({
    message: 'User password reset successfully and active sessions revoked.',
  });
});

export const refreshSession = asyncHandler(async (req, res) => {
  const currentRefreshToken = req.cookies?.refreshToken;

  if (!currentRefreshToken) {
    throw httpError(401, 'Refresh token missing');
  }

  let decoded;
  try {
    decoded = jwt.verify(currentRefreshToken, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, 'Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user || !user.isActive) {
    throw httpError(401, 'Invalid refresh token');
  }

  const newRefreshToken = jwt.sign(
    { tokenId: crypto.randomBytes(32).toString('hex'), userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
  const newAccessToken = jwt.sign(accessTokenPayload(user), process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken },
  });

  res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

  return res.status(200).json({
    accessToken: newAccessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rank: user.rank,
      isSHO: user.isSHO,
      department: user.department,
      state: user.state,
      district: user.district,
      policeStation: user.policeStation,
    },
  });
});

export const refreshToken = refreshSession;

export const logout = asyncHandler(async (req, res) => {
  const currentRefreshToken = req.cookies?.refreshToken;

  if (currentRefreshToken) {
    await prisma.user.updateMany({
      where: { refreshToken: currentRefreshToken },
      data: { refreshToken: null },
    });
  }

  res.clearCookie('refreshToken', refreshCookieOptions);
  return res.status(200).json({ message: 'Logged out successfully' });
});

export default login;
