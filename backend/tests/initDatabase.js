const fs = require("fs");
const path = require("path");

require("dotenv").config({
    path: path.resolve(
        __dirname,
        "../.env.test"
    ),
    override: true,
});

const pool = require("../db");

const initDatabase = async () => {
    try {
        const sql = fs.readFileSync(
            path.resolve(
                __dirname,
                "../../infra/init.sql"
            ),
            "utf8"
        );

        await pool.query(sql);

        console.log(
            "Test database initialized."
        );
    } finally {
        await pool.end();
    }
};

initDatabase().catch((error) => {
    console.error(error);
    process.exit(1);
});