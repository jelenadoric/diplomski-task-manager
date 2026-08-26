const request = require("supertest");

const app = require("../../app");

const createTask = async (
    token,
    projectId,
    overrides = {}
) => {
    const taskData = {
        title: "Test Task",
        description: "Test task description",
        status: "TODO",
        priority: "MEDIUM",
        assigned_to: null,
        due_date: null,
        ...overrides,
    };

    const response = await request(app)
        .post(
            `/api/projects/${projectId}/tasks`
        )
        .set(
            "Authorization",
            `Bearer ${token}`
        )
        .send(taskData);

    return {
        response,
        task: response.body,
        taskData,
    };
};

module.exports = {
    createTask,
};