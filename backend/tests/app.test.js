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
});