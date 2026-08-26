import { apiRequest } from "./client";

export const getProjectMembers = async (
  token,
  projectId
) => {
  return apiRequest(
    `/api/projects/${projectId}/members`,
    {
      token,
    }
  );
};

export const addProjectMember = async (
  token,
  projectId,
  email
) => {
  return apiRequest(
    `/api/projects/${projectId}/members`,
    {
      token,
      method: "POST",
      body: {
        email,
      },
    }
  );
};

export const removeProjectMember = async (
  token,
  projectId,
  userId
) => {
  return apiRequest(
    `/api/projects/${projectId}/members/${userId}`,
    {
      token,
      method: "DELETE",
    }
  );
};