import { apiRequest } from "./client";

export const getProjectTasks = async (
  token,
  projectId
) => {
  return apiRequest(
    `/api/projects/${projectId}/tasks`,
    {
      token,
    }
  );
};

export const createTask = async (
  token,
  projectId,
  task
) => {
  return apiRequest(
    `/api/projects/${projectId}/tasks`,
    {
      token,
      method: "POST",
      body: task,
    }
  );
};

export const updateTask = async (
  token,
  taskId,
  task
) => {
  return apiRequest(`/api/tasks/${taskId}`, {
    token,
    method: "PATCH",
    body: task,
  });
};

export const deleteTask = async (
  token,
  taskId
) => {
  return apiRequest(`/api/tasks/${taskId}`, {
    token,
    method: "DELETE",
  });
};