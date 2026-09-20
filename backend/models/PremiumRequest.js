const mongoose = require("mongoose");

const premiumRequestSchema =
    new mongoose.Schema(
        {
            businessId: {
                type: Number,
                required: true,
                index: true
            },

            businessName: {
                type: String,
                required: true,
                trim: true,
                maxlength: 150
            },

            ownerEmail: {
                type: String,
                required: true,
                trim: true,
                lowercase: true,
                maxlength: 200
            },

            billingCycle: {
                type: String,
                required: true,
                enum: [
                    "monthly",
                    "yearly"
                ]
            },

            amount: {
                type: Number,
                required: true,
                enum: [
                    79.99,
                    863.89
                ]
            },

            reference: {
                type: String,
                required: true,
                unique: true,
                trim: true,
                uppercase: true
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
            },

            confirmedAt: {
                type: Date,
                default: null
            }
        },
        {
            timestamps: true
        }
    );

module.exports =
    mongoose.model(
        "PremiumRequest",
        premiumRequestSchema
    );