const request = require("supertest");
const app = require("../app");

jest.mock("../db", () => ({
  query: jest.fn(),
}));

const pool = require("../db");

describe("Task API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /health should return ok", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app).get("/health");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  test("GET /api/tasks should return task list", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          title: "Test task",
          completed: false,
          created_at: "2026-04-28T00:00:00.000Z",
        },
      ],
    });

    const response = await request(app).get("/api/tasks");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].title).toBe("Test task");
  });

  test("POST /api/tasks should return 400 if title is missing", async () => {
    const response = await request(app).post("/api/tasks").send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "Title is required" });
  });
});