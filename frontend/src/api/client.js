const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

export const apiRequest = async (
  path,
  {
    token,
    method = "GET",
    body,
  } = {}
) => {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers,
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    }
  );

  if (response.ok) {
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  let message = "Dogodila se greška.";

  try {
    const data = await response.json();

    if (data.error) {
      message = data.error;
    }
  } catch {
    // Response does not contain JSON error data.
  }

  throw new Error(message);
};