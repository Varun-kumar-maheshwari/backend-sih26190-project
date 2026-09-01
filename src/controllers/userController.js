import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';

export const registerStaff = async (req, res) => {
  const { email, password, role, department } = req.body;

  if (!email || !password || !role || !department) {
    return res.status(400).json({
      message: 'email, password, role, and department are required',
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.status(409).json({ message: 'A user with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const createdUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      department,
    },
    select: {
      id: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.status(201).json(createdUser);
};

export const adminResetUserPassword = async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      message: 'newPassword is required and must be at least 6 characters long',
    });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      refreshToken: null,
    },
  });

  return res.status(200).json({
    message: 'User password reset successfully and active sessions revoked.',
  });
};
