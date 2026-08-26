import { Navigate } from "react-router-dom";

import { useAuth } from "../context/authContextBase";

function ProtectedRoute({ children }) {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="page-centered">
        <p>Učitavanje...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;