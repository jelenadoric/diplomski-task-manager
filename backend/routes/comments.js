const express = require("express");

const pool = require("../db");
const authenticate = require("../middleware/auth");

const router = express.Router();

const parseCommentId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

router.use(authenticate);

router.delete("/:id", async (req, res) => {
    const commentId = parseCommentId(req.params.id);

    if (!commentId) {
        return res.status(400).json({
            error: "Invalid comment id",
        });
    }

    try {
        const commentResult = await pool.query(
            `
                SELECT
                    id,
                    user_id
                FROM comments
                WHERE id = $1
            `,
            [commentId]
        );

        if (commentResult.rowCount === 0) {
            return res.status(404).json({
                error: "Comment not found",
            });
        }

        const comment = commentResult.rows[0];

        if (comment.user_id !== req.user.id) {
            return res.status(403).json({
                error: "You can only delete your own comments",
            });
        }

        await pool.query(
            `
                DELETE FROM comments
                WHERE id = $1
            `,
            [commentId]
        );

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;