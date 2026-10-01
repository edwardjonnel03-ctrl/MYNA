const express = require("express");
const rateLimit = require("express-rate-limit");
const Property = require("../models/Property");
const Business = require("../models/Business");

const router = express.Router();
const propertySubmissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many property submissions. Please try again in 15 minutes." }
});

function cleanText(value, length) {
    return typeof value === "string" ? value.trim().slice(0, length) : "";
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "Admin authentication required."
    });
}

// ADMIN: see pending, active and inactive properties
router.get("/admin/all", requireAdmin, async (req, res) => {
    try {
        const properties = await Property.find()
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            success: true,
            properties
        });
    } catch (error) {
        console.error("GET ADMIN PROPERTIES ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load properties."
        });
    }
});

// ADMIN: approve, unpublish or reject a property
router.patch("/admin/:id/status", requireAdmin, async (req, res) => {
    try {
        const allowedStatuses = ["pending", "active", "inactive"];
        const status = req.body.status;

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid property status."
            });
        }

        const property = await Property.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    status,
                    featured: status === "active"
                        ? undefined
                        : false
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found."
            });
        }

        return res.json({
            success: true,
            message: `Property marked ${status}.`,
            property
        });
    } catch (error) {
        console.error("UPDATE PROPERTY STATUS ERROR:", error);

        return res.status(400).json({
            success: false,
            message: "Could not update property status."
        });
    }
});

// ADMIN: permanently remove a property
router.delete("/admin/:id", requireAdmin, async (req, res) => {
    try {
        const property = await Property.findByIdAndDelete(req.params.id);

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found."
            });
        }

        return res.json({
            success: true,
            message: "Property deleted."
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Could not delete property."
        });
    }
});
router.get("/", async (req, res) => {
    try {
        const filter = { status: "active" };
        const town = cleanText(req.query.town, 100);
        const type = cleanText(req.query.type, 40);
        const listing = cleanText(req.query.listing, 20);
        const search = cleanText(req.query.search, 100);
        if (town) filter.town = town;
        if (type) filter.propertyType = type;
        if (listing) filter.listingType = listing;
        if (search) {
            const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const searchRegex = new RegExp(safe, "i");
            filter.$or = [{ title: searchRegex }, { town: searchRegex }, { area: searchRegex }, { propertyType: searchRegex }, { description: searchRegex }];
        }
        const properties = await Property.find(filter).sort({ featured: -1, createdAt: -1 }).limit(100).lean();
        return res.json({ success: true, properties });
    } catch (error) {
        console.error("GET PROPERTIES ERROR:", error);
        return res.status(500).json({ success: false, message: "Could not load properties." });
    }
});

router.patch(
    "/admin/:id/images",
    requireAdmin,
    async (req, res) => {
        try {
            const images = req.body.images;

            if (
                !Array.isArray(images) ||
                images.length > 20
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide up to 20 images."
                });
            }

const validImages = images.every(function (url) {
    return (
        typeof url === "string" &&
        (
            url.startsWith("https://res.cloudinary.com/") ||
            /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(url)
        )
    );
});

            if (!validImages) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid property image."
                });
            }

            const property =
                await Property.findByIdAndUpdate(
                    req.params.id,
                    {
                        $set: {
                            images
                        }
                    },
                    {
                        new: true,
                        runValidators: true
                    }
                );

            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: "Property not found."
                });
            }

            return res.json({
                success: true,
                message: "Property photos saved.",
                property
            });
        } catch (error) {
            console.error(
                "UPDATE PROPERTY IMAGES ERROR:",
                error
            );

            return res.status(400).json({
                success: false,
                message: "Could not save property photos."
            });
        }
    }
);
router.get(
    "/owner/dashboard",
    async (req, res) => {
        try {
            if (
                !req.session ||
                !req.session.ownerBusinessId
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Business login required."
                });
            }

const ownerBusiness =
    await Business.findOne({
        id: req.session.ownerBusinessId
    }).select(
        "id businessName propertyPlan propertyPlanStatus propertyPlanExpiresAt"
    );

            if (!ownerBusiness) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Business account not found."
                });
            }

            const properties =
                await Property.find({
                    ownerBusinessId:
    req.session.ownerBusinessId
                })
                    .sort({
                        createdAt: -1
                    })
                    .lean();

const dayKeys = [];

for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
    const day = new Date();

    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(
        day.getUTCDate() - daysAgo
    );

    dayKeys.push(
        day.toISOString().slice(0, 10)
    );
}

const viewsByDay = new Map(
    dayKeys.map(function (date) {
        return [date, 0];
    })
);

const analytics =
    properties.reduce(
        function (totals, property) {
            totals.totalViews +=
                property.views || 0;

            if (property.status === "active") {
                totals.activeListings += 1;
            }

            if (property.status === "pending") {
                totals.pendingListings += 1;
            }

            (property.viewHistory || []).forEach(
                function (entry) {
                    if (
                        viewsByDay.has(entry.date)
                    ) {
                        viewsByDay.set(
                            entry.date,
                            viewsByDay.get(entry.date) +
                                (entry.views || 0)
                        );
                    }
                }
            );

            return totals;
        },
        {
            totalViews: 0,
            activeListings: 0,
            pendingListings: 0
        }
    );

analytics.dailyViews = dayKeys.map(
    function (date) {
        return {
            date,
            views: viewsByDay.get(date)
        };
    }
);

const daysWithViews =
    analytics.dailyViews.filter(
        day => day.views > 0
    );

analytics.bestDay = daysWithViews.length
    ? daysWithViews.reduce(
        (best, day) =>
            day.views > best.views
                ? day
                : best
    )
    : null;

analytics.slowestDay = daysWithViews.length
    ? daysWithViews.reduce(
        (slowest, day) =>
            day.views < slowest.views
                ? day
                : slowest
    )
    : null;
return res.json({
    success: true,
    business: ownerBusiness,
    properties,
    analytics
});
        } catch (error) {
            console.error(
                "GET PROPERTY OWNER DASHBOARD ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not load Property Dashboard."
            });
        }
    }
);
router.get("/owner/:id", async (req, res) => {
    try {
        if (
            !req.session ||
            !req.session.ownerBusinessId
        ) {
            return res.status(401).json({
                success: false,
                message: "Business login required."
            });
        }

        const property =
            await Property.findOne({
                _id: req.params.id,
                ownerBusinessId:
                    req.session.ownerBusinessId
            }).lean();

        if (!property) {
            return res.status(404).json({
                success: false,
                message:
                    "Property not found or you do not have permission to edit it."
            });
        }

        return res.json({
            success: true,
            property
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid property link."
        });
    }
});
router.patch("/owner/:id", async (req, res) => {
    try {
        if (
            !req.session ||
            !req.session.ownerBusinessId
        ) {
            return res.status(401).json({
                success: false,
                message: "Business login required."
            });
        }

        const property =
            await Property.findOne({
                _id: req.params.id,
                ownerBusinessId:
                    req.session.ownerBusinessId
            });

        if (!property) {
            return res.status(404).json({
                success: false,
                message:
                    "Property not found or you do not have permission to edit it."
            });
        }

        const requiredTextFields = [
            "title",
            "propertyType",
            "listingType",
            "town",
            "description",
            "agentName",
            "phone",
            "email"
        ];

        const optionalTextFields = [
            "area",
            "agencyName",
            "whatsapp"
        ];

        for (const field of requiredTextFields) {
            if (Object.prototype.hasOwnProperty.call(
                req.body,
                field
            )) {
                const value = cleanText(
                    req.body[field],
                    field === "description"
                        ? 3000
                        : 140
                );

                if (!value) {
                    return res.status(400).json({
                        success: false,
                        message:
                            `Please enter a valid ${field}.`
                    });
                }

                property[field] = value;
            }
        }

        for (const field of optionalTextFields) {
            if (Object.prototype.hasOwnProperty.call(
                req.body,
                field
            )) {
                property[field] = cleanText(
                    req.body[field],
                    140
                );
            }
        }

for (const field of [
    "price",
    "bedrooms",
    "bathrooms",
    "size",
    "landSize",
    "garages"
]) {
            if (Object.prototype.hasOwnProperty.call(
                req.body,
                field
            )) {
                const value =
                    req.body[field] === ""
                        ? null
                        : Number(req.body[field]);

                if (
                    value !== null &&
                    !Number.isFinite(value)
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            `Please enter a valid ${field}.`
                    });
                }

                property[field] = value;
            }
        }

        if (
    Object.prototype.hasOwnProperty.call(
        req.body,
        "features"
    )
) {
    const rawFeatures = Array.isArray(
        req.body.features
    )
        ? req.body.features
        : String(req.body.features || "")
            .split(",");

    property.features = rawFeatures
        .map(feature => cleanText(feature, 80))
        .filter(Boolean)
        .slice(0, 30);
}
        property.status = "pending";

        await property.save();

        return res.json({
            success: true,
            message:
                "Your changes were saved and sent to MAYNA for review.",
            property
        });
    } catch (error) {
        console.error(
            "OWNER UPDATE PROPERTY ERROR:",
            error
        );

        return res.status(400).json({
            success: false,
            message:
                "Could not save your property changes."
        });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const today = new Date()
            .toISOString()
            .slice(0, 10);

        let property =
            await Property.findOneAndUpdate(
                {
                    _id: req.params.id,
                    status: "active",
                    "viewHistory.date": today
                },
                {
                    $inc: {
                        views: 1,
                        "viewHistory.$.views": 1
                    }
                },
                {
                    new: true
                }
            ).lean();

        if (!property) {
            property =
                await Property.findOneAndUpdate(
                    {
                        _id: req.params.id,
                        status: "active"
                    },
                    {
                        $inc: {
                            views: 1
                        },
                        $push: {
                            viewHistory: {
                                date: today,
                                views: 1
                            }
                        }
                    },
                    {
                        new: true
                    }
                ).lean();
        }

        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found."
            });
        }

        return res.json({
            success: true,
            property
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid property link."
        });
    }
});

router.post("/", propertySubmissionLimiter, async (req, res) => {
    try {
        if (
            !req.session ||
            !req.session.ownerBusinessId
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Please log in as a business or agency to list property."
            });
        }

const ownerBusiness =
    await Business.findOne({
        id: req.session.ownerBusinessId
    });

        if (!ownerBusiness) {
            return res.status(401).json({
                success: false,
                message:
                    "Your business session could not be verified. Please log in again."
            });
        }
        const allowedTypes = ["House", "Apartment", "Townhouse", "Land / Plot", "Commercial", "Development", "Other"];
        const allowedListings = ["For sale", "For rent"];
        const required = ["title", "propertyType", "listingType", "town", "description", "agentName", "phone", "email"];
        for (const field of required) if (!cleanText(req.body[field], field === "description" ? 3000 : 140)) return res.status(400).json({ success: false, message: `${field} is required.` });
        if (!allowedTypes.includes(req.body.propertyType) || !allowedListings.includes(req.body.listingType)) return res.status(400).json({ success: false, message: "Invalid property type or listing type." });
        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, message: "Please enter a valid price." });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim())) return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        const images = Array.isArray(req.body.images) ? req.body.images.slice(0, 20) : [];
if (
    !images.every(
        url =>
            typeof url === "string" &&
            (
                url.startsWith("https://res.cloudinary.com/") ||
                /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(url)
            )
    )
) {
    return res.status(400).json({
        success: false,
        message: "Invalid property image."
    });
}
        const numeric = field => req.body[field] === "" || req.body[field] === undefined ? null : Number(req.body[field]);
        const activePlan =
    ownerBusiness.propertyPlanStatus === "active"
        ? ownerBusiness.propertyPlan
        : "free";

const listingLimits = {
    free: 3,
    agent: 20,
    pro_agency: Infinity
};

const listingLimit =
    listingLimits[activePlan] ??
    listingLimits.free;

if (Number.isFinite(listingLimit)) {
    const currentListings =
        await Property.countDocuments({
            ownerBusinessId: ownerBusiness.id,
            status: {
                $in: [
                    "pending",
                    "active"
                ]
            }
        });

    if (currentListings >= listingLimit) {
        return res.status(403).json({
            success: false,
            message:
                activePlan === "free"
                    ? "Your Free plan allows up to 3 property listings. Request an Agent plan to add more."
                    : "Your Agent plan allows up to 20 active property listings. Request Pro Agency for unlimited listings."
        });
    }
}
const features = Array.isArray(req.body.features)
    ? req.body.features
    : String(req.body.features || "")
        .split(",");

const cleanFeatures = features
    .map(feature => cleanText(feature, 80))
    .filter(Boolean)
    .slice(0, 30);

const property = await Property.create({
    ownerBusinessId: ownerBusiness.id,
    title: cleanText(req.body.title, 140),
    propertyType: req.body.propertyType,
    listingType: req.body.listingType,
    price,
    town: cleanText(req.body.town, 100),
    area: cleanText(req.body.area, 120),
    bedrooms: numeric("bedrooms"),
    bathrooms: numeric("bathrooms"),
    size: numeric("size"),
    landSize: numeric("landSize"),
    garages: numeric("garages"),
    features: cleanFeatures,
    description: cleanText(req.body.description, 3000),
    images,
    agentName: cleanText(req.body.agentName, 120),
    agencyName: cleanText(req.body.agencyName, 120),
    phone: cleanText(req.body.phone, 30),
    whatsapp: cleanText(req.body.whatsapp, 30),
    email: cleanText(req.body.email, 254),
    status: "pending"
});

return res.status(201).json({
    success: true,
    message:
        "Your property has been submitted for review.",
    propertyId: property._id
});
    } catch (error) {
        console.error(
            "CREATE PROPERTY ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not submit property."
        });
    }
});
module.exports = router;
