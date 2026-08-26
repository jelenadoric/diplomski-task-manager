const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const authenticate = require("../middleware/auth");

const router = express.Router();

const createToken = (userId) => {
    return jwt.sign(
        {
            userId,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "2h",
        }
    );
};

router.post("/register", async (req, res) => {
    const {
        username,
        email,
        password,
    } = req.body;

    if (
        typeof username !== "string" ||
        !username.trim()
    ) {
        return res.status(400).json({
            error: "Username is required",
        });
    }

    if (
        typeof email !== "string" ||
        !email.trim()
    ) {
        return res.status(400).json({
            error: "Email is required",
        });
    }

    if (
        typeof password !== "string" ||
        password.length < 8
    ) {
        return res.status(400).json({
            error: "Password must contain at least 8 characters",
        });
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    try {
        const passwordHash = await bcrypt.hash(
            password,
            10
        );

        const result = await pool.query(
            `
                INSERT INTO users (
                    username,
                    email,
                    password_hash
                )
                VALUES ($1, $2, $3)
                RETURNING
                    id,
                    username,
                    email,
                    created_at
            `,
            [
                normalizedUsername,
                normalizedEmail,
                passwordHash,
            ]
        );

        const user = result.rows[0];

        const token = createToken(user.id);

        res.status(201).json({
            user,
            token,
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: "Username or email already exists",
            });
        }

        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.post("/login", async (req, res) => {
    const {
        email,
        password,
    } = req.body;

    if (
        typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string" ||
        !password
    ) {
        return res.status(400).json({
            error: "Email and password are required",
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const result = await pool.query(
            `
                SELECT
                    id,
                    username,
                    email,
                    password_hash,
                    created_at
                FROM users
                WHERE email = $1
            `,
            [normalizedEmail]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                error: "Invalid email or password",
            });
        }

        const user = result.rows[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid email or password",
            });
        }

        const token = createToken(user.id);

        res.status(200).json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at,
            },
            token,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.get("/me", authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    id,
                    username,
                    email,
                    created_at
                FROM users
                WHERE id = $1
            `,
            [req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                error: "User not found",
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;