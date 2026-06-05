import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "未登录或登录已失效",
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({
      message: "JWT_SECRET 未配置",
    });
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthUser;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({
      message: "登录已失效，请重新登录",
    });
  }
}
