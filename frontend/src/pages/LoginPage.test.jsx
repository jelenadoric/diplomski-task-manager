import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LoginPage from "./LoginPage";
import { AuthContext } from "../context/authContextBase";

const renderLoginPage = ({
  user = null,
  login = vi.fn(),
} = {}) => {
  render(
    <AuthContext.Provider
      value={{
        user,
        login,
      }}
    >
      <MemoryRouter
        initialEntries={["/login"]}
      >
        <Routes>
          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/dashboard"
            element={
              <div>
                Dashboard page
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

  return {
    login,
  };
};

describe("LoginPage", () => {
  it("submits email and password", async () => {
    const user = userEvent.setup();

    const login = vi
      .fn()
      .mockResolvedValue();

    renderLoginPage({
      login,
    });

    await user.type(
      screen.getByLabelText(/email/i),
      "jelena@example.com"
    );

    await user.type(
      screen.getByLabelText(/lozinka|password/i),
      "password123"
    );

    await user.click(
      screen.getByRole("button", {
        name: /prijav|login/i,
      })
    );

    expect(login).toHaveBeenCalledWith({
      email: "jelena@example.com",
      password: "password123",
    });
  });

  it("navigates to dashboard after successful login", async () => {
    const user = userEvent.setup();

    const login = vi
      .fn()
      .mockResolvedValue();

    renderLoginPage({
      login,
    });

    await user.type(
      screen.getByLabelText(/email/i),
      "jelena@example.com"
    );

    await user.type(
      screen.getByLabelText(/lozinka|password/i),
      "password123"
    );

    await user.click(
      screen.getByRole("button", {
        name: /prijav|login/i,
      })
    );

    expect(
      await screen.findByText(
        "Dashboard page"
      )
    ).toBeInTheDocument();
  });

  it("shows an error when login fails", async () => {
    const user = userEvent.setup();

    const login = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Invalid email or password"
        )
      );

    renderLoginPage({
      login,
    });

    await user.type(
      screen.getByLabelText(/email/i),
      "jelena@example.com"
    );

    await user.type(
      screen.getByLabelText(/lozinka|password/i),
      "wrong-password"
    );

    await user.click(
      screen.getByRole("button", {
        name: /prijav|login/i,
      })
    );

    expect(
      await screen.findByText(
        "Invalid email or password"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "Dashboard page"
      )
    ).not.toBeInTheDocument();
  });

  it("redirects an already authenticated user to dashboard", async () => {
    renderLoginPage({
      user: {
        id: 1,
        username: "jelena",
        email: "jelena@example.com",
      },
    });

    expect(
      await screen.findByText(
        "Dashboard page"
      )
    ).toBeInTheDocument();
  });
});