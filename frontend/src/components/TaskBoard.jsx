import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createTask,
  deleteTask,
  getProjectTasks,
  updateTask,
} from "../api/tasks";
import TaskComments from "./TaskComments";

const TASK_STATUSES = [
  {
    value: "TODO",
    label: "TODO",
  },
  {
    value: "IN_PROGRESS",
    label: "U tijeku",
  },
  {
    value: "DONE",
    label: "Dovršeno",
  },
];

const TASK_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
];

const EMPTY_TASK_FORM = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  assigned_to: "",
  due_date: "",
};

function TaskBoard({
  token,
  projectId,
  members,
}) {
  const [tasks, setTasks] = useState([]);

  const [taskForm, setTaskForm] = useState(
    EMPTY_TASK_FORM
  );

  const [selectedTaskId, setSelectedTaskId] =
    useState(null);

  const [editForm, setEditForm] = useState(
    EMPTY_TASK_FORM
  );

  const [assigneeFilter, setAssigneeFilter] =
    useState("ALL");

  const [priorityFilter, setPriorityFilter] =
    useState("ALL");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedTask = useMemo(
    () =>
      tasks.find(
        (task) => task.id === selectedTaskId
      ) || null,
    [tasks, selectedTaskId]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesPriority =
        priorityFilter === "ALL" ||
        task.priority === priorityFilter;

      let matchesAssignee = true;

      if (assigneeFilter === "UNASSIGNED") {
        matchesAssignee =
          task.assigned_to === null;
      } else if (assigneeFilter !== "ALL") {
        matchesAssignee =
          String(task.assigned_to) ===
          assigneeFilter;
      }

      return (
        matchesPriority &&
        matchesAssignee
      );
    });
  }, [
    tasks,
    priorityFilter,
    assigneeFilter,
  ]);

  const tasksByStatus = useMemo(
    () => ({
      TODO: filteredTasks.filter(
        (task) => task.status === "TODO"
      ),
      IN_PROGRESS: filteredTasks.filter(
        (task) =>
          task.status === "IN_PROGRESS"
      ),
      DONE: filteredTasks.filter(
        (task) => task.status === "DONE"
      ),
    }),
    [filteredTasks]
  );

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getProjectTasks(
        token,
        projectId
      );

      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getProjectTasks(
        token,
        projectId
    )
        .then((data) => {
            if (cancelled) {
                return;
            }

            setTasks(data);
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
        members,
    ]);

  const handleCreateFormChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setTaskForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

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

  const handleCreateTask = async (event) => {
    event.preventDefault();

    if (!taskForm.title.trim()) {
      setError("Naziv taska je obavezan.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      await createTask(
        token,
        projectId,
        {
          title: taskForm.title,
          description:
            taskForm.description,
          status: taskForm.status,
          priority: taskForm.priority,
          assigned_to:
            taskForm.assigned_to
              ? Number(
                  taskForm.assigned_to
                )
              : null,
          due_date:
            taskForm.due_date || null,
        }
      );

      setTaskForm(EMPTY_TASK_FORM);

      await loadTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectTask = (task) => {
    setSelectedTaskId(task.id);

    setEditForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigned_to:
        task.assigned_to !== null
          ? String(task.assigned_to)
          : "",
      due_date: task.due_date || "",
    });

    setError("");
  };

  const handleCloseTask = () => {
    setSelectedTaskId(null);
    setEditForm(EMPTY_TASK_FORM);
    setError("");
  };

  const handleSaveTask = async (event) => {
    event.preventDefault();

    if (!selectedTask) {
      return;
    }

    if (!editForm.title.trim()) {
      setError("Naziv taska je obavezan.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await updateTask(
        token,
        selectedTask.id,
        {
          title: editForm.title,
          description:
            editForm.description,
          status: editForm.status,
          priority: editForm.priority,
          assigned_to:
            editForm.assigned_to
              ? Number(
                  editForm.assigned_to
                )
              : null,
          due_date:
            editForm.due_date || null,
        }
      );

      await loadTasks();

      setSelectedTaskId(null);
      setEditForm(EMPTY_TASK_FORM);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) {
      return;
    }

    const confirmed = window.confirm(
      "Želiš li sigurno obrisati ovaj task?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await deleteTask(
        token,
        selectedTask.id
      );

      setSelectedTaskId(null);
      setEditForm(EMPTY_TASK_FORM);

      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleClearFilters = () => {
    setAssigneeFilter("ALL");
    setPriorityFilter("ALL");
  };

  const formatDueDate = (dueDate) => {
    if (!dueDate) {
      return "Bez roka";
    }

    return new Intl.DateTimeFormat(
      "hr-HR"
    ).format(
      new Date(`${dueDate}T00:00:00`)
    );
  };

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <h2>Taskovi</h2>

        <span>
          {filteredTasks.length} od{" "}
          {tasks.length}
        </span>
      </div>

      {error && (
        <p className="error page-error">
          {error}
        </p>
      )}

      <div className="task-filters card">
        <div className="task-filter-fields">
          <label>
            Assignee
            <select
              value={assigneeFilter}
              onChange={(event) =>
                setAssigneeFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                Svi
              </option>

              <option value="UNASSIGNED">
                Nije dodijeljeno
              </option>

              {members.map((member) => (
                <option
                  key={member.id}
                  value={member.id}
                >
                  {member.username}
                </option>
              ))}
            </select>
          </label>

          <label>
            Prioritet
            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                Sve
              </option>

              {TASK_PRIORITIES.map(
                (priority) => (
                  <option
                    key={priority}
                    value={priority}
                  >
                    {priority}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={handleClearFilters}
        >
          Očisti filtere
        </button>
      </div>

      {loading ? (
        <div className="card">
          <p>Učitavanje taskova...</p>
        </div>
      ) : (
        <div className="task-board">
          {TASK_STATUSES.map((status) => (
            <div
              key={status.value}
              className="task-column"
            >
              <div className="task-column-header">
                <h3>{status.label}</h3>

                <span>
                  {
                    tasksByStatus[
                      status.value
                    ].length
                  }
                </span>
              </div>

              <div className="task-column-content">
                {tasksByStatus[
                  status.value
                ].length === 0 ? (
                  <p className="empty-column">
                    Nema taskova.
                  </p>
                ) : (
                  tasksByStatus[
                    status.value
                  ].map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="task-card"
                      onClick={() =>
                        handleSelectTask(task)
                      }
                    >
                      <div className="task-card-header">
                        <strong>
                          {task.title}
                        </strong>

                        <span
                          className={`priority priority-${task.priority.toLowerCase()}`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      {task.description && (
                        <p>
                          {task.description}
                        </p>
                      )}

                      <div className="task-card-meta">
                        <span>
                          {task.assigned_to_username
                            ? `👤 ${task.assigned_to_username}`
                            : "Nije dodijeljeno"}
                        </span>

                        <span>
                          {formatDueDate(
                            task.due_date
                          )}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card task-create-card">
        <h2>Novi task</h2>

        <form
          className="task-form"
          onSubmit={handleCreateTask}
        >
          <label>
            Naziv
            <input
              type="text"
              name="title"
              value={taskForm.title}
              onChange={
                handleCreateFormChange
              }
              placeholder="Naziv taska"
            />
          </label>

          <label>
            Opis
            <textarea
              name="description"
              value={taskForm.description}
              onChange={
                handleCreateFormChange
              }
              placeholder="Opis taska"
            />
          </label>

          <div className="task-form-grid">
            <label>
              Status
              <select
                name="status"
                value={taskForm.status}
                onChange={
                  handleCreateFormChange
                }
              >
                {TASK_STATUSES.map(
                  (status) => (
                    <option
                      key={status.value}
                      value={status.value}
                    >
                      {status.label}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Prioritet
              <select
                name="priority"
                value={taskForm.priority}
                onChange={
                  handleCreateFormChange
                }
              >
                {TASK_PRIORITIES.map(
                  (priority) => (
                    <option
                      key={priority}
                      value={priority}
                    >
                      {priority}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Dodijeli korisniku
              <select
                name="assigned_to"
                value={
                  taskForm.assigned_to
                }
                onChange={
                  handleCreateFormChange
                }
              >
                <option value="">
                  Nije dodijeljeno
                </option>

                {members.map(
                  (member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.username}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Rok
              <input
                type="date"
                name="due_date"
                value={taskForm.due_date}
                onChange={
                  handleCreateFormChange
                }
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={creating}
          >
            {creating
              ? "Kreiranje..."
              : "Kreiraj task"}
          </button>
        </form>
      </div>

      {selectedTask && (
        <div className="card task-detail-card">
          <div className="section-header">
            <h2>Detalji taska</h2>

            <button
              type="button"
              className="secondary small-button"
              onClick={handleCloseTask}
            >
              Zatvori
            </button>
          </div>

          <div className="task-detail-info">
            <span>
              Kreirao:{" "}
              <strong>
                {
                  selectedTask.created_by_username
                }
              </strong>
            </span>
          </div>

          <form
            className="task-form"
            onSubmit={handleSaveTask}
          >
            <label>
              Naziv
              <input
                type="text"
                name="title"
                value={editForm.title}
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

            <div className="task-form-grid">
              <label>
                Status
                <select
                  name="status"
                  value={editForm.status}
                  onChange={
                    handleEditFormChange
                  }
                >
                  {TASK_STATUSES.map(
                    (status) => (
                      <option
                        key={status.value}
                        value={status.value}
                      >
                        {status.label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Prioritet
                <select
                  name="priority"
                  value={
                    editForm.priority
                  }
                  onChange={
                    handleEditFormChange
                  }
                >
                  {TASK_PRIORITIES.map(
                    (priority) => (
                      <option
                        key={priority}
                        value={priority}
                      >
                        {priority}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Dodijeli korisniku
                <select
                  name="assigned_to"
                  value={
                    editForm.assigned_to
                  }
                  onChange={
                    handleEditFormChange
                  }
                >
                  <option value="">
                    Nije dodijeljeno
                  </option>

                  {members.map(
                    (member) => (
                      <option
                        key={member.id}
                        value={member.id}
                      >
                        {member.username}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Rok
                <input
                  type="date"
                  name="due_date"
                  value={
                    editForm.due_date
                  }
                  onChange={
                    handleEditFormChange
                  }
                />
              </label>
            </div>

            <div className="button-group">
              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Spremanje..."
                  : "Spremi promjene"}
              </button>

              <button
                type="button"
                className="danger"
                onClick={
                  handleDeleteTask
                }
              >
                Obriši task
              </button>
            </div>
          </form>

          <TaskComments
                key={selectedTask.id}
                taskId={selectedTask.id}
            />
        </div>
      )}
    </section>
  );
}

export default TaskBoard;