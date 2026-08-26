import {
    useEffect,
    useState,
} from "react";

import {
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
} from "../api/auth";

import { AuthContext } from "./authContextBase";

const TOKEN_STORAGE_KEY = "task-manager-token";

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser(token);

        setUser(currentUser);
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token]);

  const saveAuthentication = (data) => {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      data.token
    );

    setToken(data.token);
    setUser(data.user);
  };

  const login = async (credentials) => {
    const data = await loginRequest(credentials);

    saveAuthentication(data);
  };

  const register = async (form) => {
    const data = await registerRequest(form);

    saveAuthentication(data);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);

    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
