
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import libraryRoutes from "./routes/library.js";
import bookingRoutes from "./routes/bookings.js";

import "./database/db.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
}

const app = express();

app.use(helmet());

const allowedOrigins = [
    "http://localhost:5173",
    "https://prompt-wars-smart-seat-five.vercel.app"
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));

app.use(express.json({ limit: "50kb" }));

app.use("/api/auth", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false
}));

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "SmartSeat TIET API is running"
    });
});

app.get("/api/health", (req, res) => {
    res.json({ status: "healthy" });
});

app.use("/api/auth", authRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/bookings", bookingRoutes);

app.use((req, res) => {
    res.status(404).json({
        error: "Endpoint not found"
    });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        error: "Internal server error"
    });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log(`SmartSeat TIET running on port ${PORT}`);
    });
}

export default app;
