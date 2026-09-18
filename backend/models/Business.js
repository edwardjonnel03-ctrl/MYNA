const mongoose = require("mongoose");

const BusinessSchema = new mongoose.Schema(
    {
        // Keep the old MYNA numeric ID during migration
        id: {
            type: Number,
            unique: true,
            sparse: true
        },

        businessName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        image: {
            type: String,
            default: ""
        },

        gallery: {
            type: [String],
            default: []
        },

        country: {
            type: String,
            required: true,
            default: "Namibia"
        },

        town: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        category: {
            type: String,
            default: "Other",
            trim: true,
            maxlength: 80
        },

        phone: {
            type: String,
            default: "",
            maxlength: 30
        },

        whatsapp: {
            type: String,
            default: "",
            maxlength: 30
        },

        email: {
            type: String,
            default: "",
            trim: true,
            lowercase: true,
            maxlength: 254
        },

        description: {
            type: String,
            default: "",
            maxlength: 2000
        },

        services: {
            type: [
                {
                    name: {
                        type: String,
                        trim: true,
                        maxlength: 120
                    },

                    price: {
                        type: String,
                        trim: true,
                        maxlength: 80
                    },

                    description: {
                        type: String,
                        trim: true,
                        maxlength: 500
                    }
                }
            ],

            default: []
        },

        // BUSINESS OWNER ACCOUNT

        ownerEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: null,
            maxlength: 254
        },

        ownerPasswordHash: {
            type: String,
            default: null
        },

        ownerPasswordSalt: {
            type: String,
            default: null
        },

        claimed: {
            type: Boolean,
            default: false
        },

        // ADMIN VERIFICATION

        verified: {
            type: Boolean,
            default: false
        },

        // BUSINESS OPENING HOURS

        hours: {
            monday: {
                type: String,
                default: ""
            },

            tuesday: {
                type: String,
                default: ""
            },

            wednesday: {
                type: String,
                default: ""
            },

            thursday: {
                type: String,
                default: ""
            },

            friday: {
                type: String,
                default: ""
            },

            saturday: {
                type: String,
                default: ""
            },

            sunday: {
                type: String,
                default: ""
            }
        },

        // PASSWORD RESET

        resetTokenHash: {
            type: String,
            default: null
        },

        resetTokenExpires: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Business",
    BusinessSchema
);