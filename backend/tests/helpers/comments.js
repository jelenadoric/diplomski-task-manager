const request = require("supertest");

const app = require("../../app");

const getTaskComments = async (
    token,
    taskId
) => {
    return request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set(
            "Authorization",
            `Bearer ${token}`
        );
};

const createComment = async (
    token,
    taskId,
    content = "Test comment"
) => {
    const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set(
            "Authorization",
            `Bearer ${token}`
        )
        .send({
            content,
        });

    return {
        response,
        comment: response.body,
    };
};

const deleteComment = async (
    token,
    commentId
) => {
    return request(app)
        .delete(`/api/comments/${commentId}`)
        .set(
            "Authorization",
            `Bearer ${token}`
        );
};

module.exports = {
    getTaskComments,
    createComment,
    deleteComment,
};