
require("dotenv").config();

const mongoose = require("mongoose");

const Business = require("./models/Business");
const PremiumRequest = require("./models/PremiumRequest");
const Review = require("./models/Review");
const Promotion = require("./models/Promotion");
const Donation = require("./models/Donation");
const SupportRequest = require("./models/SupportRequest");

const collections = [
    Business,
    PremiumRequest,
    Review,
    Promotion,
    Donation,
    SupportRequest
];

async function resetLaunch() {
    try {
        if (process.env.CONFIRM_LAUNCH_RESET !==
            "DELETE_MAYNA_LAUNCH_DATA") {
            throw new Error(
                "Reset confirmation missing."
            );
        }

        await mongoose.connect(
            process.env.MONGODB_URI
        );

        console.log("Connected to MongoDB.");
        console.log("Target database:",
            mongoose.connection.name);

        // Display the records before deletion.
        for (const model of collections) {
            const count =
                await model.countDocuments();

            console.log(
                `${model.modelName}: ${count} records`
            );
        }

        // Delete the six selected collections' records.
        for (const model of collections) {
            const result =
                await model.deleteMany({});

            console.log(
                `${model.modelName}: ${result.deletedCount} deleted`
            );
        }

        console.log(
            "MAYNA launch data reset completed."
        );

    } catch (error) {
        console.error(
            "Reset failed:",
            error.message
        );

        process.exitCode = 1;

    } finally {
        await mongoose.disconnect();
    }
}

resetLaunch();