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
    getProjectMembers,
    addProjectMember,
    removeProjectMember,
} = require("./helpers/projectMembers");

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

const registerThirdUser = async () => {
    return registerUser({
        username: "thirduser",
        email: "third@example.com",
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

    const addMemberResponse =
        await addProjectMember(
            owner.token,
            project.id,
            member.user.email
        );

    expect(
        addMemberResponse.status
    ).toBe(201);

    return {
        owner,
        member,
        project,
    };
};

describe("Project Members API", () => {

    describe("GET /api/projects/:projectId/members", () => {

        it("returns the project owner and project members", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const response =
                await getProjectMembers(
                    owner.token,
                    project.id
                );

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);

            expect(response.body).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: owner.user.id,
                        username: "owner",
                        email: "owner@example.com",
                        is_owner: true,
                    }),
                    expect.objectContaining({
                        id: member.user.id,
                        username: "member",
                        email: "member@example.com",
                        is_owner: false,
                    }),
                ])
            );
        });

        it("allows a project member to view the member list", async () => {
            const {
                member,
                project,
            } = await createProjectWithMember();

            const response =
                await getProjectMembers(
                    member.token,
                    project.id
                );

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
        });

        it("returns 403 when an outsider requests the member list", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerMember();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response =
                await getProjectMembers(
                    outsider.token,
                    project.id
                );

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "You do not have access to this project",
            });
        });

        it("returns 404 when the project does not exist", async () => {
            const owner = await registerOwner();

            const response =
                await getProjectMembers(
                    owner.token,
                    999
                );

            expect(response.status).toBe(404);

            expect(response.body).toEqual({
                error: "Project not found",
            });
        });

    });

    describe("POST /api/projects/:projectId/members", () => {

        it("allows the owner to add a user by email", async () => {
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

            expect(response.body).toEqual({
                id: member.user.id,
                username: member.user.username,
                email: member.user.email,
                is_owner: false,
            });

            const result = await pool.query(
                `
                    SELECT
                        project_id,
                        user_id
                    FROM project_members
                    WHERE
                        project_id = $1
                        AND user_id = $2
                `,
                [
                    project.id,
                    member.user.id,
                ]
            );

            expect(result.rowCount).toBe(1);
        });

        it("normalizes the email before adding a member", async () => {
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
                    "  MEMBER@EXAMPLE.COM  "
                );

            expect(response.status).toBe(201);

            expect(response.body.id).toBe(
                member.user.id
            );
        });

        it("returns 400 when email is missing", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response = await request(app)
                .post(
                    `/api/projects/${project.id}/members`
                )
                .set(
                    "Authorization",
                    `Bearer ${owner.token}`
                )
                .send({});

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Email is required",
            });
        });

        it("returns 404 when the user does not exist", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response =
                await addProjectMember(
                    owner.token,
                    project.id,
                    "missing@example.com"
                );

            expect(response.status).toBe(404);

            expect(response.body).toEqual({
                error: "User not found",
            });
        });

        it("does not allow the owner to add themselves as a member", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response =
                await addProjectMember(
                    owner.token,
                    project.id,
                    owner.user.email
                );

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Project owner is already part of the project",
            });
        });

        it("returns 409 when the user is already a project member", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const response =
                await addProjectMember(
                    owner.token,
                    project.id,
                    member.user.email
                );

            expect(response.status).toBe(409);

            expect(response.body).toEqual({
                error: "User is already a project member",
            });
        });

        it("does not allow a project member to add another member", async () => {
            const {
                member,
                project,
            } = await createProjectWithMember();

            const thirdUser =
                await registerThirdUser();

            const response =
                await addProjectMember(
                    member.token,
                    project.id,
                    thirdUser.user.email
                );

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "Only the project owner can add members",
            });
        });

    });

    describe("DELETE /api/projects/:projectId/members/:userId", () => {

        it("allows the owner to remove a project member", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const response =
                await removeProjectMember(
                    owner.token,
                    project.id,
                    member.user.id
                );

            expect(response.status).toBe(204);

            const result = await pool.query(
                `
                    SELECT 1
                    FROM project_members
                    WHERE
                        project_id = $1
                        AND user_id = $2
                `,
                [
                    project.id,
                    member.user.id,
                ]
            );

            expect(result.rowCount).toBe(0);
        });

        it("does not allow a project member to remove another member", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const thirdUser =
                await registerThirdUser();

            const addThirdUserResponse =
                await addProjectMember(
                    owner.token,
                    project.id,
                    thirdUser.user.email
                );

            expect(
                addThirdUserResponse.status
            ).toBe(201);

            const response =
                await removeProjectMember(
                    member.token,
                    project.id,
                    thirdUser.user.id
                );

            expect(response.status).toBe(403);

            expect(response.body).toEqual({
                error: "Only the project owner can remove members",
            });

            const result = await pool.query(
                `
                    SELECT 1
                    FROM project_members
                    WHERE
                        project_id = $1
                        AND user_id = $2
                `,
                [
                    project.id,
                    thirdUser.user.id,
                ]
            );

            expect(result.rowCount).toBe(1);
        });

        it("returns 404 when the user is not a project member", async () => {
            const owner = await registerOwner();

            const outsider =
                await registerMember();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response =
                await removeProjectMember(
                    owner.token,
                    project.id,
                    outsider.user.id
                );

            expect(response.status).toBe(404);

            expect(response.body).toEqual({
                error: "Project member not found",
            });
        });

        it("returns 400 when user id is invalid", async () => {
            const owner = await registerOwner();

            const {
                project,
            } = await createProject(
                owner.token
            );

            const response =
                await removeProjectMember(
                    owner.token,
                    project.id,
                    "invalid"
                );

            expect(response.status).toBe(400);

            expect(response.body).toEqual({
                error: "Invalid user id",
            });
        });

        it("unassigns tasks assigned to a removed member", async () => {
            const {
                owner,
                member,
                project,
            } = await createProjectWithMember();

            const taskResult = await pool.query(
                `
                    INSERT INTO tasks (
                        project_id,
                        created_by,
                        assigned_to,
                        title,
                        description,
                        status,
                        priority
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7
                    )
                    RETURNING id
                `,
                [
                    project.id,
                    owner.user.id,
                    member.user.id,
                    "Assigned Task",
                    "",
                    "TODO",
                    "MEDIUM",
                ]
            );

            const taskId =
                taskResult.rows[0].id;

            const response =
                await removeProjectMember(
                    owner.token,
                    project.id,
                    member.user.id
                );

            expect(response.status).toBe(204);

            const updatedTaskResult =
                await pool.query(
                    `
                        SELECT
                            assigned_to
                        FROM tasks
                        WHERE id = $1
                    `,
                    [taskId]
                );

            expect(
                updatedTaskResult.rows[0]
                    .assigned_to
            ).toBeNull();
        });

    });

});