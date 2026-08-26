const request = require("supertest");

const app = require("../../app");

const getDashboard = async (token) => {
    return request(app)
        .get("/api/dashboard")
        .set(
            "Authorization",
            `Bearer ${token}`
        );
};

module.exports = {
    getDashboard,
};