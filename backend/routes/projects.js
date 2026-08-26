const express = require("express");

const pool = require("../db");
const authenticate = require("../middleware/auth");
const getProjectAccess = require("../utils/projectAccess");

const router = express.Router();

const parseProjectId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const validateProjectData = (
    {
        name,
        description,
    },
    { partial = false } = {}
) => {
    if (!partial || name !== undefined) {
        if (
            typeof name !== "string" ||
            !name.trim()
        ) {
            return "Project name is required";
        }

        if (name.trim().length > 100) {
            return "Project name must contain at most 100 characters";
        }
    }

    if (
        description !== undefined &&
        typeof description !== "string"
    ) {
        return "Project description must be a string";
    }

    return null;
};

router.use(authenticate);

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `
                SELECT
                    p.id,
                    p.owner_id,
                    p.name,
                    p.description,
                    p.created_at,
                    p.updated_at,
                    u.username AS owner_username,
                    p.owner_id = $1 AS is_owner
                FROM projects p
                INNER JOIN users u
                    ON u.id = p.owner_id
                WHERE
                    p.owner_id = $1
                    OR EXISTS (
                        SELECT 1
                        FROM project_members pm
                        WHERE
                            pm.project_id = p.id
                            AND pm.user_id = $1
                    )
                ORDER BY p.created_at DESC
            `,
            [req.user.id]
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
    const {
        name,
        description = "",
    } = req.body;

    const validationError = validateProjectData({
        name,
        description,
    });

    if (validationError) {
        return res.status(400).json({
            error: validationError,
        });
    }

    try {
        const result = await pool.query(
            `
                INSERT INTO projects (
                    owner_id,
                    name,
                    description
                )
                VALUES ($1, $2, $3)
                RETURNING
                    id,
                    owner_id,
                    name,
                    description,
                    created_at,
                    updated_at
            `,
            [
                req.user.id,
                name.trim(),
                description.trim(),
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.get("/:id", async (req, res) => {
    const projectId = parseProjectId(req.params.id);

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
                    p.id,
                    p.owner_id,
                    p.name,
                    p.description,
                    p.created_at,
                    p.updated_at,
                    u.username AS owner_username
                FROM projects p
                INNER JOIN users u
                    ON u.id = p.owner_id
                WHERE p.id = $1
            `,
            [projectId]
        );

        res.status(200).json({
            ...result.rows[0],
            is_owner: access.isOwner,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.patch("/:id", async (req, res) => {
    const projectId = parseProjectId(req.params.id);

    if (!projectId) {
        return res.status(400).json({
            error: "Invalid project id",
        });
    }

    const {
        name,
        description,
    } = req.body;

    if (
        name === undefined &&
        description === undefined
    ) {
        return res.status(400).json({
            error: "At least one project field must be provided",
        });
    }

    const validationError = validateProjectData(
        {
            name,
            description,
        },
        {
            partial: true,
        }
    );

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

        if (!access.isOwner) {
            return res.status(403).json({
                error: "Only the project owner can update the project",
            });
        }

        const currentProjectResult = await pool.query(
            `
                SELECT
                    name,
                    description
                FROM projects
                WHERE id = $1
            `,
            [projectId]
        );

        const currentProject = currentProjectResult.rows[0];

        const nextName =
            name !== undefined
                ? name.trim()
                : currentProject.name;

        const nextDescription =
            description !== undefined
                ? description.trim()
                : currentProject.description;

        const result = await pool.query(
            `
                UPDATE projects
                SET
                    name = $1,
                    description = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING
                    id,
                    owner_id,
                    name,
                    description,
                    created_at,
                    updated_at
            `,
            [
                nextName,
                nextDescription,
                projectId,
            ]
        );

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.delete("/:id", async (req, res) => {
    const projectId = parseProjectId(req.params.id);

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

        if (!access.isOwner) {
            return res.status(403).json({
                error: "Only the project owner can delete the project",
            });
        }

        await pool.query(
            `
                DELETE FROM projects
                WHERE id = $1
            `,
            [projectId]
        );

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;