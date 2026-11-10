
import jwt from "jsonwebtoken";
import db from "../database/db.js";

export function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    try {
        const token = header.slice(7);

        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE id = ?
    `).get(payload.id);

        if (!user) {
            return res.status(401).json({
                error: "Account not found"
            });
        }

        req.user = user;
        next();
    } catch {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}

export function adminOnly(req, res, next) {
    if (req.user?.role !== "admin") {
        return res.status(403).json({
            error: "Administrator access required"
        });
    }

    next();
}
