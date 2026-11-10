
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DB_PATH || "./smartseat.db";

if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), {
        recursive: true
    });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student'
      CHECK(role IN ('student', 'admin')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    floor TEXT NOT NULL,
    description TEXT DEFAULT '',
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER NOT NULL,
    seat_number TEXT NOT NULL,
    seat_type TEXT DEFAULT 'standard',
    active INTEGER DEFAULT 1,
    UNIQUE(zone_id, seat_number),
    FOREIGN KEY(zone_id) REFERENCES zones(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'reserved'
      CHECK(status IN ('reserved', 'checked_in', 'completed', 'cancelled', 'no_show')),
    checkin_token_hash TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(seat_id) REFERENCES seats(id),
    CHECK(start_time < end_time)
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_seat_time
  ON bookings(seat_id, start_time, end_time);

  CREATE INDEX IF NOT EXISTS idx_bookings_user
  ON bookings(user_id, status);

  CREATE INDEX IF NOT EXISTS idx_seats_zone
  ON seats(zone_id);
`);

// Seed sample library data only when no zones exist.
const zoneCount = db.prepare(
    "SELECT COUNT(*) AS count FROM zones"
).get().count;

if (zoneCount === 0) {
    const addZone = db.prepare(`
    INSERT INTO zones (name, floor, description)
    VALUES (?, ?, ?)
  `);

    const addSeat = db.prepare(`
    INSERT INTO seats (zone_id, seat_number, seat_type)
    VALUES (?, ?, ?)
  `);

    const seed = db.transaction(() => {
        const zones = [
            ["Quiet Study Area", "Ground Floor", "Silent individual study"],
            ["General Reading Area", "First Floor", "General reading and study"],
            ["Digital Study Area", "Second Floor", "Study desks with power access"]
        ];

        zones.forEach((zone, index) => {
            const result = addZone.run(...zone);
            const zoneId = Number(result.lastInsertRowid);

            for (let i = 1; i <= 12; i++) {
                addSeat.run(
                    zoneId,
                    `S${String(i).padStart(2, "0")}`,
                    index === 2 ? "computer" : "standard"
                );
            }
        });
    });

    seed();
}

export default db;
