import { apiRequest } from "./client";

export const getTaskComments = async (
  token,
  taskId
) => {
  return apiRequest(
    `/api/tasks/${taskId}/comments`,
    {
      token,
    }
  );
};

export const createComment = async (
  token,
  taskId,
  content
) => {
  return apiRequest(
    `/api/tasks/${taskId}/comments`,
    {
      token,
      method: "POST",
      body: {
        content,
      },
    }
  );
};

export const deleteComment = async (
  token,
  commentId
) => {
  return apiRequest(
    `/api/comments/${commentId}`,
    {
      token,
      method: "DELETE",
    }
  );
};