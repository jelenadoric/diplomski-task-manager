const { Pool, types } = require("pg");

require("dotenv").config();

types.setTypeParser(
    1082,
    (value) => value
);

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
    })
    : new Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

module.exports = pool;