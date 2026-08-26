const request = require("supertest");

const app = require("../app");

describe("GET /health", () => {
    it("returns 200 when the database is available", async () => {
        const response = await request(app)
            .get("/health");

        expect(response.status).toBe(200);

        expect(response.body).toEqual({
            status: "ok",
        });
    });
});