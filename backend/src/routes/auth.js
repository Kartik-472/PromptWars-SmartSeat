
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import db from "../database/db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

const credentialsSchema = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().email().max(254),
    password: z.string().min(10).max(72)
});

function createToken(user) {
    return jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
    );
}

router.post("/register", async (req, res) => {
    const parsed = credentialsSchema.extend({
        name: z.string().trim().min(2).max(80)
    }).safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid registration details"
        });
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    try {
        const hash = await bcrypt.hash(password, 12);

        const result = db.prepare(`
      INSERT INTO users (name, email, password)
      VALUES (?, ?, ?)
    `).run(name, normalizedEmail, hash);

        const user = db.prepare(`
      SELECT id, name, email, role
      FROM users WHERE id = ?
    `).get(Number(result.lastInsertRowid));

        res.status(201).json({
            token: createToken(user),
            user
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                error: "Email already registered"
            });
        }

        throw error;
    }
});

router.post("/login", async (req, res) => {
    const parsed = credentialsSchema
        .omit({ name: true })
        .safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid login details"
        });
    }

    const { email, password } = parsed.data;

    const user = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `).get(email.toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({
            error: "Invalid email or password"
        });
    }

    const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    };

    res.json({
        token: createToken(safeUser),
        user: safeUser
    });
});

router.get("/me", authenticate, (req, res) => {
    res.json({ user: req.user });
});

export default router;
