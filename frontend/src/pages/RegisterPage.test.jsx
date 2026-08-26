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

import RegisterPage from "./RegisterPage";
import { AuthContext } from "../context/authContextBase";

const renderRegisterPage = ({
  user = null,
  register = vi.fn(),
} = {}) => {
  render(
    <AuthContext.Provider
      value={{
        user,
        register,
      }}
    >
      <MemoryRouter
        initialEntries={["/register"]}
      >
        <Routes>
          <Route
            path="/register"
            element={<RegisterPage />}
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
    register,
  };
};

describe("RegisterPage", () => {
  it("submits registration data", async () => {
    const user = userEvent.setup();

    const register = vi
      .fn()
      .mockResolvedValue();

    renderRegisterPage({
      register,
    });

    await user.type(
      screen.getByLabelText(
        /korisničko ime|username/i
      ),
      "jelena"
    );

    await user.type(
      screen.getByLabelText(/email/i),
      "jelena@example.com"
    );

    await user.type(
      screen.getByLabelText(
        /lozinka|password/i
      ),
      "password123"
    );

    await user.click(
      screen.getByRole("button", {
        name: /registr|register/i,
      })
    );

    expect(register).toHaveBeenCalledWith({
      username: "jelena",
      email: "jelena@example.com",
      password: "password123",
    });
  });

  it("navigates to dashboard after successful registration", async () => {
    const user = userEvent.setup();

    const register = vi
      .fn()
      .mockResolvedValue();

    renderRegisterPage({
      register,
    });

    await user.type(
      screen.getByLabelText(
        /korisničko ime|username/i
      ),
      "jelena"
    );

    await user.type(
      screen.getByLabelText(/email/i),
      "jelena@example.com"
    );

    await user.type(
      screen.getByLabelText(
        /lozinka|password/i
      ),
      "password123"
    );

    await user.click(
      screen.getByRole("button", {
        name: /registr|register/i,
      })
    );

    expect(
      await screen.findByText(
        "Dashboard page"
      )
    ).toBeInTheDocument();
  });

  it("shows an error when registration fails", async () => {
    const user = userEvent.setup();

    const register = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Username or email already exists"
        )
      );

    renderRegisterPage({
      register,
    });

    await user.type(
      screen.getByLabelText(
        /korisničko ime|username/i
      ),
      "jelena"
    );

    await user.type(
      screen.getByLabelText(/email/i),
      "jelena@example.com"
    );

    await user.type(
      screen.getByLabelText(
        /lozinka|password/i
      ),
      "password123"
    );

    await user.click(
      screen.getByRole("button", {
        name: /registr|register/i,
      })
    );

    expect(
      await screen.findByText(
        "Username or email already exists"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "Dashboard page"
      )
    ).not.toBeInTheDocument();
  });

  it("does not submit a password shorter than 8 characters", async () => {
    const user = userEvent.setup();

    const register = vi.fn();

    renderRegisterPage({
      register,
    });

    await user.type(
      screen.getByLabelText(
        /korisničko ime|username/i
      ),
      "jelena"
    );

    await user.type(
      screen.getByLabelText(/email/i),
      "jelena@example.com"
    );

    await user.type(
      screen.getByLabelText(
        /lozinka|password/i
      ),
      "short"
    );

    await user.click(
      screen.getByRole("button", {
        name: /registr|register/i,
      })
    );

    expect(
      register
    ).not.toHaveBeenCalled();
  });

  it("redirects an already authenticated user to dashboard", async () => {
    renderRegisterPage({
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