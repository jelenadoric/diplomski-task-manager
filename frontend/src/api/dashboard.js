import { apiRequest } from "./client";

export const getDashboard = async (token) => {
  return apiRequest("/api/dashboard", {
    token,
  });
};