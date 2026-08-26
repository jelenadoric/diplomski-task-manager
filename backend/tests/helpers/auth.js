const request = require("supertest");

const app = require("../../app");

const DEFAULT_USER = {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
};

const registerUser = async (overrides = {}) => {
    const credentials = {
        ...DEFAULT_USER,
        ...overrides,
    };

    const response = await request(app)
        .post("/api/auth/register")
        .send(credentials);

    return {
        response,
        credentials,
        user: response.body.user,
        token: response.body.token,
    };
};

const loginUser = async ({
    email = DEFAULT_USER.email,
    password = DEFAULT_USER.password,
} = {}) => {
    return request(app)
        .post("/api/auth/login")
        .send({
            email,
            password,
        });
};

module.exports = {
    DEFAULT_USER,
    registerUser,
    loginUser,
};