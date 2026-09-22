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
                    "Business image must be a valid Cloudinary URL."
            }
        },

        gallery: {
            type: [String],
            default: [],
            validate: [
                {
                    validator: function (images) {
                        return images.length <= 20;
                    },
                    message:
                        "Gallery cannot contain more than 20 images."
                },
                {
                    validator: function (images) {
                        return images.every(function (value) {
                            return (
                                typeof value === "string" &&
                                value.startsWith(
                                    "https://res.cloudinary.com/"
                                )
                            );
                        });
                    },
                    message:
                        "All gallery images must be valid Cloudinary URLs."
                }
            ]
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

            default: [],
            validate: {
                validator: function (services) {
                    return services.length <= 50;
                },
                message: "Services cannot contain more than 50 items."
            }
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
    default: null,
    select: false
},

ownerPasswordSalt: {
    type: String,
    default: null,
    select: false
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
        // BUSINESS PLAN

plan: {
    type: String,
    enum: [
        "free",
        "premium"
    ],
    default: "free"
},

planStatus: {
    type: String,
    enum: [
        "active",
        "pending",
        "expired"
    ],
    default: "active"
},

planStartedAt: {
    type: Date,
    default: null
},

planExpiresAt: {
    type: Date,
    default: null
},

        // PREMIUM SOCIAL LINKS

        socialLinks: {
            website: {
                type: String,
                default: "",
                trim: true,
                maxlength: 500
            },

            facebook: {
                type: String,
                default: "",
                trim: true,
                maxlength: 500
            },

            instagram: {
                type: String,
                default: "",
                trim: true,
                maxlength: 500
            },

            tiktok: {
                type: String,
                default: "",
                trim: true,
                maxlength: 500
            },

            twitter: {
                type: String,
                default: "",
                trim: true,
                maxlength: 500
            },

            linkedin: {
                type: String,
                default: "",
                trim: true,
                maxlength: 500
            },

            youtube: {
                type: String,
                default: "",
                trim: true,
                maxlength: 500
            }
        },

        // BUSINESS OPENING HOURS

        hours: {
            monday: {
                type: String,
                default: "",
                maxlength: 50
            },

            tuesday: {
                type: String,
                default: "",
                maxlength: 50
            },

            wednesday: {
                type: String,
                default: "",
                maxlength: 50
            },

            thursday: {
                type: String,
                default: "",
                maxlength: 50
            },

            friday: {
                type: String,
                default: "",
                maxlength: 50
            },

            saturday: {
                type: String,
                default: "",
                maxlength: 50
            },

            sunday: {
                type: String,
                default: "",
                maxlength: 50
            }
        },
        // BUSINESS ANALYTICS

        analytics: {
            profileViews: {
                type: Number,
                default: 0,
                min: 0
            },

            phoneClicks: {
                type: Number,
                default: 0,
                min: 0
            },

            whatsappClicks: {
                type: Number,
                default: 0,
                min: 0
            },

            socialClicks: {
                type: Number,
                default: 0,
                min: 0
            }
        },

        // PASSWORD RESET

resetTokenHash: {
    type: String,
    default: null,
    select: false
},

resetTokenExpires: {
    type: Date,
    default: null,
    select: false
}
    },
    {
        timestamps: true
    }
);

BusinessSchema.index(
    { ownerEmail: 1 },
    {
        unique: true,
        partialFilterExpression: {
            ownerEmail: {
                $type: "string"
            }
        }
    }
);

module.exports = mongoose.model(
    "Business",
    BusinessSchema
);