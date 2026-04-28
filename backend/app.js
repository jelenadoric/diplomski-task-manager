const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
    try{
        await pool.query("SELECT 1");
        res.status(200).json({ status: "ok" });
    } catch(error){
        res.status(500).json({ status: "error", message: error.message });
    }
});

app.get("/api/tasks", async (req, res) => {
    try{
        const result = await pool.query(
            "SELECT id, title, completed, created_at FROM tasks ORDER BY id ASC"
        );
        res.status(200).json(result.rows);
    } catch(error){
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/tasks", async (req, res) => {
    const {title} = req.body;

    if(!title || !title.trim()){
        return res.status(400).json({ error: "Title is required"});
    }

    try{
        const result = await pool.query(
            "INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, completed, created_at",
            [title]
        );
        res.status(201).json(result.rows[0]);
    } catch(error){
        res.status(500).json({ error: error.message });
    }
});

module.exports = app;