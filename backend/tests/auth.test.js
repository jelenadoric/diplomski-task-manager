const bcrypt = require("bcryptjs");
const request = require("supertest");

const app = require("../app");
const pool = require("../db");

const {
    DEFAULT_USER,
    registerUser,
    loginUser,
} = require("./helpers/auth");

describe("Auth API", () => {

    describe("POST /api/auth/register", () => {

        it("registers a new user", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send(DEFAULT_USER);

            expect(response.status).toBe(201);

            expect(response.body.user).toEqual(
                expect.objectContaining({
                    id: 1,
                    username: DEFAULT_USER.username,
                    email: DEFAULT_USER.email,
                })
            );

            expect(response.body.user.created_at).toBeDefined();
            expect(response.body.token).toEqual(
                expect.any(String)
            );
        });

        it("does not return the password hash", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send(DEFAULT_USER);

            expect(response.status).toBe(201);

            expect(
                response.body.user.password
            ).toBeUndefined();

            expect(
                response.body.user.password_hash
            ).toBeUndefined();
        });

        it("stores the password as a bcrypt hash", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send(DEFAULT_USER);

            expect(response.status).toBe(201);

            const result = await pool.query(
                `
                    SELECT password_hash
                    FROM users
                    WHERE id = $1
                `,
                [response.body.user.id]
            );

            const passwordHash =
                result.rows[0].password_hash;

            expect(passwordHash).not.toBe(
                DEFAULT_USER.password
            );

            const passwordMatches =
                await bcrypt.compare(
                    DEFAULT_USER.password,
                    passwordHash
                );

            expect(passwordMatches).toBe(true);
        });

        it("normalizes the email address", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    ...DEFAULT_USER,
                    email: "  TEST@EXAMPLE.COM  ",
                });

            expect(response.status).toBe(201);

            expect(response.body.user.email).toBe(
                "test@example.com"
            );
        });

        it("returns 400 when username is missing", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    email: DEFAULT_USER.email,
                    password: DEFAULT_USER.password,
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Username is required",
            });
        });

        it("returns 400 when email is missing", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    username: DEFAULT_USER.username,
                    password: DEFAULT_USER.password,
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Email is required",
            });
        });

        it("returns 400 when password is shorter than 8 characters", async () => {
            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    ...DEFAULT_USER,
                    password: "short",
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Password must contain at least 8 characters",
            });
        });

        it("returns 409 when username already exists", async () => {
            await registerUser();

            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    username: DEFAULT_USER.username,
                    email: "other@example.com",
                    password: "password123",
                });

            expect(response.status).toBe(409);

            expect(response.body).toEqual({
                error: "Username or email already exists",
            });
        });

        it("returns 409 when email already exists", async () => {
            await registerUser();

            const response = await request(app)
                .post("/api/auth/register")
                .send({
                    username: "otheruser",
                    email: DEFAULT_USER.email,
                    password: "password123",
                });

            expect(response.status).toBe(409);

            expect(response.body).toEqual({
                error: "Username or email already exists",
            });
        });

    });

    describe("POST /api/auth/login", () => {

        it("logs in with valid credentials", async () => {
            await registerUser();

            const response = await loginUser();

            expect(response.status).toBe(200);

            expect(response.body.user).toEqual(
                expect.objectContaining({
                    id: 1,
                    username: DEFAULT_USER.username,
                    email: DEFAULT_USER.email,
                })
            );

            expect(response.body.token).toEqual(
                expect.any(String)
            );
        });

        it("does not return the password hash", async () => {
            await registerUser();

            const response = await loginUser();

            expect(response.status).toBe(200);

            expect(
                response.body.user.password_hash
            ).toBeUndefined();

            expect(
                response.body.user.password
            ).toBeUndefined();
        });

        it("returns 401 when password is incorrect", async () => {
            await registerUser();

            const response = await loginUser({
                password: "wrong-password",
            });

            expect(response.status).toBe(401);

            expect(response.body).toEqual({
                error: "Invalid email or password",
            });
        });

        it("returns 401 when user does not exist", async () => {
            const response = await loginUser({
                email: "missing@example.com",
                password: "password123",
            });

            expect(response.status).toBe(401);

            expect(response.body).toEqual({
                error: "Invalid email or password",
            });
        });

        it("returns 400 when email is missing", async () => {
            const response = await request(app)
                .post("/api/auth/login")
                .send({
                    password: "password123",
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Email and password are required",
            });
        });

        it("returns 400 when password is missing", async () => {
            const response = await request(app)
                .post("/api/auth/login")
                .send({
                    email: DEFAULT_USER.email,
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Email and password are required",
            });
        });

    });

    describe("GET /api/auth/me", () => {

        it("returns the authenticated user", async () => {
            const {
                token,
                user,
            } = await registerUser();

            const response = await request(app)
                .get("/api/auth/me")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                })
            );
        });

        it("returns 401 when authorization header is missing", async () => {
            const response = await request(app)
                .get("/api/auth/me");

            expect(response.status).toBe(401);

            expect(response.body).toEqual({
                error: "Authentication required",
            });
        });

        it("returns 401 when authorization header is malformed", async () => {
            const response = await request(app)
                .get("/api/auth/me")
                .set(
                    "Authorization",
                    "invalid-header"
                );

            expect(response.status).toBe(401);

            expect(response.body).toEqual({
                error: "Invalid authorization header",
            });
        });

        it("returns 401 when token is invalid", async () => {
            const response = await request(app)
                .get("/api/auth/me")
                .set(
                    "Authorization",
                    "Bearer invalid-token"
                );

            expect(response.status).toBe(401);

            expect(response.body).toEqual({
                error: "Invalid or expired token",
            });
        });

    });

});