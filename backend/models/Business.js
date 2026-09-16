const mongoose = require("mongoose");

const BusinessSchema = new mongoose.Schema({
    businessName: {
        type: String,
        required: true
    },

    country: {
        type: String,
        required: true
    },

    town: {
        type: String,
        required: true
    },

    category: {
        type: String,
        required: true
    },

    phone: String,

    email: String,

    description: String,

    verified: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

module.exports = mongoose.model(
    "Business",
    BusinessSchema
);