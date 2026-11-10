
import { Router } from "express";
import db from "../database/db.js";
import { authenticate, adminOnly } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

router.get("/zones", authenticate, (req, res) => {
    const zones = db.prepare(`
    SELECT z.*,
      COUNT(s.id) AS total_seats
    FROM zones z
    LEFT JOIN seats s ON s.zone_id = z.id AND s.active = 1
    WHERE z.active = 1
    GROUP BY z.id
    ORDER BY z.id
  `).all();

    res.json({ zones });
});

router.get("/seats", authenticate, (req, res) => {
    const parsed = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start: z.string().datetime({ offset: true }),
        end: z.string().datetime({ offset: true }),
        zoneId: z.coerce.number().int().positive().optional()
    }).safeParse({
        date: req.query.date,
        start: req.query.start,
        end: req.query.end,
        zoneId: req.query.zoneId
    });

    if (!parsed.success) {
        return res.status(400).json({
            error: "Provide valid date, start, and end values"
        });
    }

    const { start, end, zoneId } = parsed.data;

    if (Date.parse(start) >= Date.parse(end)) {
        return res.status(400).json({
            error: "End time must be after start time"
        });
    }

    const seats = db.prepare(`
    SELECT
      s.id,
      s.seat_number,
      s.seat_type,
      z.id AS zone_id,
      z.name AS zone_name,
      z.floor,
      CASE WHEN EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.seat_id = s.id
          AND b.status IN ('reserved', 'checked_in')
          AND b.start_time < ?
          AND b.end_time > ?
      ) THEN 0 ELSE 1 END AS available
    FROM seats s
    JOIN zones z ON z.id = s.zone_id
    WHERE s.active = 1
      AND z.active = 1
      AND (? IS NULL OR z.id = ?)
    ORDER BY z.id, s.seat_number
  `).all(end, start, zoneId ?? null, zoneId ?? null);

    res.json({ seats });
});

router.post("/zones", authenticate, adminOnly, (req, res) => {
    const parsed = z.object({
        name: z.string().trim().min(2).max(80),
        floor: z.string().trim().min(1).max(40),
        description: z.string().max(300).optional()
    }).safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid zone details"
        });
    }

    const result = db.prepare(`
    INSERT INTO zones (name, floor, description)
    VALUES (?, ?, ?)
  `).run(
        parsed.data.name,
        parsed.data.floor,
        parsed.data.description || ""
    );

    res.status(201).json({
        zoneId: Number(result.lastInsertRowid)
    });
});

router.post("/seats", authenticate, adminOnly, (req, res) => {
    const parsed = z.object({
        zoneId: z.number().int().positive(),
        seatNumber: z.string().trim().min(1).max(20),
        seatType: z.enum(["standard", "computer", "accessible"])
    }).safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid seat details"
        });
    }

    try {
        const result = db.prepare(`
      INSERT INTO seats (zone_id, seat_number, seat_type)
      VALUES (?, ?, ?)
    `).run(
            parsed.data.zoneId,
            parsed.data.seatNumber,
            parsed.data.seatType
        );

        res.status(201).json({
            seatId: Number(result.lastInsertRowid)
        });
    } catch {
        res.status(409).json({
            error: "Seat already exists or zone is invalid"
        });
    }
});

export default router;
