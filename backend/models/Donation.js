const mongoose = require("mongoose");

const donationSchema =
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

            amount: {
                type: Number,
                required: true,
                min: 1
            },

            reference: {
                type: String,
                required: true,
                trim: true,
                uppercase: true,
                maxlength: 50,
                unique: true
            },

            paymentMethod: {
                type: String,
                enum: ["eft"],
                default: "eft"
            },

            status: {
                type: String,
                enum: [
                    "pending",
                    "confirmed",
                    "rejected"
                ],
                default: "pending"
            }
        },
        {
            timestamps: true
        }
    );

module.exports =
    mongoose.model(
        "Donation",
        donationSchema
    );