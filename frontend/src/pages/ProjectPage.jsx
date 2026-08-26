import {
  useEffect,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import AppHeader from "../components/AppHeader";
import {
  deleteProject,
  getProject,
  updateProject,
} from "../api/projects";
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
} from "../api/projectMembers";
import { useAuth } from "../context/authContextBase";
import TaskBoard from "../components/TaskBoard";

function ProjectPage() {
  const {
    projectId,
  } = useParams();

  const navigate = useNavigate();

  const {
    token,
  } = useAuth();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);

  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
  });

  const [memberEmail, setMemberEmail] =
    useState("");

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingMember, setAddingMember] =
    useState(false);

  const [error, setError] = useState("");

  const loadProject = async () => {
    const data = await getProject(
      token,
      projectId
    );

    setProject(data);

    setEditForm({
      name: data.name,
      description: data.description,
    });
  };

  const loadMembers = async () => {
    const data = await getProjectMembers(
      token,
      projectId
    );

    setMembers(data);
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([
        getProject(
            token,
            projectId
        ),
        getProjectMembers(
            token,
            projectId
        ),
    ])
        .then(([
            projectData,
            membersData,
        ]) => {
            if (cancelled) {
                return;
            }

            setProject(projectData);
            setMembers(membersData);

            setEditForm({
                name: projectData.name,
                description:
                    projectData.description,
            });

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
    }, [
        token,
        projectId,
    ]);

  const handleEditFormChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setEditForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleStartEditing = () => {
    setEditForm({
      name: project.name,
      description: project.description,
    });

    setEditing(true);
    setError("");
  };

  const handleCancelEditing = () => {
    setEditForm({
      name: project.name,
      description: project.description,
    });

    setEditing(false);
    setError("");
  };

  const handleSaveProject = async (event) => {
    event.preventDefault();

    if (!editForm.name.trim()) {
      setError("Naziv projekta je obavezan.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await updateProject(
        token,
        projectId,
        {
          name: editForm.name,
          description: editForm.description,
        }
      );

      await loadProject();

      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    const confirmed = window.confirm(
      "Želiš li sigurno obrisati ovaj projekt?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await deleteProject(
        token,
        projectId
      );

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();

    if (!memberEmail.trim()) {
      setError("Email korisnika je obavezan.");
      return;
    }

    try {
      setAddingMember(true);
      setError("");

      await addProjectMember(
        token,
        projectId,
        memberEmail
      );

      setMemberEmail("");

      await loadMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (
    userId
  ) => {
    try {
      setError("");

      await removeProjectMember(
        token,
        projectId,
        userId
      );

      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="app-page">
      <AppHeader />

      <main className="page-content">
        <Link
          to="/dashboard"
          className="back-link"
        >
          ← Natrag na dashboard
        </Link>

        {error && (
          <p className="error page-error">
            {error}
          </p>
        )}

        {loading ? (
          <div className="card">
            <p>Učitavanje projekta...</p>
          </div>
        ) : !project ? (
          <div className="card">
            <p>Projekt nije pronađen.</p>
          </div>
        ) : (
          <>
            <section className="dashboard-section">
              <div className="card">
                {editing ? (
                  <form
                    className="project-form"
                    onSubmit={handleSaveProject}
                  >
                    <label>
                      Naziv
                      <input
                        type="text"
                        name="name"
                        value={editForm.name}
                        onChange={
                          handleEditFormChange
                        }
                      />
                    </label>

                    <label>
                      Opis
                      <textarea
                        name="description"
                        value={
                          editForm.description
                        }
                        onChange={
                          handleEditFormChange
                        }
                      />
                    </label>

                    <div className="button-group">
                      <button
                        type="submit"
                        disabled={saving}
                      >
                        {saving
                          ? "Spremanje..."
                          : "Spremi"}
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        onClick={
                          handleCancelEditing
                        }
                      >
                        Odustani
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="project-detail-header">
                      <div>
                        <h2>
                          {project.name}
                        </h2>

                        <p>
                          {project.description ||
                            "Projekt nema opis."}
                        </p>

                        <small>
                          Owner:{" "}
                          {
                            project.owner_username
                          }
                        </small>
                      </div>

                      {project.is_owner && (
                        <div className="button-group">
                          <button
                            type="button"
                            onClick={
                              handleStartEditing
                            }
                          >
                            Uredi projekt
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={
                              handleDeleteProject
                            }
                          >
                            Obriši projekt
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="dashboard-section">
              <div className="section-header">
                <h2>Članovi projekta</h2>

                <span>
                  {members.length} ukupno
                </span>
              </div>

              <div className="card">
                <ul className="member-list">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="member-item"
                    >
                      <div>
                        <strong>
                          {member.username}
                        </strong>

                        <p>{member.email}</p>
                      </div>

                      <div className="member-actions">
                        <span
                          className={
                            member.is_owner
                              ? "project-role"
                              : "member-role"
                          }
                        >
                          {member.is_owner
                            ? "Owner"
                            : "Member"}
                        </span>

                        {project.is_owner &&
                          !member.is_owner && (
                            <button
                              type="button"
                              className="danger small-button"
                              onClick={() =>
                                handleRemoveMember(
                                  member.id
                                )
                              }
                            >
                              Ukloni
                            </button>
                          )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {project.is_owner && (
              <section className="dashboard-section">
                <div className="card">
                  <h2>Dodaj člana</h2>

                  <form
                    className="member-form"
                    onSubmit={handleAddMember}
                  >
                    <label>
                      Email korisnika
                      <input
                        type="email"
                        value={memberEmail}
                        onChange={(event) =>
                          setMemberEmail(
                            event.target.value
                          )
                        }
                        placeholder="korisnik@example.com"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={addingMember}
                    >
                      {addingMember
                        ? "Dodavanje..."
                        : "Dodaj člana"}
                    </button>
                  </form>
                </div>
              </section>
            )}
            <TaskBoard
                token={token}
                projectId={projectId}
                members={members}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default ProjectPage;