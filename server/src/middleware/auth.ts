import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { User } from "../models/User";
import { IUserPayload } from "../types";

// JWT payload interface for type checking
export interface JWTPayload {
  _id: string;
  userId: string;
  username: string;
  role: string;
  name?: string;
}

// Add user property to Express Request
declare global {
  namespace Express {
    interface Request {
      user?: IUserPayload;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("[AUTH DEBUG] Checking authorization header");
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log("[AUTH DEBUG] No authorization header found");
      return res.status(401).json({
        message: "Authentication required",
        details: "No authorization header",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.log("[AUTH DEBUG] Invalid authorization format");
      return res.status(401).json({
        message: "Authentication failed",
        details: "Invalid token format",
      });
    }

    const token = authHeader.split(" ")[1];
    console.log("[AUTH DEBUG] Token found in header");

    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    console.log("[AUTH DEBUG] Token verified successfully");

    // Verify user exists in database
    const user = await User.findById(decoded._id);
    if (!user) {
      console.log("[AUTH DEBUG] User not found in database");
      return res.status(401).json({
        message: "Authentication failed",
        details: "User not found",
      });
    }

    // Convert MongoDB ObjectId to string for consistent typing
    const userPayload: IUserPayload = {
      _id: decoded._id.toString(),
      userId: decoded.userId.toString(),
      username: decoded.username,
      role: decoded.role as "admin" | "staff",
      name: decoded.name,
    };

    // Attach user info to request
    req.user = userPayload;

    console.log(`[AUTH DEBUG] Attached user to request:`, {
      _id: req.user._id,
      role: req.user.role,
    });

    next();
  } catch (error) {
    console.error("[AUTH DEBUG] Auth middleware error:", error);

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        message: "Authentication failed",
        details: "Token has expired",
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        message: "Authentication failed",
        details: "Invalid token",
      });
    }

    return res.status(401).json({
      message: "Authentication failed",
      details: "Token verification failed",
    });
  }
};
