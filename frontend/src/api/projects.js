import { apiRequest } from "./client";

export const getProjects = async (token) => {
  return apiRequest("/api/projects", {
    token,
  });
};

export const getProject = async (
  token,
  projectId
) => {
  return apiRequest(`/api/projects/${projectId}`, {
    token,
  });
};

export const createProject = async (
  token,
  project
) => {
  return apiRequest("/api/projects", {
    token,
    method: "POST",
    body: project,
  });
};

export const updateProject = async (
  token,
  projectId,
  project
) => {
  return apiRequest(`/api/projects/${projectId}`, {
    token,
    method: "PATCH",
    body: project,
  });
};

export const deleteProject = async (
  token,
  projectId
) => {
  return apiRequest(`/api/projects/${projectId}`, {
    token,
    method: "DELETE",
  });
};