import { useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/authContextBase";

function LoginPage() {
  const navigate = useNavigate();

  const {
    user,
    login,
  } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.email.trim() || !form.password) {
      setError("Email i lozinka su obavezni.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await login({
        email: form.email,
        password: form.password,
      });

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Prijava</h1>

        <p className="subtitle">
          Prijavi se u Task Manager
        </p>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
            />
          </label>

          <label>
            Lozinka
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
            />
          </label>

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Prijava..."
              : "Prijavi se"}
          </button>
        </form>

        <p className="auth-link">
          Nemaš račun?{" "}
          <Link to="/register">
            Registriraj se
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;