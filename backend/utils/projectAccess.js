const pool = require("../db");

const getProjectAccess = async (projectId, userId) => {
    const result = await pool.query(
        `
            SELECT
                p.id,
                p.owner_id,
                p.owner_id = $2 AS is_owner,
                EXISTS (
                    SELECT 1
                    FROM project_members pm
                    WHERE
                        pm.project_id = p.id
                        AND pm.user_id = $2
                ) AS is_member
            FROM projects p
            WHERE p.id = $1
        `,
        [projectId, userId]
    );

    if (result.rowCount === 0) {
        return null;
    }

    const access = result.rows[0];

    return {
        isOwner: access.is_owner,
        isMember: access.is_member,
        hasAccess: access.is_owner || access.is_member,
    };
};

module.exports = getProjectAccess;