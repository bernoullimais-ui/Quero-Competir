import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
  role: "super_admin" | "organizer" | "institution" | "guardian" | "venue";
  name: string;
  referenceId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Middleware que exige autenticação via JWT.
 * Extrai o token do header Authorization: Bearer <token>
 * e injeta req.user com os dados do usuário autenticado.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação não fornecido." });
  }

  const token = authHeader.substring(7);

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    }
    return res.status(401).json({ error: "Token inválido ou corrompido." });
  }
}

/**
 * Middleware que exige uma role específica.
 * Deve ser usado APÓS requireAuth.
 */
export function requireRole(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permissão insuficiente para esta operação." });
    }
    next();
  };
}

/**
 * Gera um JWT assinado para um usuário autenticado.
 */
export function generateToken(user: AuthUser): string {
  const secret = getJwtSecret();
  return jwt.sign(user, secret, { expiresIn: "7d" });
}

/**
 * Middleware opcional de autenticação via JWT.
 * Tenta extrair o token do header se presente, mas não falha caso não fornecido.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = decoded;
  } catch (err) {
    // Ignora erros para autenticação opcional
  }
  next();
}
