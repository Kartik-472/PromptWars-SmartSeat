
import { Router } from "express";
import crypto from "node:crypto";
import db from "../database/db.js";
import { authenticate, adminOnly } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

const bookingSchema = z.object({
    seatId: z.number().int().positive(),
    startTime: z.string().datetime({ offset: true }),
    endTime: z.string().datetime({ offset: true })
});

router.post("/", authenticate, (req, res) => {
    const parsed = bookingSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid booking details"
        });
    }

    const { seatId, startTime, endTime } = parsed.data;
    const start = Date.parse(startTime);
    const end = Date.parse(endTime);
    const now = Date.now();

    if (start <= now || end <= start) {
        return res.status(400).json({
            error: "Booking must be in the future"
        });
    }

    const duration = end - start;

    if (duration > 4 * 60 * 60 * 1000) {
        return res.status(400).json({
            error: "Maximum booking duration is 4 hours"
        });
    }

    if (start - now > 7 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({
            error: "Bookings can only be made 7 days in advance"
        });
    }

    const seat = db.prepare(`
    SELECT id FROM seats WHERE id = ? AND active = 1
  `).get(seatId);

    if (!seat) {
        return res.status(404).json({
            error: "Seat not found"
        });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256")
        .update(token)
        .digest("hex");

    try {
        const createBooking = db.transaction(() => {
            const activeCount = db.prepare(`
        SELECT COUNT(*) AS count FROM bookings
        WHERE user_id = ?
          AND status IN ('reserved', 'checked_in')
          AND end_time > ?
      `).get(req.user.id, new Date().toISOString()).count;

            if (activeCount >= 2) {
                throw new Error("ACTIVE_BOOKING_LIMIT");
            }

            const overlap = db.prepare(`
        SELECT id FROM bookings
        WHERE seat_id = ?
          AND status IN ('reserved', 'checked_in')
          AND start_time < ?
          AND end_time > ?
      `).get(seatId, endTime, startTime);

            if (overlap) {
                throw new Error("SEAT_UNAVAILABLE");
            }

            const result = db.prepare(`
        INSERT INTO bookings
          (user_id, seat_id, start_time, end_time, checkin_token_hash)
        VALUES (?, ?, ?, ?, ?)
      `).run(
                req.user.id,
                seatId,
                startTime,
                endTime,
                tokenHash
            );

            return Number(result.lastInsertRowid);
        });

        const bookingId = createBooking();

        res.status(201).json({
            message: "Seat reserved successfully",
            bookingId,
            checkinToken: token
        });
    } catch (error) {
        if (error.message === "SEAT_UNAVAILABLE") {
            return res.status(409).json({
                error: "This seat has already been reserved"
            });
        }

        if (error.message === "ACTIVE_BOOKING_LIMIT") {
            return res.status(409).json({
                error: "You already have two active bookings"
            });
        }

        throw error;
    }
});

router.get("/mine", authenticate, (req, res) => {
    const bookings = db.prepare(`
    SELECT b.id, b.start_time, b.end_time, b.status,
      s.seat_number, s.seat_type,
      z.name AS zone_name, z.floor
    FROM bookings b
    JOIN seats s ON s.id = b.seat_id
    JOIN zones z ON z.id = s.zone_id
    WHERE b.user_id = ?
    ORDER BY b.start_time DESC
  `).all(req.user.id);

    res.json({ bookings });
});

router.post("/:id/checkin", authenticate, (req, res) => {
    const parsed = z.object({
        token: z.string().length(64)
    }).safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid check-in token"
        });
    }

    const booking = db.prepare(`
    SELECT * FROM bookings
    WHERE id = ? AND user_id = ?
  `).get(Number(req.params.id), req.user.id);

    if (!booking) {
        return res.status(404).json({
            error: "Booking not found"
        });
    }

    if (booking.status !== "reserved") {
        return res.status(409).json({
            error: "Booking cannot be checked in"
        });
    }

    const now = Date.now();
    const start = Date.parse(booking.start_time);
    const end = Date.parse(booking.end_time);

    if (now < start - 15 * 60 * 1000 || now > start + 15 * 60 * 1000 || now >= end) {
        return res.status(400).json({
            error: "Check-in is allowed only within 15 minutes of the start time"
        });
    }

    const tokenHash = crypto.createHash("sha256")
        .update(parsed.data.token)
        .digest("hex");

    const storedHash = booking.checkin_token_hash;

    if (!storedHash || storedHash.length !== tokenHash.length) {
        return res.status(403).json({
            error: "Invalid or expired check-in token"
        });
    }

    const valid = crypto.timingSafeEqual(
        Buffer.from(tokenHash, "hex"),
        Buffer.from(storedHash, "hex")
    );

    if (!valid) {
        return res.status(403).json({
            error: "Invalid check-in token"
        });
    }

    db.prepare(`
    UPDATE bookings SET status = 'checked_in',
      checkin_token_hash = NULL
    WHERE id = ? AND status = 'reserved'
  `).run(booking.id);

    res.json({ message: "Check-in successful" });
});

router.post("/:id/cancel", authenticate, (req, res) => {
    const result = db.prepare(`
    UPDATE bookings
    SET status = 'cancelled', checkin_token_hash = NULL
    WHERE id = ? AND user_id = ? AND status = 'reserved'
  `).run(Number(req.params.id), req.user.id);

    if (!result.changes) {
        return res.status(404).json({
            error: "Active cancellable booking not found"
        });
    }

    res.json({ message: "Booking cancelled" });
});

router.get("/admin/overview", authenticate, adminOnly, (req, res) => {
    const overview = db.prepare(`
    SELECT
      COUNT(*) AS total_seats,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_seats
    FROM seats
  `).get();

    const today = db.prepare(`
    SELECT
      COUNT(*) AS reservations,
      SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) AS checked_in
    FROM bookings
    WHERE date(start_time) = date('now')
      AND status IN ('reserved', 'checked_in')
  `).get();

    res.json({ overview, today });
});


router.post("/:id/checkout", authenticate, (req, res) => {
    const result = db.prepare(`
    UPDATE bookings
    SET status = 'completed',
        checkin_token_hash = NULL
    WHERE id = ?
      AND user_id = ?
      AND status = 'checked_in'
  `).run(Number(req.params.id), req.user.id);

    if (!result.changes) {
        return res.status(404).json({
            error: "Checked-in booking not found"
        });
    }

    res.json({
        message: "Seat released successfully"
    });
});


export default router;
