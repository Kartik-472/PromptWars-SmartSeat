
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_that_is_long_enough_123456";
process.env.DB_PATH = ":memory:";

const { default: app } = await import("../src/server.js");
const { default: db } = await import("../src/database/db.js");

describe("SmartSeat API", () => {
    let token1;
    let token2;
    let seatId;

    beforeAll(async () => {
        const first = await request(app)
            .post("/api/auth/register")
            .send({
                name: "Aarav Sharma",
                email: "aarav@test.com",
                password: "AaravPassword123"
            });

        const second = await request(app)
            .post("/api/auth/register")
            .send({
                name: "Riya Verma",
                email: "riya@test.com",
                password: "RiyaPassword123"
            });

        token1 = first.body.token;
        token2 = second.body.token;

        const zone = db.prepare(`
      SELECT id FROM zones LIMIT 1
    `).get();

        seatId = Number(db.prepare(`
      SELECT id FROM seats WHERE zone_id = ? LIMIT 1
    `).get(zone.id).id);
    });

    it("should return healthy status", async () => {
        const response = await request(app).get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("healthy");
    });

    it("should reject unauthenticated seat access", async () => {
        const response = await request(app).get("/api/library/zones");

        expect(response.status).toBe(401);
    });

    it("should register users successfully", async () => {
        expect(token1).toBeTruthy();
        expect(token2).toBeTruthy();
    });

    it("should reject duplicate email registration", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({
                name: "Aarav Sharma",
                email: "aarav@test.com",
                password: "AaravPassword123"
            });

        expect(response.status).toBe(409);
    });

    it("should prevent two users from reserving the same seat", async () => {
        const start = new Date(Date.now() + 60 * 60 * 1000);
        const end = new Date(Date.now() + 2 * 60 * 60 * 1000);

        const booking = {
            seatId,
            startTime: start.toISOString(),
            endTime: end.toISOString()
        };

        const first = await request(app)
            .post("/api/bookings")
            .set("Authorization", `Bearer ${token1}`)
            .send(booking);

        const second = await request(app)
            .post("/api/bookings")
            .set("Authorization", `Bearer ${token2}`)
            .send(booking);

        expect(first.status).toBe(201);
        expect(second.status).toBe(409);
    });
});
