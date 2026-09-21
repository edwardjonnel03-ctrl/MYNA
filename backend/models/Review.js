const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Business",
            required: true,
            index: true
        },

        customerName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },

        comment: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300
        },

        status: {
            type: String,
            enum: [
                "pending",
                "approved",
                "rejected"
            ],
            default: "pending",
            index: true
        }
    },
    {
        timestamps: true
    }
);

ReviewSchema.index({
    businessId: 1,
    status: 1,
    createdAt: -1
});

module.exports = mongoose.model(
    "Review",
    ReviewSchema
);