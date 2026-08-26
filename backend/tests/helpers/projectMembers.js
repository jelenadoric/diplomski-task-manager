const request = require("supertest");

const app = require("../../app");

const getProjectMembers = async (
    token,
    projectId
) => {
    return request(app)
        .get(
            `/api/projects/${projectId}/members`
        )
        .set(
            "Authorization",
            `Bearer ${token}`
        );
};

const addProjectMember = async (
    token,
    projectId,
    email
) => {
    return request(app)
        .post(
            `/api/projects/${projectId}/members`
        )
        .set(
            "Authorization",
            `Bearer ${token}`
        )
        .send({
            email,
        });
};

const removeProjectMember = async (
    token,
    projectId,
    userId
) => {
    return request(app)
        .delete(
            `/api/projects/${projectId}/members/${userId}`
        )
        .set(
            "Authorization",
            `Bearer ${token}`
        );
};

module.exports = {
    getProjectMembers,
    addProjectMember,
    removeProjectMember,
};