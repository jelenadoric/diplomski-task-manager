import { useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/authContextBase";

function RegisterPage() {
  const navigate = useNavigate();

  const {
    user,
    register,
  } = useAuth();

  const [form, setForm] = useState({
    username: "",
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

    if (!form.username.trim()) {
      setError("Korisničko ime je obavezno.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email je obavezan.");
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Lozinka mora sadržavati barem 8 znakova."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await register({
        username: form.username,
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
        <h1>Registracija</h1>

        <p className="subtitle">
          Kreiraj Task Manager račun
        </p>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <label>
            Korisničko ime
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
            />
          </label>

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
              ? "Registracija..."
              : "Registriraj se"}
          </button>
        </form>

        <p className="auth-link">
          Već imaš račun?{" "}
          <Link to="/login">
            Prijavi se
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;