import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:4000/api/tasks";

function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Greška pri dohvaćanju zadataka.");
      }

      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Naziv zadatka je obavezan.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error("Greška pri dodavanju zadatka.");
      }

      setTitle("");
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>Task Manager</h1>
        <p className="subtitle">
          Diplomski projekt — frontend + backend + PostgreSQL
        </p>

        <form onSubmit={handleSubmit} className="task-form">
          <input
            type="text"
            placeholder="Unesi novi zadatak"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "Dodavanje..." : "Dodaj"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p>Učitavanje zadataka...</p>
        ) : tasks.length === 0 ? (
          <p>Nema zadataka.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li key={task.id} className="task-item">
                <span>{task.title}</span>
                <span className={task.completed ? "status done" : "status pending"}>
                  {task.completed ? "Dovršeno" : "Aktivno"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;