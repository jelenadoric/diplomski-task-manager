const TASK_STATUSES = [
    "TODO",
    "IN_PROGRESS",
    "DONE",
];

const TASK_PRIORITIES = [
    "LOW",
    "MEDIUM",
    "HIGH",
];

const isValidDate = (value) => {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
        return false;
    }

    return date.toISOString().slice(0, 10) === value;
};

const validateTaskData = (
    {
        title,
        description,
        status,
        priority,
        assignedTo,
        dueDate,
    },
    { partial = false } = {}
) => {
    if (!partial || title !== undefined) {
        if (
            typeof title !== "string" ||
            !title.trim()
        ) {
            return "Task title is required";
        }

        if (title.trim().length > 255) {
            return "Task title must contain at most 255 characters";
        }
    }

    if (
        description !== undefined &&
        typeof description !== "string"
    ) {
        return "Task description must be a string";
    }

    if (
        status !== undefined &&
        !TASK_STATUSES.includes(status)
    ) {
        return "Status must be TODO, IN_PROGRESS or DONE";
    }

    if (
        priority !== undefined &&
        !TASK_PRIORITIES.includes(priority)
    ) {
        return "Priority must be LOW, MEDIUM or HIGH";
    }

    if (
        assignedTo !== undefined &&
        assignedTo !== null &&
        (
            !Number.isInteger(assignedTo) ||
            assignedTo <= 0
        )
    ) {
        return "Assigned user id must be a positive integer or null";
    }

    if (
        dueDate !== undefined &&
        dueDate !== null &&
        !isValidDate(dueDate)
    ) {
        return "Due date must use YYYY-MM-DD format";
    }

    return null;
};

module.exports = {
    validateTaskData,
};