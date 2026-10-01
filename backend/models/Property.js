const mongoose = require("mongoose");

const PropertySchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 140 },
        propertyType: {
            type: String,
            required: true,
            enum: ["House", "Apartment", "Townhouse", "Land / Plot", "Commercial", "Development", "Other"]
        },
        listingType: { type: String, required: true, enum: ["For sale", "For rent"] },
        price: { type: Number, required: true, min: 0 },
        currency: { type: String, default: "N$", enum: ["N$"] },
        town: { type: String, required: true, trim: true, maxlength: 100 },
        area: { type: String, default: "", trim: true, maxlength: 120 },
        bedrooms: { type: Number, default: null, min: 0, max: 50 },
        bathrooms: { type: Number, default: null, min: 0, max: 50 },
        size: { type: Number, default: null, min: 0 },
        landSize: { type: Number, default: null, min: 0 },
garages: { type: Number, default: null, min: 0, max: 20 },
features: {
    type: [String],
    default: [],
    validate: {
        validator: features =>
            features.length <= 30 &&
            features.every(
                feature =>
                    typeof feature === "string" &&
                    feature.trim().length > 0 &&
                    feature.length <= 80
            ),
        message:
            "A property can have up to 30 features."
    }
},
        description: { type: String, required: true, trim: true, maxlength: 3000 },
images: {
    type: [String],
    default: [],
    validate: {
        validator: images =>
            images.length <= 20 &&
            images.every(
                url =>
                    typeof url === "string" &&
                    (
                        url.startsWith("https://res.cloudinary.com/") ||
                        /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(url)
                    )
            ),
        message:
            "Property images must be valid MAYNA image URLs and cannot exceed 20 images."
    }
},
        agentName: { type: String, required: true, trim: true, maxlength: 120 },
        agencyName: { type: String, default: "", trim: true, maxlength: 120 },
        phone: { type: String, required: true, trim: true, maxlength: 30 },
        whatsapp: { type: String, default: "", trim: true, maxlength: 30 },
        email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
ownerBusinessId: {
    type: Number,
    default: null,
    index: true
},

featuredUntil: {
    type: Date,
    default: null
},
        status: { type: String, enum: ["pending", "active", "inactive"], default: "pending" },
        featured: { type: Boolean, default: false },
views: { type: Number, default: 0, min: 0 },
viewHistory: {
    type: [
        {
            date: {
                type: String,
                required: true
            },
            views: {
                type: Number,
                default: 0,
                min: 0
            }
        }
    ],
    default: []
}
    },
    { timestamps: true }
);

PropertySchema.index({ status: 1, featured: -1, createdAt: -1 });
PropertySchema.index({ town: 1, propertyType: 1, listingType: 1 });

module.exports = mongoose.model("Property", PropertySchema);
