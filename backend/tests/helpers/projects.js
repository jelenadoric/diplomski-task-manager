const request = require("supertest");

const app = require("../../app");

const createProject = async (
    token,
    overrides = {}
) => {
    const projectData = {
        name: "Test Project",
        description: "Test project description",
        ...overrides,
    };

    const response = await request(app)
        .post("/api/projects")
        .set(
            "Authorization",
            `Bearer ${token}`
        )
        .send(projectData);

    return {
        response,
        project: response.body,
        projectData,
    };
};

module.exports = {
    createProject,
};