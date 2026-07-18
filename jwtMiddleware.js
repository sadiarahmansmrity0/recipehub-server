import jwt from 'jsonwebtoken';
import { getCollection } from './db.js';

export async function verifyToken(req, res, next) {
  console.log("========== VERIFY TOKEN ==========");
  console.log("Authorization Header:", req.headers.authorization);
  console.log("Cookies:", req.cookies);

  // Always use Authorization header first
  let token = null;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided."
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("Decoded User:", decoded);

    req.user = decoded;

    next();

  } catch (error) {
    console.error("VERIFY TOKEN ERROR:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
}

export function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access only" });
    }
    next();
  });
}

export async function getOptionalUser(req) {
 let token = null;

if (req.headers?.authorization?.startsWith("Bearer ")) {
  token = req.headers.authorization.split(" ")[1];
} else if (req.cookies?.token) {
  token = req.cookies.token;
}

if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usersCollection = getCollection('users');
    const user = await usersCollection.findOne({ email: decoded.email });
    
    if (!user || user.isBlocked) {
      return null;
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || 'user',
      isPremium: user.isPremium || false,
      image: user.image
    };
  } catch (error) {
    return null;
  }
}

