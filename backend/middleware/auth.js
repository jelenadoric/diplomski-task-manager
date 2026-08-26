const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
        return res.status(401).json({
            error: "Authentication required",
        });
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            error: "Invalid authorization header",
        });
    }

    try {
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = {
            id: payload.userId,
        };

        next();
    } catch {
        return res.status(401).json({
            error: "Invalid or expired token",
        });
    }
};

module.exports = authenticate;