import {
  useEffect,
  useState,
} from "react";

import AppHeader from "../components/AppHeader";
import { getDashboard } from "../api/dashboard";
import {
  createProject,
  getProjects,
} from "../api/projects";
import { useAuth } from "../context/authContextBase";
import { Link } from "react-router-dom";

const EMPTY_PROJECT_FORM = {
  name: "",
  description: "",
};

function DashboardPage() {
  const {
    token,
  } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [projects, setProjects] = useState([]);

  const [projectForm, setProjectForm] = useState(
    EMPTY_PROJECT_FORM
  );

  const [loading, setLoading] = useState(true);
  const [creatingProject, setCreatingProject] =
    useState(false);

  const [error, setError] = useState("");

  const loadDashboard = async () => {
    const data = await getDashboard(token);

    setDashboard(data);
  };

  const loadProjects = async () => {
    const data = await getProjects(token);

    setProjects(data);
  };
  useEffect(() => {
        let cancelled = false;

        Promise.all([
            getDashboard(token),
            getProjects(token),
        ])
            .then(([
                dashboardData,
                projectsData,
            ]) => {
                if (cancelled) {
                    return;
                }

                setDashboard(dashboardData);
                setProjects(projectsData);
                setError("");
            })
            .catch((err) => {
                if (cancelled) {
                    return;
                }

                setError(err.message);
            })
            .finally(() => {
                if (cancelled) {
                    return;
                }

                setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [token]);

  const handleProjectFormChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setProjectForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();

    if (!projectForm.name.trim()) {
      setError("Naziv projekta je obavezan.");
      return;
    }

   try {
    setCreatingProject(true);
    setError("");

    await createProject(
        token,
        {
            name: projectForm.name,
            description: projectForm.description,
        }
    );

    setProjectForm(EMPTY_PROJECT_FORM);

    await Promise.all([
        loadDashboard(),
        loadProjects(),
    ]);
    } catch (err) {
        setError(err.message);
    } finally {
        setCreatingProject(false);
    }
  };

  return (
    <div className="app-page">
      <AppHeader />

      <main className="page-content">
        {error && (
          <p className="error page-error">
            {error}
          </p>
        )}

        {loading ? (
          <div className="card">
            <p>Učitavanje dashboarda...</p>
          </div>
        ) : dashboard ? (
          <>
            <section className="dashboard-section">
              <h2>Dashboard</h2>

              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">
                    Projekti
                  </span>

                  <strong className="stat-value">
                    {dashboard.projects_count}
                  </strong>
                </div>

                <div className="stat-card">
                  <span className="stat-label">
                    Taskovi
                  </span>

                  <strong className="stat-value">
                    {dashboard.tasks.total}
                  </strong>
                </div>

                <div className="stat-card">
                  <span className="stat-label">
                    TODO
                  </span>

                  <strong className="stat-value">
                    {dashboard.tasks.todo}
                  </strong>
                </div>

                <div className="stat-card">
                  <span className="stat-label">
                    U tijeku
                  </span>

                  <strong className="stat-value">
                    {dashboard.tasks.in_progress}
                  </strong>
                </div>

                <div className="stat-card">
                  <span className="stat-label">
                    Dovršeni
                  </span>

                  <strong className="stat-value">
                    {dashboard.tasks.done}
                  </strong>
                </div>

                <div className="stat-card">
                  <span className="stat-label">
                    Prekoračeni
                  </span>

                  <strong className="stat-value">
                    {dashboard.tasks.overdue}
                  </strong>
                </div>
              </div>
            </section>

            <section className="dashboard-section">
              <h2>Moji dodijeljeni taskovi</h2>

              <div className="card">
                {dashboard.assigned_tasks.length === 0 ? (
                  <p>
                    Nemaš otvorenih dodijeljenih taskova.
                  </p>
                ) : (
                  <ul className="assigned-task-list">
                    {dashboard.assigned_tasks.map(
                      (task) => (
                        <li
                          key={task.id}
                          className="assigned-task-item"
                        >
                          <div>
                            <strong>
                              {task.title}
                            </strong>

                            <p>
                              {task.project_name}
                            </p>
                          </div>

                          <div className="task-meta">
                            <span
                              className={`priority priority-${task.priority.toLowerCase()}`}
                            >
                              {task.priority}
                            </span>

                            <span>
                              {task.status}
                            </span>

                            <span>
                              {task.due_date
                                ? `Rok: ${task.due_date}`
                                : "Bez roka"}
                            </span>
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-header">
                <h2>Projekti</h2>

                <span>
                  {projects.length} ukupno
                </span>
              </div>

              {projects.length === 0 ? (
                <div className="card">
                  <p>
                    Još nemaš nijedan projekt.
                  </p>
                </div>
              ) : (
                <div className="projects-grid">
                  {projects.map((project) => (
                    <article
                      key={project.id}
                      className="project-card"
                    >
                      <div className="project-card-header">
                        <h3>
                            <Link
                                to={`/projects/${project.id}`}
                                className="project-link"
                            >
                                {project.name}
                            </Link>
                        </h3>

                        <span className="project-role">
                          {project.is_owner
                            ? "Owner"
                            : "Member"}
                        </span>
                      </div>

                      <p>
                        {project.description ||
                          "Projekt nema opis."}
                      </p>

                      <small>
                        Owner:{" "}
                        {project.owner_username}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="dashboard-section">
              <div className="card">
                <h2>Novi projekt</h2>

                <form
                  className="project-form"
                  onSubmit={handleCreateProject}
                >
                  <label>
                    Naziv
                    <input
                      type="text"
                      name="name"
                      value={projectForm.name}
                      onChange={
                        handleProjectFormChange
                      }
                      placeholder="Naziv projekta"
                    />
                  </label>

                  <label>
                    Opis
                    <textarea
                      name="description"
                      value={
                        projectForm.description
                      }
                      onChange={
                        handleProjectFormChange
                      }
                      placeholder="Kratki opis projekta"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={creatingProject}
                  >
                    {creatingProject
                      ? "Kreiranje..."
                      : "Kreiraj projekt"}
                  </button>
                </form>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default DashboardPage;