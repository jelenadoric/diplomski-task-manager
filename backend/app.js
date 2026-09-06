const express = require("express");
const cors = require("cors");

const pool = require("./db");
const authRoutes = require("./routes/auth");
const projectsRoutes = require("./routes/projects");
const projectMembersRoutes = require("./routes/projectMembers");
const projectTasksRoutes = require("./routes/projectTasks");
const tasksRoutes = require("./routes/tasks");
const taskCommentsRoutes = require("./routes/taskComments");
const commentsRoutes = require("./routes/comments");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

app.use(cors());
app.use(express.json());

app.get("api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            status: "ok",
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "error",
        });
    }
});

app.use("/api/auth", authRoutes);

app.use(
    "/api/projects/:projectId/members",
    projectMembersRoutes
);

app.use(
    "/api/projects/:projectId/tasks",
    projectTasksRoutes
);

app.use(
    "/api/tasks/:taskId/comments",
    taskCommentsRoutes
);

app.use("/api/projects", projectsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/dashboard", dashboardRoutes);

module.exports = app;