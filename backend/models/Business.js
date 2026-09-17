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
            trim: true
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
            trim: true
        },

        category: {
    type: String,
    default: "Other",
    trim: true
},

        phone: {
            type: String,
            default: ""
        },

        whatsapp: {
            type: String,
            default: ""
        },

        email: {
            type: String,
            default: "",
            trim: true,
            lowercase: true
        },

        description: {
            type: String,
            default: ""
        },

        services: {
            type: String,
            default: ""
        },

        // BUSINESS OWNER ACCOUNT

       ownerEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
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