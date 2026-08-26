const express = require("express");

const pool = require("../db");
const authenticate = require("../middleware/auth");
const getProjectAccess = require("../utils/projectAccess");
const {
    validateTaskData,
} = require("../utils/taskValidation");

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

const getTaskAssignee = async (
    projectId,
    assignedTo
) => {
    if (assignedTo === null) {
        return null;
    }

    const userResult = await pool.query(
        `
            SELECT
                id,
                username,
                email
            FROM users
            WHERE id = $1
        `,
        [assignedTo]
    );

    if (userResult.rowCount === 0) {
        return {
            error: "Assigned user not found",
        };
    }

    const access = await getProjectAccess(
        projectId,
        assignedTo
    );

    if (!access || !access.hasAccess) {
        return {
            error: "Assigned user must be a project member",
        };
    }

    return userResult.rows[0];
};

router.use(authenticate);

router.get("/", async (req, res) => {
    const projectId = parseId(req.params.projectId);

    if (!projectId) {
        return res.status(400).json({
            error: "Invalid project id",
        });
    }

    try {
        const access = await getProjectAccess(
            projectId,
            req.user.id
        );

        if (!access) {
            return res.status(404).json({
                error: "Project not found",
            });
        }

        if (!access.hasAccess) {
            return res.status(403).json({
                error: "You do not have access to this project",
            });
        }

        const result = await pool.query(
            `
                SELECT
                    t.id,
                    t.project_id,
                    t.created_by,
                    t.assigned_to,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.due_date,
                    t.created_at,
                    t.updated_at,
                    creator.username AS created_by_username,
                    assignee.username AS assigned_to_username
                FROM tasks t
                INNER JOIN users creator
                    ON creator.id = t.created_by
                LEFT JOIN users assignee
                    ON assignee.id = t.assigned_to
                WHERE t.project_id = $1
                ORDER BY t.created_at DESC
            `,
            [projectId]
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
    const projectId = parseId(req.params.projectId);

    if (!projectId) {
        return res.status(400).json({
            error: "Invalid project id",
        });
    }

    const {
        title,
        description = "",
        status = "TODO",
        priority = "MEDIUM",
        assigned_to: assignedTo = null,
        due_date: dueDate = null,
    } = req.body;

    const validationError = validateTaskData({
        title,
        description,
        status,
        priority,
        assignedTo,
        dueDate,
    });

    if (validationError) {
        return res.status(400).json({
            error: validationError,
        });
    }

    try {
        const access = await getProjectAccess(
            projectId,
            req.user.id
        );

        if (!access) {
            return res.status(404).json({
                error: "Project not found",
            });
        }

        if (!access.hasAccess) {
            return res.status(403).json({
                error: "You do not have access to this project",
            });
        }

        if (assignedTo !== null) {
            const assignee = await getTaskAssignee(
                projectId,
                assignedTo
            );

            if (assignee?.error) {
                return res.status(400).json({
                    error: assignee.error,
                });
            }
        }

        const result = await pool.query(
            `
                INSERT INTO tasks (
                    project_id,
                    created_by,
                    assigned_to,
                    title,
                    description,
                    status,
                    priority,
                    due_date
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8
                )
                RETURNING
                    id,
                    project_id,
                    created_by,
                    assigned_to,
                    title,
                    description,
                    status,
                    priority,
                    due_date,
                    created_at,
                    updated_at
            `,
            [
                projectId,
                req.user.id,
                assignedTo,
                title.trim(),
                description.trim(),
                status,
                priority,
                dueDate,
            ]
        );

        const task = result.rows[0];

        const taskResult = await pool.query(
            `
                SELECT
                    t.id,
                    t.project_id,
                    t.created_by,
                    t.assigned_to,
                    t.title,
                    t.description,
                    t.status,
                    t.priority,
                    t.due_date,
                    t.created_at,
                    t.updated_at,
                    creator.username AS created_by_username,
                    assignee.username AS assigned_to_username
                FROM tasks t
                INNER JOIN users creator
                    ON creator.id = t.created_by
                LEFT JOIN users assignee
                    ON assignee.id = t.assigned_to
                WHERE t.id = $1
            `,
            [task.id]
        );

        res.status(201).json(taskResult.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;