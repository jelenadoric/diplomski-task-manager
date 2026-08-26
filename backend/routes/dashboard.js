const express = require("express");

const pool = require("../db");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.get("/", async (req, res) => {
    try {
        const summaryResult = await pool.query(
            `
                WITH accessible_projects AS (
                    SELECT p.id
                    FROM projects p
                    WHERE
                        p.owner_id = $1
                        OR EXISTS (
                            SELECT 1
                            FROM project_members pm
                            WHERE
                                pm.project_id = p.id
                                AND pm.user_id = $1
                        )
                ),
                accessible_tasks AS (
                    SELECT t.*
                    FROM tasks t
                    INNER JOIN accessible_projects ap
                        ON ap.id = t.project_id
                )
                SELECT
                    (
                        SELECT COUNT(*)::int
                        FROM accessible_projects
                    ) AS projects_count,

                    COUNT(*)::int AS total,

                    COUNT(*) FILTER (
                        WHERE status = 'TODO'
                    )::int AS todo,

                    COUNT(*) FILTER (
                        WHERE status = 'IN_PROGRESS'
                    )::int AS in_progress,

                    COUNT(*) FILTER (
                        WHERE status = 'DONE'
                    )::int AS done,

                    COUNT(*) FILTER (
                        WHERE
                            due_date < CURRENT_DATE
                            AND status <> 'DONE'
                    )::int AS overdue
                FROM accessible_tasks
            `,
            [req.user.id]
        );

        const assignedTasksResult = await pool.query(
            `
                WITH accessible_projects AS (
                    SELECT p.id
                    FROM projects p
                    WHERE
                        p.owner_id = $1
                        OR EXISTS (
                            SELECT 1
                            FROM project_members pm
                            WHERE
                                pm.project_id = p.id
                                AND pm.user_id = $1
                        )
                )
                SELECT
                    t.id,
                    t.project_id,
                    p.name AS project_name,
                    t.title,
                    t.status,
                    t.priority,
                    t.due_date,
                    t.created_at,
                    t.updated_at
                FROM tasks t
                INNER JOIN accessible_projects ap
                    ON ap.id = t.project_id
                INNER JOIN projects p
                    ON p.id = t.project_id
                WHERE
                    t.assigned_to = $1
                    AND t.status <> 'DONE'
                ORDER BY
                    t.due_date ASC NULLS LAST,
                    t.created_at DESC
                LIMIT 10
            `,
            [req.user.id]
        );

        const summary = summaryResult.rows[0];

        res.status(200).json({
            projects_count: summary.projects_count,
            tasks: {
                total: summary.total,
                todo: summary.todo,
                in_progress: summary.in_progress,
                done: summary.done,
                overdue: summary.overdue,
            },
            assigned_tasks: assignedTasksResult.rows,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;