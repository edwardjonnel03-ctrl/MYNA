const mongoose = require("mongoose");

const supportRequestSchema =
    new mongoose.Schema(
        {
            name: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100
            },

            email: {
                type: String,
                required: true,
                trim: true,
                lowercase: true,
                maxlength: 200
            },

            subject: {
                type: String,
                required: true,
                enum: [
                    "General support",
                    "Business listing",
                    "Report a problem",
                    "Report a business",
                    "Other"
                ]
            },

            message: {
                type: String,
                required: true,
                trim: true,
                maxlength: 3000
            },

            status: {
                type: String,
                enum: [
                    "open",
                    "in-progress",
                    "resolved"
                ],
                default: "open"
            }
        },
        {
            timestamps: true
        }
    );

module.exports =
    mongoose.model(
        "SupportRequest",
        supportRequestSchema
    );