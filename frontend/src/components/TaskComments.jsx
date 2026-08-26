import {
  useEffect,
  useState,
} from "react";

import {
  createComment,
  deleteComment,
  getTaskComments,
} from "../api/comments";
import { useAuth } from "../context/authContextBase";

function TaskComments({ taskId }) {
  const {
    token,
    user,
  } = useAuth();

  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const loadComments = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getTaskComments(
        token,
        taskId
      );

      setComments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getTaskComments(
        token,
        taskId
    )
        .then((data) => {
            if (cancelled) {
                return;
            }

            setComments(data);
            setError("");
        })
        .catch((err) => {
            if (cancelled) {
                return;
            }

            setError(err.message);
        })
        .finally(() => {
            if (cancelled) {
                return;
            }

            setLoading(false);
        });

    return () => {
        cancelled = true;
    };
    }, [
        token,
        taskId,
    ]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!content.trim()) {
      setError("Komentar ne može biti prazan.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await createComment(
        token,
        taskId,
        content
      );

      setContent("");

      await loadComments();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (
    commentId
  ) => {
    try {
      setError("");

      await deleteComment(
        token,
        commentId
      );

      await loadComments();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (value) => {
    return new Intl.DateTimeFormat(
      "hr-HR",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    ).format(new Date(value));
  };

  return (
    <div className="comments-section">
      <h3>Komentari</h3>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {loading ? (
        <p>Učitavanje komentara...</p>
      ) : comments.length === 0 ? (
        <p className="comments-empty">
          Još nema komentara.
        </p>
      ) : (
        <ul className="comments-list">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="comment-item"
            >
              <div className="comment-header">
                <div>
                  <strong>
                    {comment.author_username}
                  </strong>

                  <span className="comment-date">
                    {formatDate(
                      comment.created_at
                    )}
                  </span>
                </div>

                {comment.user_id === user.id && (
                  <button
                    type="button"
                    className="danger comment-delete"
                    onClick={() =>
                      handleDeleteComment(
                        comment.id
                      )
                    }
                  >
                    Obriši
                  </button>
                )}
              </div>

              <p>{comment.content}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="comment-form"
        onSubmit={handleSubmit}
      >
        <label>
          Novi komentar
          <textarea
            value={content}
            onChange={(event) =>
              setContent(event.target.value)
            }
            placeholder="Napiši komentar..."
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Dodavanje..."
            : "Dodaj komentar"}
        </button>
      </form>
    </div>
  );
}

export default TaskComments;