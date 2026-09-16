const mongoose = require("mongoose");
const dns = require("dns");

// Helps with the DNS/SRV problem we encountered locally.
dns.setServers([
    "1.1.1.1",
    "8.8.8.8"
]);

async function connectDatabase() {

    try {

        if (!process.env.MONGODB_URI) {
            throw new Error(
                "MONGODB_URI is missing."
            );
        }

        await mongoose.connect(
            process.env.MONGODB_URI
        );

        console.log(
            "MongoDB connected successfully."
        );

    } catch (error) {

        console.error(
            "MongoDB connection failed:",
            error.message
        );

        process.exit(1);
    }
}

module.exports = connectDatabase;