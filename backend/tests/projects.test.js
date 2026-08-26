const request = require("supertest");

const app = require("../app");
const pool = require("../db");

const {
    registerUser,
} = require("./helpers/auth");

const {
    createProject,
} = require("./helpers/projects");

const registerOwner = async () => {
    return registerUser({
        username: "owner",
        email: "owner@example.com",
        password: "password123",
    });
};

const registerSecondUser = async () => {
    return registerUser({
        username: "seconduser",
        email: "second@example.com",
        password: "password123",
    });
};

const addProjectMember = async (
    projectId,
    userId
) => {
    await pool.query(
        `
            INSERT INTO project_members (
                project_id,
                user_id
            )
            VALUES ($1, $2)
        `,
        [
            projectId,
            userId,
        ]
    );
};

describe("Projects API", () => {

    describe("POST /api/projects", () => {

        it("creates a project for the authenticated user", async () => {
            const {
                token,
                user,
            } = await registerOwner();

            const response = await request(app)
                .post("/api/projects")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                )
                .send({
                    name: "Diplomski",
                    description: "CI/CD projekt",
                });

            expect(response.status).toBe(201);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: 1,
                    owner_id: user.id,
                    name: "Diplomski",
                    description: "CI/CD projekt",
                })
            );

            expect(
                response.body.created_at
            ).toBeDefined();

            expect(
                response.body.updated_at
            ).toBeDefined();
        });

        it("always uses the authenticated user as the owner", async () => {
            const {
                token,
                user,
            } = await registerOwner();

            const {
                user: secondUser,
            } = await registerSecondUser();

            const response = await request(app)
                .post("/api/projects")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                )
                .send({
                    name: "Test Project",
                    description: "",
                    owner_id: secondUser.id,
                });

            expect(response.status).toBe(201);

            expect(
                response.body.owner_id
            ).toBe(user.id);

            expect(
                response.body.owner_id
            ).not.toBe(secondUser.id);
        });

        it("returns 400 when project name is missing", async () => {
            const {
                token,
            } = await registerOwner();

            const response = await request(app)
                .post("/api/projects")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                )
                .send({
                    description: "Description",
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Project name is required",
            });
        });

        it("returns 400 when project name is longer than 100 characters", async () => {
            const {
                token,
            } = await registerOwner();

            const response = await request(app)
                .post("/api/projects")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                )
                .send({
                    name: "a".repeat(101),
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Project name must contain at most 100 characters",
            });
        });

        it("returns 400 when description is not a string", async () => {
            const {
                token,
            } = await registerOwner();

            const response = await request(app)
                .post("/api/projects")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                )
                .send({
                    name: "Test Project",
                    description: 123,
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Project description must be a string",
            });
        });

    });

    describe("GET /api/projects", () => {

        it("returns projects owned by the authenticated user", async () => {
            const {
                token,
            } = await registerOwner();

            await createProject(
                token,
                {
                    name: "Owned Project",
                }
            );

            const response = await request(app)
                .get("/api/projects")
                .set(
                    "Authorization",
                    `Bearer ${token}`
                );

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);

            expect(response.body[0]).toEqual(
                expect.objectContaining({
                    name: "Owned Project",
                    owner_username: "owner",
                    is_owner: true,
                })
            );
        });

        it("returns projects where the authenticated user is a member", async () => {
            const owner = await registerOwner();

            const secondUser =
                await registerSecondUser();

            const {
                project,
            } = await createProject(
                owner.token
            );

            await addProjectMember(
                project.id,
                secondUser.user.id
            );

            const response = await request(app)
                .get("/api/projects")
                .set(
                    "Authorization",
                    `Bearer ${secondUser.token}`
                );

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);

            expect(response.body[0]).toEqual(
                expect.objectContaining({
                    id: project.id,
                    owner_username: "owner",
                    is_owner: false,
                })
            );
        });

        it("does not return projects the user cannot access", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerSecondUser();

            await createProject(owner.token);

            const response = await request(app)
                .get("/api/projects")
                .set(
                    "Authorization",
                    `Bearer ${outsider.token}`
                );

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

    });

    describe("GET /api/projects/:id", () => {

        it("allows the owner to view the project", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .get(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: project.id,
                    name: project.name,
                    owner_username: "owner",
                    is_owner: true,
                })
            );
        });

        it("allows a project member to view the project", async () => {
            const owner = await registerOwner();

            const member =
                await registerSecondUser();

            const {
                project,
            } = await createProject(
                owner.token
            );

            await addProjectMember(
                project.id,
                member.user.id
            );

            const response = await request(app)
                .get(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${member.token}`
                );

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: project.id,
                    is_owner: false,
                })
            );
        });

        it("returns 403 when the user cannot access the project", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerSecondUser();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .get(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${outsider.token}`
                );

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "You do not have access to this project",
            });
        });

        it("returns 404 when the project does not exist", async () => {
            const owner = await registerOwner();

            const response = await request(app)
                .get("/api/projects/999")
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(404);

            expect(response.body).toEqual({
                error: "Project not found",
            });
        });

        it("returns 400 when project id is invalid", async () => {
            const owner = await registerOwner();

            const response = await request(app)
                .get("/api/projects/invalid")
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Invalid project id",
            });
        });

    });

    describe("PATCH /api/projects/:id", () => {

        it("allows the owner to update the project", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token,
                {
                    name: "Original Name",
                    description:
                        "Original description",
                }
            );

            const response = await request(app)
                .patch(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    name: "Updated Name",
                });

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: project.id,
                    name: "Updated Name",
                    description:
                        "Original description",
                })
            );
        });

        it("does not allow a project member to update the project", async () => {
            const owner = await registerOwner();

            const member =
                await registerSecondUser();

            const {
                project,
            } = await createProject(
                owner.token
            );

            await addProjectMember(
                project.id,
                member.user.id
            );

            const response = await request(app)
                .patch(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${member.token}`
                )
                .send({
                    name: "Unauthorized Update",
                });

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "Only the project owner can update the project",
            });
        });

        it("does not allow an outsider to update the project", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerSecondUser();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .patch(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${outsider.token}`
                )
                .send({
                    name: "Unauthorized Update",
                });

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "Only the project owner can update the project",
            });
        });

        it("returns 400 when no fields are provided", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .patch(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({});

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "At least one project field must be provided",
            });
        });

        it("returns 400 when updated name is empty", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .patch(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    name: "   ",
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Project name is required",
            });
        });

    });

    describe("DELETE /api/projects/:id", () => {

        it("allows the owner to delete the project", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .delete(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(204);

            const projectResult =
                await pool.query(
                    `
                        SELECT id
                        FROM projects
                        WHERE id = $1
                    `,
                    [project.id]
                );

            expect(
                projectResult.rowCount
            ).toBe(0);
        });

        it("does not allow a project member to delete the project", async () => {
            const owner = await registerOwner();

            const member =
                await registerSecondUser();

            const {
                project,
            } = await createProject(
                owner.token
            );

            await addProjectMember(
                project.id,
                member.user.id
            );

            const response = await request(app)
                .delete(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${member.token}`
                );

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "Only the project owner can delete the project",
            });

            const projectResult =
                await pool.query(
                    `
                        SELECT id
                        FROM projects
                        WHERE id = $1
                    `,
                    [project.id]
                );

            expect(
                projectResult.rowCount
            ).toBe(1);
        });

        it("does not allow an outsider to delete the project", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerSecondUser();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .delete(
                    `/api/projects/${project.id}`
                )
                .set(
                    "Authorization",
                    `Bearer ${outsider.token}`
                );

            expect(response.status).toBe(403);

            const projectResult =
                await pool.query(
                    `
                        SELECT id
                        FROM projects
                        WHERE id = $1
                    `,
                    [project.id]
                );

            expect(
                projectResult.rowCount
            ).toBe(1);
        });

    });

});