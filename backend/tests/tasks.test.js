const request = require("supertest");

const app = require("../app");
const pool = require("../db");

const {
    registerUser,
} = require("./helpers/auth");

const {
    createProject,
} = require("./helpers/projects");

const {
    addProjectMember,
} = require("./helpers/projectMembers");

const {
    createTask,
} = require("./helpers/tasks");

const registerOwner = async () => {
    return registerUser({
        username: "owner",
        email: "owner@example.com",
        password: "password123",
    });
};

const registerMember = async () => {
    return registerUser({
        username: "member",
        email: "member@example.com",
        password: "password123",
    });
};

const registerOutsider = async () => {
    return registerUser({
        username: "outsider",
        email: "outsider@example.com",
        password: "password123",
    });
};

const createProjectWithMember = async () => {
    const owner = await registerOwner();
    const member = await registerMember();

    const {
        project,
    } = await createProject(
        owner.token
    );

    const response =
        await addProjectMember(
            owner.token,
            project.id,
            member.user.email
        );

    expect(response.status).toBe(201);

    return {
        owner,
        member,
        project,
    };
};

describe("Tasks API", () => {

    describe("POST /api/projects/:projectId/tasks", () => {

        it("allows the project owner to create a task", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .post(
                    `/api/projects/${project.id}/tasks`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    title: "Implement backend tests",
                    description: "Create task tests",
                    status: "TODO",
                    priority: "HIGH",
                    assigned_to: owner.user.id,
                    due_date: "2026-09-10",
                });

            expect(response.status).toBe(201);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: 1,
                    project_id: project.id,
                    created_by: owner.user.id,
                    assigned_to: owner.user.id,
                    title: "Implement backend tests",
                    description: "Create task tests",
                    status: "TODO",
                    priority: "HIGH",
                    due_date: "2026-09-10",
                    created_by_username: "owner",
                    assigned_to_username: "owner",
                })
            );

            expect(
                response.body.created_at
            ).toBeDefined();

            expect(
                response.body.updated_at
            ).toBeDefined();
        });

        it("allows a project member to create a task", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const {
                response,
            } = await createTask(
                member.token,
                project.id,
                {
                    title: "Member Task",
                    assigned_to: owner.user.id,
                }
            );

            expect(response.status).toBe(201);

            expect(response.body).toEqual(
                expect.objectContaining({
                    created_by: member.user.id,
                    created_by_username: "member",
                    assigned_to: owner.user.id,
                    assigned_to_username: "owner",
                })
            );
        });

        it("uses default values when optional fields are omitted", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .post(
                    `/api/projects/${project.id}/tasks`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    title: "Minimal Task",
                });

            expect(response.status).toBe(201);

            expect(response.body).toEqual(
                expect.objectContaining({
                    title: "Minimal Task",
                    description: "",
                    status: "TODO",
                    priority: "MEDIUM",
                    assigned_to: null,
                    assigned_to_username: null,
                    due_date: null,
                })
            );
        });

        it("always uses the authenticated user as the task creator", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const response = await request(app)
                .post(
                    `/api/projects/${project.id}/tasks`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    title: "Creator Test",
                    created_by: member.user.id,
                });

            expect(response.status).toBe(201);

            expect(
                response.body.created_by
            ).toBe(owner.user.id);

            expect(
                response.body.created_by
            ).not.toBe(member.user.id);
        });

        it("allows assigning a task to a project member", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const {
                response,
            } = await createTask(
                owner.token,
                project.id,
                {
                    assigned_to: member.user.id,
                }
            );

            expect(response.status).toBe(201);

            expect(response.body).toEqual(
                expect.objectContaining({
                    assigned_to: member.user.id,
                    assigned_to_username: "member",
                })
            );
        });

        it("does not allow assigning a task to a user outside the project", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerOutsider();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                response,
            } = await createTask(
                owner.token,
                project.id,
                {
                    assigned_to:
                        outsider.user.id,
                }
            );

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Assigned user must be a project member",
            });
        });

        it("returns 400 when the assigned user does not exist", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                response,
            } = await createTask(
                owner.token,
                project.id,
                {
                    assigned_to: 999,
                }
            );

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Assigned user not found",
            });
        });

        it("returns 400 when title is missing", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .post(
                    `/api/projects/${project.id}/tasks`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({});

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Task title is required",
            });
        });

        it("returns 400 when status is invalid", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                response,
            } = await createTask(
                owner.token,
                project.id,
                {
                    status: "ALMOST_DONE",
                }
            );

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Status must be TODO, IN_PROGRESS or DONE",
            });
        });

        it("returns 400 when priority is invalid", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                response,
            } = await createTask(
                owner.token,
                project.id,
                {
                    priority: "URGENT",
                }
            );

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Priority must be LOW, MEDIUM or HIGH",
            });
        });

        it("returns 400 when due date is invalid", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                response,
            } = await createTask(
                owner.token,
                project.id,
                {
                    due_date: "2026-02-31",
                }
            );

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Due date must use YYYY-MM-DD format",
            });
        });

        it("returns 403 when an outsider tries to create a task", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerOutsider();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                response,
            } = await createTask(
                outsider.token,
                project.id
            );

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "You do not have access to this project",
            });
        });

    });

    describe("GET /api/projects/:projectId/tasks", () => {

        it("returns all tasks for the project", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            await createTask(
                owner.token,
                project.id,
                {
                    title: "Task A",
                }
            );

            await createTask(
                owner.token,
                project.id,
                {
                    title: "Task B",
                    status: "DONE",
                }
            );

            const response = await request(app)
                .get(
                    `/api/projects/${project.id}/tasks`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);

            expect(
                response.body.map(
                    (task) => task.title
                )
            ).toEqual(
                expect.arrayContaining([
                    "Task A",
                    "Task B",
                ])
            );
        });

        it("allows a project member to list tasks", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .get(
                    `/api/projects/${project.id}/tasks`
                )
                .set(
                    "Authorization",
                    `Bearer ${member.token}`
                );

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
        });

        it("returns 403 when an outsider tries to list project tasks", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerOutsider();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .get(
                    `/api/projects/${project.id}/tasks`
                )
                .set(
                    "Authorization",
                    `Bearer ${outsider.token}`
                );

            expect(response.status).toBe(403);
        });

    });

    describe("GET /api/tasks/:id", () => {

        it("returns a task to the project owner", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .get(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: task.id,
                    project_id: project.id,
                    title: "Test Task",
                })
            );
        });

        it("returns a task to a project member", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .get(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${member.token}`
                );

            expect(response.status).toBe(200);
        });

        it("returns 403 when an outsider requests the task", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerOutsider();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .get(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${outsider.token}`
                );

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "You do not have access to this task",
            });
        });

        it("returns 404 when the task does not exist", async () => {
            const owner = await registerOwner();

            const response = await request(app)
                .get("/api/tasks/999")
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(404);

            expect(response.body).toEqual({
                error: "Task not found",
            });
        });

    });

    describe("PATCH /api/tasks/:id", () => {

        it("updates task fields", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .patch(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    title: "Updated Task",
                    description:
                        "Updated description",
                    status: "IN_PROGRESS",
                    priority: "HIGH",
                    assigned_to: member.user.id,
                    due_date: "2026-09-15",
                });

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: task.id,
                    title: "Updated Task",
                    description:
                        "Updated description",
                    status: "IN_PROGRESS",
                    priority: "HIGH",
                    assigned_to: member.user.id,
                    assigned_to_username: "member",
                    due_date: "2026-09-15",
                })
            );
        });

        it("allows a project member to update a task", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .patch(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${member.token}`
                )
                .send({
                    status: "DONE",
                });

            expect(response.status).toBe(200);

            expect(
                response.body.status
            ).toBe("DONE");
        });

        it("preserves fields that are not provided", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                task,
            } = await createTask(
                owner.token,
                project.id,
                {
                    title: "Original",
                    description: "Description",
                    priority: "HIGH",
                    due_date: "2026-09-20",
                }
            );

            const response = await request(app)
                .patch(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    status: "IN_PROGRESS",
                });

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    title: "Original",
                    description: "Description",
                    status: "IN_PROGRESS",
                    priority: "HIGH",
                    due_date: "2026-09-20",
                })
            );
        });

        it("allows a task to be unassigned", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const {
                task,
            } = await createTask(
                owner.token,
                project.id,
                {
                    assigned_to: member.user.id,
                }
            );

            const response = await request(app)
                .patch(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    assigned_to: null,
                });

            expect(response.status).toBe(200);

            expect(
                response.body.assigned_to
            ).toBeNull();

            expect(
                response.body.assigned_to_username
            ).toBeNull();
        });

        it("does not allow assigning the task to an outsider", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerOutsider();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .patch(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    assigned_to:
                        outsider.user.id,
                });

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Assigned user must be a project member",
            });
        });

        it("returns 400 when updated status is invalid", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .patch(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    status: "INVALID",
                });

            expect(response.status).toBe(400);
        });

        it("returns 403 when an outsider tries to update a task", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerOutsider();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .patch(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${outsider.token}`
                )
                .send({
                    status: "DONE",
                });

            expect(response.status).toBe(403);

            const result = await pool.query(
                `
                    SELECT status
                    FROM tasks
                    WHERE id = $1
                `,
                [task.id]
            );

            expect(
                result.rows[0].status
            ).toBe("TODO");
        });

    });

    describe("DELETE /api/tasks/:id", () => {

        it("allows the project owner to delete a task", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .delete(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(204);

            const result = await pool.query(
                `
                    SELECT id
                    FROM tasks
                    WHERE id = $1
                `,
                [task.id]
            );

            expect(result.rowCount).toBe(0);
        });

        it("allows a project member to delete a task", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .delete(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${member.token}`
                );

            expect(response.status).toBe(204);
        });

        it("does not allow an outsider to delete a task", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerOutsider();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const {
                task,
            } = await createTask(
                owner.token,
                project.id
            );

            const response = await request(app)
                .delete(`/api/tasks/${task.id}`)
                .set(
                    "Authorization",
                    `Bearer ${outsider.token}`
                );

            expect(response.status).toBe(403);

            const result = await pool.query(
                `
                    SELECT id
                    FROM tasks
                    WHERE id = $1
                `,
                [task.id]
            );

            expect(result.rowCount).toBe(1);
        });

        it("returns 404 when deleting a task that does not exist", async () => {
            const owner = await registerOwner();

            const response = await request(app)
                .delete("/api/tasks/999")
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                );

            expect(response.status).toBe(404);

            expect(response.body).toEqual({
                error: "Task not found",
            });
        });

    });

});