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

const {
    getTaskComments,
    createComment,
    deleteComment,
} = require("./helpers/comments");

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

const createProjectWithMemberAndTask =
    async () => {
        const owner =
            await registerOwner();

        const member =
            await registerMember();

        const {
            project,
        } = await createProject(
            owner.token
        );

        const addMemberResponse =
            await addProjectMember(
                owner.token,
                project.id,
                member.user.email
            );

        expect(
            addMemberResponse.status
        ).toBe(201);

        const {
            response: taskResponse,
            task,
        } = await createTask(
            owner.token,
            project.id,
            {
                title: "Comment Test Task",
            }
        );

        expect(
            taskResponse.status
        ).toBe(201);

        return {
            owner,
            member,
            project,
            task,
        };
    };

describe("Comments API", () => {

    describe("POST /api/tasks/:taskId/comments", () => {

        it("allows the project owner to create a comment", async () => {
            const {
                owner,
                task,
            } =
                await createProjectWithMemberAndTask();

            const {
                response,
            } = await createComment(
                owner.token,
                task.id,
                "Owner comment"
            );

            expect(response.status).toBe(201);

            expect(response.body).toEqual(
                expect.objectContaining({
                    id: 1,
                    task_id: task.id,
                    user_id: owner.user.id,
                    content: "Owner comment",
                    author_username: "owner",
                })
            );

            expect(
                response.body.created_at
            ).toBeDefined();
        });

        it("allows a project member to create a comment", async () => {
            const {
                member,
                task,
            } =
                await createProjectWithMemberAndTask();

            const {
                response,
            } = await createComment(
                member.token,
                task.id,
                "Member comment"
            );

            expect(response.status).toBe(201);

            expect(response.body).toEqual(
                expect.objectContaining({
                    task_id: task.id,
                    user_id: member.user.id,
                    content: "Member comment",
                    author_username: "member",
                })
            );
        });

        it("uses the authenticated user as the comment author", async () => {
            const {
                owner,
                member,
                task,
            } =
                await createProjectWithMemberAndTask();

            const response = await request(app)
                .post(
                    `/api/tasks/${task.id}/comments`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({
                    content: "Test",
                    user_id: member.user.id,
                });

            expect(response.status).toBe(201);

            expect(
                response.body.user_id
            ).toBe(owner.user.id);

            expect(
                response.body.user_id
            ).not.toBe(member.user.id);
        });

        it("returns 400 when comment content is empty", async () => {
            const {
                owner,
                task,
            } =
                await createProjectWithMemberAndTask();

            const {
                response,
            } = await createComment(
                owner.token,
                task.id,
                "   "
            );

            expect(response.status).toBe(400);
            expect(
                response.body.error
            ).toBeDefined();
        });

        it("returns 403 when an outsider tries to create a comment", async () => {
            const {
                task,
            } =
                await createProjectWithMemberAndTask();

            const outsider =
                await registerOutsider();

            const {
                response,
            } = await createComment(
                outsider.token,
                task.id,
                "Unauthorized comment"
            );

            expect(response.status).toBe(403);
        });

        it("returns 404 when the task does not exist", async () => {
            const owner =
                await registerOwner();

            const {
                response,
            } = await createComment(
                owner.token,
                999,
                "Comment"
            );

            expect(response.status).toBe(404);
        });

    });

    describe("GET /api/tasks/:taskId/comments", () => {

        it("returns comments for the task in creation order", async () => {
            const {
                owner,
                member,
                task,
            } =
                await createProjectWithMemberAndTask();

            await createComment(
                owner.token,
                task.id,
                "First comment"
            );

            await createComment(
                member.token,
                task.id,
                "Second comment"
            );

            const response =
                await getTaskComments(
                    owner.token,
                    task.id
                );

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);

            expect(
                response.body[0]
            ).toEqual(
                expect.objectContaining({
                    content: "First comment",
                    author_username: "owner",
                })
            );

            expect(
                response.body[1]
            ).toEqual(
                expect.objectContaining({
                    content: "Second comment",
                    author_username: "member",
                })
            );
        });

        it("allows a project member to view comments", async () => {
            const {
                owner,
                member,
                task,
            } =
                await createProjectWithMemberAndTask();

            await createComment(
                owner.token,
                task.id,
                "Visible comment"
            );

            const response =
                await getTaskComments(
                    member.token,
                    task.id
                );

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
        });

        it("returns 403 when an outsider tries to view comments", async () => {
            const {
                task,
            } =
                await createProjectWithMemberAndTask();

            const outsider =
                await registerOutsider();

            const response =
                await getTaskComments(
                    outsider.token,
                    task.id
                );

            expect(response.status).toBe(403);
        });

    });

    describe("DELETE /api/comments/:id", () => {

        it("allows the comment author to delete their comment", async () => {
            const {
                owner,
                task,
            } =
                await createProjectWithMemberAndTask();

            const {
                comment,
            } = await createComment(
                owner.token,
                task.id,
                "Delete me"
            );

            const response =
                await deleteComment(
                    owner.token,
                    comment.id
                );

            expect(response.status).toBe(204);

            const result =
                await pool.query(
                    `
                        SELECT id
                        FROM comments
                        WHERE id = $1
                    `,
                    [comment.id]
                );

            expect(
                result.rowCount
            ).toBe(0);
        });

        it("does not allow another project member to delete the comment", async () => {
            const {
                owner,
                member,
                task,
            } =
                await createProjectWithMemberAndTask();

            const {
                comment,
            } = await createComment(
                owner.token,
                task.id,
                "Owner comment"
            );

            const response =
                await deleteComment(
                    member.token,
                    comment.id
                );

            expect(response.status).toBe(403);

            const result =
                await pool.query(
                    `
                        SELECT id
                        FROM comments
                        WHERE id = $1
                    `,
                    [comment.id]
                );

            expect(
                result.rowCount
            ).toBe(1);
        });

        it("does not allow the project owner to delete a member's comment", async () => {
            const {
                owner,
                member,
                task,
            } =
                await createProjectWithMemberAndTask();

            const {
                comment,
            } = await createComment(
                member.token,
                task.id,
                "Member comment"
            );

            const response =
                await deleteComment(
                    owner.token,
                    comment.id
                );

            expect(response.status).toBe(403);

            const result =
                await pool.query(
                    `
                        SELECT id
                        FROM comments
                        WHERE id = $1
                    `,
                    [comment.id]
                );

            expect(
                result.rowCount
            ).toBe(1);
        });

        it("returns 404 when the comment does not exist", async () => {
            const owner =
                await registerOwner();

            const response =
                await deleteComment(
                    owner.token,
                    999
                );

            expect(response.status).toBe(404);
        });

    });

});