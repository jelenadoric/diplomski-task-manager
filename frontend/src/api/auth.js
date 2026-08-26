import { apiRequest } from "./client";

export const register = async ({
  username,
  email,
  password,
}) => {
  return apiRequest("/api/auth/register", {
    method: "POST",
    body: {
      username,
      email,
      password,
    },
  });
};

export const login = async ({
  email,
  password,
}) => {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: {
      email,
      password,
    },
  });
};

export const getCurrentUser = async (token) => {
  return apiRequest("/api/auth/me", {
    token,
  });
};