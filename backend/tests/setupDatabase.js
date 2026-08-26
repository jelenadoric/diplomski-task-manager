const pool = require("../db");

beforeEach(async () => {
    await pool.query(`
        TRUNCATE TABLE
            comments,
            tasks,
            project_members,
            projects,
            users
        RESTART IDENTITY
        CASCADE
    `);
});

afterAll(async () => {
    await pool.end();
});