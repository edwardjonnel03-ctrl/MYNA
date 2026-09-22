const mongoose = require("mongoose");

const PromotionSchema = new mongoose.Schema(
    {
        businessId: {
            type: Number,
            required: true,
            index: true
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },

        offer: {
            type: String,
            default: "",
            trim: true,
            maxlength: 100
        },

        image: {
            type: String,
            default: "",
            validate: {
                validator: function (value) {
                    return (
                        !value ||
                        value.startsWith(
                            "https://res.cloudinary.com/"
                        )
                    );
                },
                message:
                    "Promotion image must be a valid Cloudinary URL."
            }
        },

        startsAt: {
            type: Date,
            required: true
        },

        expiresAt: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: [
                "active",
                "inactive"
            ],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

PromotionSchema.index({
    businessId: 1,
    status: 1,
    expiresAt: 1
});

module.exports = mongoose.model(
    "Promotion",
    PromotionSchema
);