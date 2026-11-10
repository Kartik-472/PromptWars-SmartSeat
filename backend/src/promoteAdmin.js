
import "dotenv/config";
import db from "./database/db.js";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
    console.error(
        "Usage: npm run promote-admin -- email@example.com"
    );
    process.exit(1);
}

const result = db.prepare(`
  UPDATE users
  SET role = 'admin'
  WHERE email = ?
`).run(email);

if (result.changes === 0) {
    console.error("No account found with that email.");
    process.exit(1);
}

console.log(`Administrator role granted to ${email}`);
