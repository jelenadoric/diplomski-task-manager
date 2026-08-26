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
    getDashboard,
} = require("./helpers/dashboard");

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

const setTaskDueDateRelativeToToday = async (
    taskId,
    days
) => {
    await pool.query(
        `
            UPDATE tasks
            SET due_date = CURRENT_DATE + $2::int
            WHERE id = $1
        `,
        [
            taskId,
            days,
        ]
    );
};

const createDashboardFixture = async () => {
    const owner = await registerOwner();
    const member = await registerMember();
    const outsider = await registerOutsider();

    const {
        project: ownerProject,
    } = await createProject(
        owner.token,
        {
            name: "Owner Project",
        }
    );

    const addMemberResponse =
        await addProjectMember(
            owner.token,
            ownerProject.id,
            member.user.email
        );

    expect(
        addMemberResponse.status
    ).toBe(201);

    const {
        project: memberProject,
    } = await createProject(
        member.token,
        {
            name: "Member Project",
        }
    );

    const addOwnerResponse =
        await addProjectMember(
            member.token,
            memberProject.id,
            owner.user.email
        );

    expect(
        addOwnerResponse.status
    ).toBe(201);

    const {
        project: outsiderProject,
    } = await createProject(
        outsider.token,
        {
            name: "Outsider Project",
        }
    );

    const {
        task: overdueOwnerTask,
    } = await createTask(
        owner.token,
        ownerProject.id,
        {
            title: "Overdue owner task",
            status: "TODO",
            priority: "HIGH",
            assigned_to: owner.user.id,
        }
    );

    await setTaskDueDateRelativeToToday(
        overdueOwnerTask.id,
        -1
    );

    const {
        task: memberAssignedTask,
    } = await createTask(
        owner.token,
        ownerProject.id,
        {
            title: "Member assigned task",
            status: "IN_PROGRESS",
            priority: "MEDIUM",
            assigned_to: member.user.id,
        }
    );

    await setTaskDueDateRelativeToToday(
        memberAssignedTask.id,
        2
    );

    const {
        task: doneOwnerTask,
    } = await createTask(
        owner.token,
        ownerProject.id,
        {
            title: "Done owner task",
            status: "DONE",
            priority: "LOW",
            assigned_to: owner.user.id,
        }
    );

    await setTaskDueDateRelativeToToday(
        doneOwnerTask.id,
        -5
    );

    const {
        task: unassignedTask,
    } = await createTask(
        owner.token,
        ownerProject.id,
        {
            title: "Unassigned task",
            status: "TODO",
            priority: "MEDIUM",
            assigned_to: null,
        }
    );

    const {
        task: memberProjectOwnerTask,
    } = await createTask(
        member.token,
        memberProject.id,
        {
            title: "Task from member project",
            status: "IN_PROGRESS",
            priority: "HIGH",
            assigned_to: owner.user.id,
        }
    );

    await setTaskDueDateRelativeToToday(
        memberProjectOwnerTask.id,
        1
    );

    const {
        task: doneMemberTask,
    } = await createTask(
        member.token,
        memberProject.id,
        {
            title: "Done member task",
            status: "DONE",
            priority: "LOW",
            assigned_to: member.user.id,
        }
    );

    const {
        task: outsiderTask,
    } = await createTask(
        outsider.token,
        outsiderProject.id,
        {
            title: "Outsider task",
            status: "TODO",
            priority: "HIGH",
            assigned_to: outsider.user.id,
        }
    );

    await setTaskDueDateRelativeToToday(
        outsiderTask.id,
        -10
    );

    return {
        owner,
        member,
        outsider,
        ownerProject,
        memberProject,
        outsiderProject,
        tasks: {
            overdueOwnerTask,
            memberAssignedTask,
            doneOwnerTask,
            unassignedTask,
            memberProjectOwnerTask,
            doneMemberTask,
            outsiderTask,
        },
    };
};

describe("Dashboard API", () => {

    describe("GET /api/dashboard", () => {

        it("returns 401 when the user is not authenticated", async () => {
            const response = await request(app)
                .get("/api/dashboard");

            expect(response.status).toBe(401);
        });

        it("returns statistics only for projects accessible to the user", async () => {
            const {
                owner,
            } = await createDashboardFixture();

            const response =
                await getDashboard(
                    owner.token
                );

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    projects_count: 2,
                    tasks: {
                        total: 6,
                        todo: 2,
                        in_progress: 2,
                        done: 2,
                        overdue: 1,
                    },
                })
            );
        });

        it("does not include tasks from inaccessible projects", async () => {
            const {
                owner,
                tasks,
            } = await createDashboardFixture();

            const response =
                await getDashboard(
                    owner.token
                );

            expect(response.status).toBe(200);

            expect(
                response.body.assigned_tasks.find(
                    (task) =>
                        task.id ===
                        tasks.outsiderTask.id
                )
            ).toBeUndefined();

            expect(
                response.body.tasks.total
            ).toBe(6);
        });

        it("counts only unfinished past-due tasks as overdue", async () => {
            const {
                owner,
            } = await createDashboardFixture();

            const response =
                await getDashboard(
                    owner.token
                );

            expect(response.status).toBe(200);

            expect(
                response.body.tasks.overdue
            ).toBe(1);
        });

        it("returns only open tasks assigned to the authenticated user", async () => {
            const {
                owner,
                tasks,
            } = await createDashboardFixture();

            const response =
                await getDashboard(
                    owner.token
                );

            expect(response.status).toBe(200);

            const assignedTaskIds =
                response.body.assigned_tasks.map(
                    (task) => task.id
                );

            expect(assignedTaskIds).toEqual(
                expect.arrayContaining([
                    tasks.overdueOwnerTask.id,
                    tasks.memberProjectOwnerTask.id,
                ])
            );

            expect(assignedTaskIds).not.toContain(
                tasks.doneOwnerTask.id
            );

            expect(assignedTaskIds).not.toContain(
                tasks.memberAssignedTask.id
            );

            expect(assignedTaskIds).not.toContain(
                tasks.unassignedTask.id
            );

            expect(
                response.body.assigned_tasks
            ).toHaveLength(2);
        });

        it("includes assigned tasks from projects where the user is only a member", async () => {
            const {
                owner,
                memberProject,
                tasks,
            } = await createDashboardFixture();

            const response =
                await getDashboard(
                    owner.token
                );

            expect(response.status).toBe(200);

            const task =
                response.body.assigned_tasks.find(
                    (assignedTask) =>
                        assignedTask.id ===
                        tasks.memberProjectOwnerTask.id
                );

            expect(task).toEqual(
                expect.objectContaining({
                    id:
                        tasks.memberProjectOwnerTask
                            .id,
                    title:
                        "Task from member project",
                    project_name:
                        memberProject.name,
                    status:
                        "IN_PROGRESS",
                    priority:
                        "HIGH",
                })
            );
        });

        it("returns different assigned tasks for different project members", async () => {
            const {
                member,
                tasks,
            } = await createDashboardFixture();

            const response =
                await getDashboard(
                    member.token
                );

            expect(response.status).toBe(200);

            expect(response.body).toEqual(
                expect.objectContaining({
                    projects_count: 2,
                    tasks: {
                        total: 6,
                        todo: 2,
                        in_progress: 2,
                        done: 2,
                        overdue: 1,
                    },
                })
            );

            const assignedTaskIds =
                response.body.assigned_tasks.map(
                    (task) => task.id
                );

            expect(assignedTaskIds).toEqual([
                tasks.memberAssignedTask.id,
            ]);

            expect(assignedTaskIds).not.toContain(
                tasks.doneMemberTask.id
            );
        });

    });

});