import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  MemoryRouter,
} from "react-router-dom";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  getDashboard,
} from "../api/dashboard";
import {
  createProject,
  getProjects,
} from "../api/projects";
import { AuthContext } from "../context/authContextBase";
import DashboardPage from "./DashboardPage";

vi.mock("../api/dashboard", () => ({
  getDashboard: vi.fn(),
}));

vi.mock("../api/projects", () => ({
  getProjects: vi.fn(),
  createProject: vi.fn(),
}));

const TEST_USER = {
  id: 1,
  username: "jelena",
  email: "jelena@example.com",
};

const DASHBOARD_DATA = {
  projects_count: 2,
  tasks: {
    total: 5,
    todo: 2,
    in_progress: 1,
    done: 2,
    overdue: 1,
  },
  assigned_tasks: [
    {
      id: 10,
      title: "Backend tests",
      project_name: "Diplomski",
      status: "TODO",
      priority: "HIGH",
      due_date: "2026-09-10",
    },
    {
      id: 11,
      title: "Frontend tests",
      project_name: "Diplomski",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      due_date: null,
    },
  ],
};

const PROJECTS = [
  {
    id: 1,
    owner_id: 1,
    name: "Diplomski",
    description: "CI/CD eksperiment",
    owner_username: "jelena",
    is_owner: true,
  },
  {
    id: 2,
    owner_id: 2,
    name: "Drugi projekt",
    description: "",
    owner_username: "jelena2",
    is_owner: false,
  },
];

const renderDashboardPage = () => {
  return render(
    <AuthContext.Provider
      value={{
        token: "test-token",
        user: TEST_USER,
        logout: vi.fn(),
      }}
    >
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getDashboard.mockResolvedValue(
      DASHBOARD_DATA
    );

    getProjects.mockResolvedValue(
      PROJECTS
    );

    createProject.mockResolvedValue({
      id: 3,
      owner_id: 1,
      name: "Novi projekt",
      description: "Novi opis",
    });
  });

  it("loads dashboard data and projects", async () => {
    renderDashboardPage();

    expect(
      await screen.findByText(
        "Backend tests"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Frontend tests"
      )
    ).toBeInTheDocument();

    expect(
        screen.getByRole("link", {
            name: "Diplomski",
        })
    ).toBeInTheDocument();

    expect(
        screen.getByRole("link", {
            name: "Drugi projekt",
        })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Drugi projekt"
      )
    ).toBeInTheDocument();

    expect(
      getDashboard
    ).toHaveBeenCalledWith(
      "test-token"
    );

    expect(
      getProjects
    ).toHaveBeenCalledWith(
      "test-token"
    );
  });

  it("renders dashboard statistics", async () => {
    renderDashboardPage();

    await screen.findByText(
      "Backend tests"
    );

    expect(
      screen.getByText("5")
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("2")
        .length
    ).toBeGreaterThanOrEqual(1);

    expect(
      screen.getAllByText("1")
        .length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows an error when dashboard loading fails", async () => {
    getDashboard.mockRejectedValue(
      new Error(
        "Dashboard could not be loaded"
      )
    );

    renderDashboardPage();

    expect(
      await screen.findByText(
        "Dashboard could not be loaded"
      )
    ).toBeInTheDocument();
  });

  it("creates a new project", async () => {
    const user = userEvent.setup();

    renderDashboardPage();

    await screen.findByRole(
        "link",
        {
        name: "Diplomski",
        }
    );

    await user.type(
        screen.getByLabelText(
        /^naziv$/i
        ),
        "Novi projekt"
    );

    await user.type(
        screen.getByLabelText(
        /^opis$/i
        ),
        "Novi opis"
    );

    await user.click(
        screen.getByRole("button", {
        name: /kreiraj projekt/i,
        })
    );

    await waitFor(() => {
        expect(
        createProject
        ).toHaveBeenCalledWith(
        "test-token",
        {
            name: "Novi projekt",
            description: "Novi opis",
        }
        );
    });
    });

  it("reloads projects and dashboard after creating a project", async () => {
    const user = userEvent.setup();

    renderDashboardPage();

    await screen.findByRole(
        "link",
        {
            name: "Diplomski",
        }
    );

    await user.type(
      screen.getByLabelText(
        /^naziv$/i
      ),
      "Novi projekt"
    );

    await user.click(
      screen.getByRole("button", {
        name: /kreiraj projekt/i,
      })
    );

    await waitFor(() => {
      expect(
        createProject
      ).toHaveBeenCalledTimes(1);

      expect(
        getDashboard
      ).toHaveBeenCalledTimes(2);

      expect(
        getProjects
      ).toHaveBeenCalledTimes(2);
    });
  });
});