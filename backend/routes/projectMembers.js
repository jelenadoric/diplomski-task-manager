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
                    u.id,
                    u.username,
                    u.email,
                    TRUE AS is_owner
                FROM projects p
                INNER JOIN users u
                    ON u.id = p.owner_id
                WHERE p.id = $1

                UNION ALL

                SELECT
                    u.id,
                    u.username,
                    u.email,
                    FALSE AS is_owner
                FROM project_members pm
                INNER JOIN users u
                    ON u.id = pm.user_id
                WHERE pm.project_id = $1

                ORDER BY is_owner DESC, username ASC
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
        email,
    } = req.body;

    if (
        typeof email !== "string" ||
        !email.trim()
    ) {
        return res.status(400).json({
            error: "Email is required",
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

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

        if (!access.isOwner) {
            return res.status(403).json({
                error: "Only the project owner can add members",
            });
        }

        const userResult = await pool.query(
            `
                SELECT
                    id,
                    username,
                    email
                FROM users
                WHERE email = $1
            `,
            [normalizedEmail]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({
                error: "User not found",
            });
        }

        const user = userResult.rows[0];

        const projectResult = await pool.query(
            `
                SELECT owner_id
                FROM projects
                WHERE id = $1
            `,
            [projectId]
        );

        const project = projectResult.rows[0];

        if (project.owner_id === user.id) {
            return res.status(400).json({
                error: "Project owner is already part of the project",
            });
        }

        const existingMemberResult = await pool.query(
            `
                SELECT 1
                FROM project_members
                WHERE
                    project_id = $1
                    AND user_id = $2
            `,
            [
                projectId,
                user.id,
            ]
        );

        if (existingMemberResult.rowCount > 0) {
            return res.status(409).json({
                error: "User is already a project member",
            });
        }

        await pool.query(
            `
                INSERT INTO project_members (
                    project_id,
                    user_id
                )
                VALUES ($1, $2)
            `,
            [
                projectId,
                user.id,
            ]
        );

        res.status(201).json({
            ...user,
            is_owner: false,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.delete("/:userId", async (req, res) => {
    const projectId = parseId(req.params.projectId);
    const userId = parseId(req.params.userId);

    if (!projectId) {
        return res.status(400).json({
            error: "Invalid project id",
        });
    }

    if (!userId) {
        return res.status(400).json({
            error: "Invalid user id",
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

        if (!access.isOwner) {
            return res.status(403).json({
                error: "Only the project owner can remove members",
            });
        }

        const result = await pool.query(
            `
                WITH removed_member AS (
                    DELETE FROM project_members
                    WHERE
                        project_id = $1
                        AND user_id = $2
                    RETURNING user_id
                ),
                unassigned_tasks AS (
                    UPDATE tasks
                    SET
                        assigned_to = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE
                        project_id = $1
                        AND assigned_to IN (
                            SELECT user_id
                            FROM removed_member
                        )
                    RETURNING id
                )
                SELECT
                    COUNT(*)::int AS removed_count
                FROM removed_member
            `,
            [
                projectId,
                userId,
            ]
        );

        if (result.rows[0].removed_count === 0) {
            return res.status(404).json({
                error: "Project member not found",
            });
        }

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;