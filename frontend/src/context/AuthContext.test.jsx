import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
} from "../api/auth";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./authContextBase";

vi.mock("../api/auth", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

const TEST_USER = {
  id: 1,
  username: "jelena",
  email: "jelena@example.com",
};

const TestConsumer = () => {
  const {
    token,
    user,
    loading,
    login,
    register,
    logout,
  } = useAuth();

  return (
    <div>
      <span data-testid="loading">
        {String(loading)}
      </span>

      <span data-testid="token">
        {token || "none"}
      </span>

      <span data-testid="user">
        {user?.username || "none"}
      </span>

      <button
        type="button"
        onClick={() =>
          login({
            email: "jelena@example.com",
            password: "password123",
          })
        }
      >
        Login
      </button>

      <button
        type="button"
        onClick={() =>
          register({
            username: "jelena",
            email: "jelena@example.com",
            password: "password123",
          })
        }
      >
        Register
      </button>

      <button
        type="button"
        onClick={logout}
      >
        Logout
      </button>
    </div>
  );
};

const renderAuthProvider = () => {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
};

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("starts unauthenticated when there is no stored token", async () => {
    renderAuthProvider();

    expect(
      await screen.findByTestId("loading")
    ).toHaveTextContent("false");

    expect(
      screen.getByTestId("token")
    ).toHaveTextContent("none");

    expect(
      screen.getByTestId("user")
    ).toHaveTextContent("none");

    expect(
      getCurrentUser
    ).not.toHaveBeenCalled();
  });

  it("restores the authenticated user from a stored token", async () => {
    localStorage.setItem(
      "task-manager-token",
      "stored-token"
    );

    getCurrentUser.mockResolvedValue(
      TEST_USER
    );

    renderAuthProvider();

    await waitFor(() => {
        expect(
            screen.getByTestId("user")
        ).toHaveTextContent("jelena");
    });

    expect(
      screen.getByTestId("token")
    ).toHaveTextContent("stored-token");

    await waitFor(() => {
        expect(
            screen.getByTestId("loading")
        ).toHaveTextContent("false");
    });

    expect(
      getCurrentUser
    ).toHaveBeenCalledWith(
      "stored-token"
    );
  });

  it("removes an invalid stored token", async () => {
    localStorage.setItem(
      "task-manager-token",
      "invalid-token"
    );

    getCurrentUser.mockRejectedValue(
      new Error("Invalid token")
    );

    renderAuthProvider();

    await waitFor(() => {
        expect(
            screen.getByTestId("loading")
        ).toHaveTextContent("false");

        expect(
            screen.getByTestId("token")
        ).toHaveTextContent("none");

        expect(
            screen.getByTestId("user")
        ).toHaveTextContent("none");
    });

    expect(
      localStorage.getItem(
        "task-manager-token"
      )
    ).toBeNull();
  });

  it("stores authentication after login", async () => {
    const user = userEvent.setup();

    loginRequest.mockResolvedValue({
      token: "login-token",
      user: TEST_USER,
    });

    getCurrentUser.mockResolvedValue(
      TEST_USER
    );

    renderAuthProvider();

    await screen.findByText("Login");

    await user.click(
      screen.getByRole("button", {
        name: "Login",
      })
    );

    await waitFor(() => {
        expect(
            screen.getByTestId("user")
        ).toHaveTextContent("jelena");

        expect(
            screen.getByTestId("token")
        ).toHaveTextContent("login-token");
    });

    expect(
      localStorage.getItem(
        "task-manager-token"
      )
    ).toBe("login-token");

    expect(
      loginRequest
    ).toHaveBeenCalledWith({
      email: "jelena@example.com",
      password: "password123",
    });
  });

  it("stores authentication after registration", async () => {
    const user = userEvent.setup();

    registerRequest.mockResolvedValue({
      token: "register-token",
      user: TEST_USER,
    });

    getCurrentUser.mockResolvedValue(
      TEST_USER
    );

    renderAuthProvider();

    await user.click(
      screen.getByRole("button", {
        name: "Register",
      })
    );

   await waitFor(() => {
        expect(
            screen.getByTestId("user")
        ).toHaveTextContent("jelena");

        expect(
            screen.getByTestId("token")
        ).toHaveTextContent("register-token");
    });

    expect(
      localStorage.getItem(
        "task-manager-token"
      )
    ).toBe("register-token");

    expect(
      registerRequest
    ).toHaveBeenCalledWith({
      username: "jelena",
      email: "jelena@example.com",
      password: "password123",
    });
  });

  it("clears authentication on logout", async () => {
    const user = userEvent.setup();

    localStorage.setItem(
      "task-manager-token",
      "stored-token"
    );

    getCurrentUser.mockResolvedValue(
      TEST_USER
    );

    renderAuthProvider();

    await waitFor(() => {
        expect(
            screen.getByTestId("user")
        ).toHaveTextContent("jelena");
    });

    await user.click(
      screen.getByRole("button", {
        name: "Logout",
      })
    );

    await waitFor(() => {
        expect(
            screen.getByTestId("user")
        ).toHaveTextContent("none");

        expect(
            screen.getByTestId("token")
        ).toHaveTextContent("none");
    });

    expect(
      localStorage.getItem(
        "task-manager-token"
      )
    ).toBeNull();
  });
});