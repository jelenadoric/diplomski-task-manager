import { useAuth } from "../context/authContextBase";

function AppHeader() {
  const {
    user,
    logout,
  } = useAuth();

  return (
    <header className="app-header">
      <div>
        <h1>Task Manager</h1>

        <p>
          Prijavljen kao{" "}
          <strong>{user.username}</strong>
        </p>
      </div>

      <button
        type="button"
        className="secondary"
        onClick={logout}
      >
        Odjava
      </button>
    </header>
  );
}

export default AppHeader;