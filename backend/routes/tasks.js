const express = require("express");

const pool = require("../db");
const authenticate = require("../middleware/auth");
const getProjectAccess = require("../utils/projectAccess");
const {
    validateTaskData,
} = require("../utils/taskValidation");

const router = express.Router();

const parseTaskId = (value) => {
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
        [taskId]
    );

    if (result.rowCount === 0) {
        return null;
    }

    return result.rows[0];
};

const validateAssignee = async (
    projectId,
    assignedTo
) => {
    if (assignedTo === null) {
        return null;
    }

    const userResult = await pool.query(
        `
            SELECT id
            FROM users
            WHERE id = $1
        `,
        [assignedTo]
    );

    if (userResult.rowCount === 0) {
        return "Assigned user not found";
    }

    const access = await getProjectAccess(
        projectId,
        assignedTo
    );

    if (!access || !access.hasAccess) {
        return "Assigned user must be a project member";
    }

    return null;
};

router.use(authenticate);

router.get("/:id", async (req, res) => {
    const taskId = parseTaskId(req.params.id);

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

        res.status(200).json(task);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.patch("/:id", async (req, res) => {
    const taskId = parseTaskId(req.params.id);

    if (!taskId) {
        return res.status(400).json({
            error: "Invalid task id",
        });
    }

    const {
        title,
        description,
        status,
        priority,
        assigned_to: assignedTo,
        due_date: dueDate,
    } = req.body;

    if (
        title === undefined &&
        description === undefined &&
        status === undefined &&
        priority === undefined &&
        assignedTo === undefined &&
        dueDate === undefined
    ) {
        return res.status(400).json({
            error: "At least one task field must be provided",
        });
    }

    const validationError = validateTaskData(
        {
            title,
            description,
            status,
            priority,
            assignedTo,
            dueDate,
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
        const currentTask = await findTask(taskId);

        if (!currentTask) {
            return res.status(404).json({
                error: "Task not found",
            });
        }

        const access = await getProjectAccess(
            currentTask.project_id,
            req.user.id
        );

        if (!access?.hasAccess) {
            return res.status(403).json({
                error: "You do not have access to this task",
            });
        }

        if (assignedTo !== undefined) {
            const assigneeError = await validateAssignee(
                currentTask.project_id,
                assignedTo
            );

            if (assigneeError) {
                return res.status(400).json({
                    error: assigneeError,
                });
            }
        }

        const nextTitle =
            title !== undefined
                ? title.trim()
                : currentTask.title;

        const nextDescription =
            description !== undefined
                ? description.trim()
                : currentTask.description;

        const nextStatus =
            status !== undefined
                ? status
                : currentTask.status;

        const nextPriority =
            priority !== undefined
                ? priority
                : currentTask.priority;

        const nextAssignedTo =
            assignedTo !== undefined
                ? assignedTo
                : currentTask.assigned_to;

        const nextDueDate =
            dueDate !== undefined
                ? dueDate
                : currentTask.due_date;

        await pool.query(
            `
                UPDATE tasks
                SET
                    title = $1,
                    description = $2,
                    status = $3,
                    priority = $4,
                    assigned_to = $5,
                    due_date = $6,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $7
            `,
            [
                nextTitle,
                nextDescription,
                nextStatus,
                nextPriority,
                nextAssignedTo,
                nextDueDate,
                taskId,
            ]
        );

        const updatedTask = await findTask(taskId);

        res.status(200).json(updatedTask);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

router.delete("/:id", async (req, res) => {
    const taskId = parseTaskId(req.params.id);

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

        await pool.query(
            `
                DELETE FROM tasks
                WHERE id = $1
            `,
            [taskId]
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