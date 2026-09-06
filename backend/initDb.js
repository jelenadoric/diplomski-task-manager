const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function initDatabase() {
    try {
        const sql = fs.readFileSync(
            path.join(__dirname, "../infra/init.sql"),
            "utf8"
        );

        await pool.query(sql);

        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Database initialization failed:", error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

initDatabase();