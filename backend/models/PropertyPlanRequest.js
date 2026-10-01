const mongoose = require("mongoose");

const PropertyPlanRequestSchema = new mongoose.Schema(
    {
        businessId: {
            type: Number,
            required: true,
            index: true
        },
        propertyId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },
        requestType: {
            type: String,
            required: true,
            enum: [
                "agent",
                "pro_agency",
                "featured_7_days",
                "featured_14_days",
                "custom_quote"
            ]
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        message: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000
        },
        status: {
            type: String,
            enum: ["pending", "approved", "declined"],
            default: "pending",
            index: true
        },
        adminNote: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000
        }
    },
    {
        timestamps: true
    }
);

PropertyPlanRequestSchema.index({
    businessId: 1,
    status: 1,
    createdAt: -1
});

module.exports = mongoose.model(
    "PropertyPlanRequest",
    PropertyPlanRequestSchema
);