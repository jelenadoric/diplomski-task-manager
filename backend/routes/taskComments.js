const express = require("express");

const pool = require("../db");
const authenticate = require("../middleware/auth");
const getProjectAccess = require("../utils/projectAccess");

const router = express.Router({
    mergeParams: true,
});

const parseId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const findTask = async (taskId) => {
    const result = await pool.query(
        `
            SELECT
                id,
                project_id
            FROM tasks
            WHERE id = $1
        `,
        [taskId]
    );

    if (result.rowCount === 0) {
        return null;
    }

    return result.rows[0];
};

router.use(authenticate);

router.get("/", async (req, res) => {
    const taskId = parseId(req.params.taskId);

    if (!taskId) {
        return res.status(400).json({
            error: "Invalid task id",
        });
    }

    try {
        const task = await findTask(taskId);

        if (!task) {
            return res.status(404).json({
                error: "Task not found",
            });
        }

        const access = await getProjectAccess(
            task.project_id,
            req.user.id
        );

        if (!access?.hasAccess) {
            return res.status(403).json({
                error: "You do not have access to this task",
            });
        }

        const result = await pool.query(
            `
                SELECT
                    c.id,
                    c.task_id,
                    c.user_id,
                    c.content,
                    c.created_at,
                    u.username AS author_username
                FROM comments c
                INNER JOIN users u
                    ON u.id = c.user_id
                WHERE c.task_id = $1
                ORDER BY c.created_at ASC
            `,
            [taskId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.post("/", async (req, res) => {
    const taskId = parseId(req.params.taskId);

    if (!taskId) {
        return res.status(400).json({
            error: "Invalid task id",
        });
    }

    const {
        content,
    } = req.body;

    if (
        typeof content !== "string" ||
        !content.trim()
    ) {
        return res.status(400).json({
            error: "Comment content is required",
        });
    }

    try {
        const task = await findTask(taskId);

        if (!task) {
            return res.status(404).json({
                error: "Task not found",
            });
        }

        const access = await getProjectAccess(
            task.project_id,
            req.user.id
        );

        if (!access?.hasAccess) {
            return res.status(403).json({
                error: "You do not have access to this task",
            });
        }

        const result = await pool.query(
            `
                INSERT INTO comments (
                    task_id,
                    user_id,
                    content
                )
                VALUES ($1, $2, $3)
                RETURNING
                    id,
                    task_id,
                    user_id,
                    content,
                    created_at
            `,
            [
                taskId,
                req.user.id,
                content.trim(),
            ]
        );

        const comment = result.rows[0];

        const authorResult = await pool.query(
            `
                SELECT username
                FROM users
                WHERE id = $1
            `,
            [req.user.id]
        );

        res.status(201).json({
            ...comment,
            author_username: authorResult.rows[0].username,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;