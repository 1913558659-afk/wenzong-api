import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";

const router = Router();

function createToken(user: { id: string; email: string; role: string }) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    {
      expiresIn: "7d",
    }
  );
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "邮箱和密码不能为空",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "密码至少需要 6 位",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "该邮箱已经注册",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        nickname,
        stats: {
          create: {
            xp: 0,
            streakDays: 0,
            answeredToday: 0,
            correctCount: 0,
            totalAnswered: 0,
          },
        },
      },
      include: {
        stats: true,
      },
    });

    const token = createToken(user);

    return res.json({
      message: "注册成功",
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        stats: user.stats,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "注册失败",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "邮箱和密码不能为空",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        stats: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "邮箱或密码错误",
      });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return res.status(401).json({
        message: "邮箱或密码错误",
      });
    }

    const token = createToken(user);

    return res.json({
      message: "登录成功",
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        stats: user.stats,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "登录失败",
    });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const authUser = (req as any).user;

    const user = await prisma.user.findUnique({
      where: {
        id: authUser.id,
      },
      include: {
        stats: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "用户不存在",
      });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        stats: user.stats,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "获取用户信息失败",
    });
  }
});

export default router;
