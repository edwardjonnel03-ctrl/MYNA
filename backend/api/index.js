
const app = require("../server");
const connectDatabase = require("../config/database");

let connectionPromise;

module.exports = async (req, res) => {
    try {
        if (!connectionPromise) {
            connectionPromise = Promise.resolve()
                .then(() => connectDatabase())
                .catch((error) => {
                    connectionPromise = null;
                    throw error;
                });
        }

        await connectionPromise;

        return app(req, res);
    } catch (error) {
        console.error("MAYNA database initialization failed:", error);

        return res.status(503).json({
            success: false,
            message: "Database temporarily unavailable."
        });
    }
};
