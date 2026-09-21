const helmet = require("helmet");
require("dotenv").config();

if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32
) {
    throw new Error(
        "SESSION_SECRET must be configured and contain at least 32 characters."
    );
}

const cloudinary =
    require("./config/cloudinary");

const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const path = require("path");
const { Resend } = require("resend");
const connectDatabase =
    require("./config/database");
const SupportRequest =
    require("./models/SupportRequest");
    const Review = require("./models/Review");
const Donation =
    require("./models/Donation");
const PremiumRequest =
    require("./models/PremiumRequest");
const Business =
    require("./models/Business");    

const resend = new Resend(
    process.env.RESEND_API_KEY
);

const app = express();

// Required for secure cookies behind Render's proxy
app.set("trust proxy", 1);

const PORT = 5000;


// =========================================
// MIDDLEWARE
// =========================================
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: [
                    "'self'"
                ],

                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'"
                ],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com"
                ],

                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "data:"
                ],

                imgSrc: [
                    "'self'",
                    "data:",
                    "https://res.cloudinary.com",
                    "https://images.unsplash.com"
                ],

                connectSrc: [
                    "'self'",
                    "http://localhost:5000",
                    "https://myna-web-i92o.onrender.com"
                ],

                objectSrc: [
                    "'none'"
                ],

                baseUri: [
                    "'self'"
                ],

                frameAncestors: [
                    "'self'"
                ]
            }
        }
    })
);

const allowedOrigins = [
    "https://myna-web-i92o.onrender.com",
    "http://localhost:5000"
];

app.use(
    cors({
        origin: function (origin, callback) {

            // Allow requests without an Origin header
            // such as direct API requests.
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(null, false);
        },

        credentials: true
    })
);
// =========================================
// CSRF ORIGIN PROTECTION
// =========================================

app.use((req, res, next) => {

    const protectedMethods = [
        "POST",
        "PUT",
        "PATCH",
        "DELETE"
    ];

    if (
        !protectedMethods.includes(req.method)
    ) {
        return next();
    }

    const origin =
        req.get("Origin");

    // Allow requests without an Origin header.
    // Authentication and authorization still apply.
    if (!origin) {
        return next();
    }

    if (
        allowedOrigins.includes(origin)
    ) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message:
            "Request blocked by origin protection."
    });
});

app.use(
    express.json({
        limit: "8mb"
    })
);


app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);


// =========================================
// SESSION
// =========================================

app.use(
    session({
        name: "mayna.sid",

        secret:
            process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl:
                process.env.MONGODB_URI,

            collectionName:
                "sessions"
        }),

        cookie: {
            httpOnly: true,

            secure:
                process.env.NODE_ENV ===
                "production",

            sameSite: "lax",

            maxAge:
                1000 * 60 * 60 * 8
        }
    })
);
// =========================================
// IMAGE UPLOAD RATE LIMIT
// =========================================

const imageUploadLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        limit: 20,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many image uploads. Please try again in 15 minutes."
        }
    });


// =========================================
// OWNER/AUTHENTICATED IMAGE UPLOAD
// =========================================

app.post(
    "/api/upload",
    imageUploadLimiter,
    async (req, res) => {

        if (
            !req.session ||
            (
                !req.session.ownerBusinessId &&
                req.session.isAdmin !== true
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "You must be logged in to upload images."
            });
        }

        try {

            const image =
    req.body.image;

if (!image) {
    return res.status(400).json({
        success: false,
        message:
            "No image provided."
    });
}


const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

const imageMatch =
    typeof image === "string"
        ? image.match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,/
        )
        : null;

if (
    !imageMatch ||
    !allowedImageTypes.includes(
        imageMatch[1].toLowerCase()
    )
) {
    return res.status(400).json({
        success: false,
        message:
            "Only JPEG, PNG and WebP images are allowed."
    });
}

const base64Data =
    image.split(",")[1] || "";

const imageBuffer =
    Buffer.from(
        base64Data,
        "base64"
    );

const imageSizeBytes =
    imageBuffer.length;

const declaredImageType =
    imageMatch[1].toLowerCase();

const isJPEG =
    imageBuffer.length >= 3 &&
    imageBuffer[0] === 0xff &&
    imageBuffer[1] === 0xd8 &&
    imageBuffer[2] === 0xff;

const isPNG =
    imageBuffer.length >= 8 &&
    imageBuffer.subarray(0, 8).equals(
        Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a
        ])
    );

const isWebP =
    imageBuffer.length >= 12 &&
    imageBuffer
        .subarray(0, 4)
        .toString("ascii") === "RIFF" &&
    imageBuffer
        .subarray(8, 12)
        .toString("ascii") === "WEBP";

const imageSignatureIsValid =
    (
        declaredImageType === "image/jpeg" &&
        isJPEG
    ) ||
    (
        declaredImageType === "image/png" &&
        isPNG
    ) ||
    (
        declaredImageType === "image/webp" &&
        isWebP
    );

if (!imageSignatureIsValid) {
    return res.status(400).json({
        success: false,
        message:
            "Image content does not match its declared format."
    });
}

const maxImageSize =
    5 * 1024 * 1024;

if (
    imageSizeBytes >
    maxImageSize
) {
    return res.status(413).json({
        success: false,
        message:
            "Image must be smaller than 5 MB."
    });
}

            const result =
                await cloudinary.uploader.upload(
                    image,
                    {
                        folder: "myna/businesses",
                        resource_type: "image"
                    }
                );

            return res.json({
                success: true,
                url: result.secure_url
            });

        } catch (error) {

            console.error(
                "Cloudinary upload error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Image upload failed."
            });
        }
    }
);


// =========================================
// FRONTEND
// =========================================

const frontendPath =
    path.join(
        __dirname,
        "..",
        "frontend"
    );

app.use(
    express.static(frontendPath)
);

// =========================================
// SUPPORT RATE LIMITER
// =========================================

const supportLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        limit: 5,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many support requests. Please try again later."
        }
    });
// =========================================
// DONATION RATE LIMITER
// =========================================

const donationLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        limit: 5,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many donation submissions. Please try again later."
        }
    });

// =========================================
// ADMIN LOGIN RATE LIMIT
// =========================================

const adminLoginLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        limit: 5,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many login attempts. Please try again in 15 minutes."
        }
    });


// =========================================
// ADMIN LOGIN
// =========================================

app.post(
    "/api/admin/login",
    adminLoginLimiter,
    async (req, res) => {

        try {

            const username =
                req.body.username;

            const password =
                req.body.password;

            const correctUsername =
                process.env.ADMIN_USERNAME;

            const correctPasswordHash =
                process.env.ADMIN_PASSWORD_BCRYPT;


            if (
                !username ||
                !password ||
                !correctUsername ||
                !correctPasswordHash
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid username or password."
                });
            }


            const passwordMatches =
                await bcrypt.compare(
                    password,
                    correctPasswordHash
                );


            if (
                username === correctUsername &&
                passwordMatches
            ) {

                return req.session.regenerate(
                    (regenerateError) => {

                        if (regenerateError) {

                            console.error(
                                "Admin session regeneration failed:",
                                regenerateError
                            );

                            return res.status(500).json({
                                success: false,
                                message:
                                    "Could not create admin session."
                            });
                        }


                        req.session.isAdmin = true;


                        return req.session.save(
                            (saveError) => {

                                if (saveError) {

                                    console.error(
                                        "Admin session save failed:",
                                        saveError
                                    );

                                    return res.status(500).json({
                                        success: false,
                                        message:
                                            "Could not create admin session."
                                    });
                                }


                                return res.json({
                                    success: true,
                                    message:
                                        "Admin login successful."
                                });
                            }
                        );
                    }
                );
            }


            return res.status(401).json({
                success: false,
                message:
                    "Invalid username or password."
            });

        } catch (error) {

            console.error(
                "Admin login error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Admin login failed."
            });
        }
    }
);

// =========================================
// ADMIN AUTH MIDDLEWARE
// =========================================

function requireAdmin(req, res, next) {

    if (
        req.session &&
        req.session.isAdmin === true
    ) {
        return next();
    }

    return res
        .status(401)
        .json({
            success: false,
            message: "Admin authentication required."
        });
}
// =========================================
// ADMIN AUTH CHECK
// =========================================

app.get(
    "/api/admin/check",
    (req, res) => {

        if (
            req.session &&
            req.session.isAdmin === true
        ) {

            return res.json({
                success: true,
                authenticated: true
            });
        }


        return res
            .status(401)
            .json({
                success: false,
                authenticated: false
            });
    }
);


// =========================================
// ADMIN LOGOUT
// =========================================

app.post(
    "/api/admin/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    console.error(
                        "LOGOUT ERROR:",
                        error
                    );

                    return res
                        .status(500)
                        .json({
                            success: false,

                            message:
                                "Could not log out."
                        });
                }               

                res.clearCookie(
                    "mayna.sid",
                    {
                        path: "/"
                    }
                );

                return res.json({
                    success: true,

                    message:
                        "Logged out successfully."
                });
            }
        );
    }
);
// =========================================
// ADMIN SUPPORT INBOX
// =========================================

app.get(
    "/api/admin/support",
    requireAdmin,
    async (req, res) => {

        try {

const requests =
    await SupportRequest
        .find()
        .select(
            "name email subject message status createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

            return res.json({
                success: true,
                requests
            });

        } catch (error) {

            console.error(
                "ADMIN SUPPORT INBOX ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not load support requests."
                });
        }
    }
);

// =========================================
// UPDATE SUPPORT REQUEST STATUS
// =========================================

app.patch(
    "/api/admin/support/:id/status",
    requireAdmin,
    async (req, res) => {

        try {

            const allowedStatuses = [
                "open",
                "in-progress",
                "resolved"
            ];

            const status =
                String(req.body.status || "")
                    .trim()
                    .toLowerCase();

            if (!allowedStatuses.includes(status)) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid support request status."
                    });
            }

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid support request ID."
                    });
            }

            const request =
                await SupportRequest.findByIdAndUpdate(
                    req.params.id,
                    {
                        $set: {
                            status
                        }
                    },
                    {
                        new: true,
                        runValidators: true
                    }
                );

            if (!request) {

                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Support request not found."
                    });
            }

            return res.json({
                success: true,
                message:
                    "Support request status updated.",
                status: request.status
            });

        } catch (error) {

            console.error(
                "UPDATE SUPPORT STATUS ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not update support request."
                });
        }
    }
);
// =========================================
// DELETE SUPPORT REQUEST
// =========================================

app.delete(
    "/api/admin/support/:id",
    requireAdmin,
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid support request ID."
                    });
            }

            const request =
                await SupportRequest.findByIdAndDelete(
                    req.params.id
                );

            if (!request) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Support request not found."
                    });
            }

            return res.json({
                success: true,
                message:
                    "Support request deleted."
            });

        } catch (error) {

            console.error(
                "DELETE SUPPORT REQUEST ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not delete support request."
                });
        }
    }
);
// =========================================
// ADMIN DONATION INBOX
// =========================================

app.get(
    "/api/admin/donations",
    requireAdmin,
    async (req, res) => {

        try {

            const donations =
                await Donation
                    .find()
                    .select(
                        "name email amount reference paymentMethod status createdAt updatedAt"
                    )
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .lean();

            return res.json({
                success: true,
                donations
            });

        } catch (error) {

            console.error(
                "ADMIN DONATIONS ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not load donations."
                });
        }
    }
);


// =========================================
// UPDATE DONATION STATUS
// =========================================

app.patch(
    "/api/admin/donations/:id/status",
    requireAdmin,
    async (req, res) => {

        try {

            const allowedStatuses = [
                "pending",
                "confirmed",
                "rejected"
            ];

            const status =
                String(req.body.status || "")
                    .trim()
                    .toLowerCase();

            if (
                !allowedStatuses.includes(status)
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid donation status."
                    });
            }

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid donation ID."
                    });
            }

            const donation =
                await Donation.findByIdAndUpdate(
                    req.params.id,
                    {
                        $set: {
                            status
                        }
                    },
                    {
                        new: true,
                        runValidators: true
                    }
                );

            if (!donation) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Donation not found."
                    });
            }

            return res.json({
                success: true,
                message:
                    "Donation status updated.",
                status:
                    donation.status
            });

        } catch (error) {

            console.error(
                "UPDATE DONATION STATUS ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not update donation."
                });
        }
    }
);

// =========================================
// DELETE DONATION
// =========================================

app.delete(
    "/api/admin/donations/:id",
    requireAdmin,
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "Invalid donation ID."
                    });
            }

            const donation =
                await Donation.findByIdAndDelete(
                    req.params.id
                );

            if (!donation) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Donation not found."
                    });
            }

            return res.json({
                success: true,
                message:
                    "Donation deleted."
            });

        } catch (error) {

            console.error(
                "DELETE DONATION ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not delete donation."
                });
        }
    }
);
// =========================================
// ADMIN PREMIUM REQUEST INBOX
// =========================================

app.get(
    "/api/admin/premium-requests",
    requireAdmin,
    async (req, res) => {

        try {

            const requests =
                await PremiumRequest
                    .find()
                    .select(
                        "businessId businessName ownerEmail billingCycle amount reference paymentMethod status confirmedAt createdAt updatedAt"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .limit(100)
                    .lean();

            return res.json({
                success: true,
                requests
            });

        } catch (error) {

            console.error(
                "ADMIN PREMIUM REQUESTS ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Could not load Premium requests."
                });
        }
    }
);
// =========================================
// UPDATE PREMIUM REQUEST STATUS
// =========================================

app.patch(
    "/api/admin/premium-requests/:id/status",
    requireAdmin,
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid Premium request ID."
                });
            }

            const status =
                String(
                    req.body.status || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                ![
                    "pending",
                    "confirmed",
                    "rejected"
                ].includes(status)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid Premium request status."
                });
            }

            const premiumRequest =
                await PremiumRequest.findById(
                    req.params.id
                );

            if (!premiumRequest) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Premium request not found."
                });
            }
            // A confirmed payment is final.
// Do not allow it to be confirmed again or reversed.
if (premiumRequest.status === "confirmed") {

    if (status === "confirmed") {

        return res.json({
            success: true,
            message:
                "This Premium payment is already confirmed.",
            request: {
                id:
                    premiumRequest._id,

                businessId:
                    premiumRequest.businessId,

                billingCycle:
                    premiumRequest.billingCycle,

                amount:
                    premiumRequest.amount,

                reference:
                    premiumRequest.reference,

                status:
                    premiumRequest.status,

                confirmedAt:
                    premiumRequest.confirmedAt
            }
        });
    }

    return res.status(409).json({
        success: false,
        message:
            "A confirmed Premium payment cannot be changed back to pending or rejected."
    });
}

            // Confirming payment activates Premium.
            if (status === "confirmed") {

                const business =
                    await Business.findOne({
                        id:
                            premiumRequest.businessId
                    });

                if (!business) {
                    return res.status(404).json({
                        success: false,
                        message:
                            "Business linked to this Premium request was not found."
                    });
                }

                const startedAt =
                    new Date();

                const expiresAt =
                    new Date(startedAt);

const monthsToAdd =
    premiumRequest.billingCycle === "yearly"
        ? 12
        : 1;

const originalDay =
    expiresAt.getDate();

expiresAt.setDate(1);

expiresAt.setMonth(
    expiresAt.getMonth() + monthsToAdd
);

const lastDayOfTargetMonth =
    new Date(
        expiresAt.getFullYear(),
        expiresAt.getMonth() + 1,
        0
    ).getDate();

expiresAt.setDate(
    Math.min(
        originalDay,
        lastDayOfTargetMonth
    )
);


                business.plan =
                    "premium";

                business.planStatus =
                    "active";

                business.planStartedAt =
                    startedAt;

                business.planExpiresAt =
                    expiresAt;

                await business.save();

                premiumRequest.confirmedAt =
                    startedAt;
            }

            premiumRequest.status =
                status;

            if (status !== "confirmed") {
                premiumRequest.confirmedAt =
                    null;
            }

            await premiumRequest.save();

            return res.json({
                success: true,

                message:
                    status === "confirmed"
                        ? "Premium payment confirmed and business activated."
                        : `Premium request changed to ${status}.`,

                request: {
                    id:
                        premiumRequest._id,

                    businessId:
                        premiumRequest.businessId,

                    billingCycle:
                        premiumRequest.billingCycle,

                    amount:
                        premiumRequest.amount,

                    reference:
                        premiumRequest.reference,

                    status:
                        premiumRequest.status,

                    confirmedAt:
                        premiumRequest.confirmedAt
                }
            });

        } catch (error) {

            console.error(
                "UPDATE PREMIUM REQUEST ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not update Premium request."
            });
        }
    }
);

// =========================================
// ADMIN REVIEWS
// =========================================

app.get(
    "/api/admin/reviews",
    requireAdmin,
    async (req, res) => {

        try {

            const reviews =
                await Review.find()
                    .populate(
                        "businessId",
                        "businessName id"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .limit(100)
                    .lean();

            return res.json({
                success: true,
                reviews
            });

        } catch (error) {

            console.error(
                "ADMIN REVIEWS ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not load reviews."
            });
        }
    }
);
// =========================================
// UPDATE REVIEW STATUS
// =========================================

app.patch(
    "/api/admin/reviews/:id/status",
    requireAdmin,
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid review ID."
                });
            }

            const status =
                String(req.body.status || "")
                    .trim()
                    .toLowerCase();

            if (
                ![
                    "pending",
                    "approved",
                    "rejected"
                ].includes(status)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid review status."
                });
            }

            const review =
                await Review.findById(
                    req.params.id
                );

            if (!review) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Review not found."
                });
            }

            review.status = status;

            await review.save();

            return res.json({
                success: true,
                message:
                    `Review ${status} successfully.`,
                review: {
                    id: review._id,
                    status: review.status
                }
            });

        } catch (error) {

            console.error(
                "UPDATE REVIEW STATUS ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not update review."
            });
        }
    }
);
// =========================================
// BUSINESS ROUTES
// =========================================

const businessRoutes =
    require("./routes/businesses");

app.use(
    "/api/businesses",
    businessRoutes
);


// =========================================
// HEALTH CHECK
// =========================================

app.get(
    "/api/health",
    (req, res) => {

        return res.json({
            success: true,

            message:
                "MAYNA API is running"
        });
    }
);
// =========================================
// SUPPORT REQUEST
// =========================================

app.post(
    "/api/support",
    supportLimiter,
    async (req, res, next) => {

        try {

            const {
                name,
                email,
                subject,
                message
            } = req.body;

            // -----------------------------
            // Validate required fields
            // -----------------------------

            if (
                typeof name !== "string" ||
                typeof email !== "string" ||
                typeof subject !== "string" ||
                typeof message !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please complete all required fields."
                });
            }

            const cleanName =
                name.trim();

            const cleanEmail =
                email.trim().toLowerCase();

            const cleanSubject =
                subject.trim();

            const cleanMessage =
                message.trim();

            if (
                !cleanName ||
                !cleanEmail ||
                !cleanSubject ||
                !cleanMessage
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please complete all required fields."
                });
            }

            // -----------------------------
            // Length limits
            // -----------------------------

            if (
                cleanName.length > 100 ||
                cleanEmail.length > 200 ||
                cleanMessage.length > 3000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "One or more fields are too long."
                });
            }

            // -----------------------------
            // Basic email validation
            // -----------------------------

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (
                !emailPattern.test(cleanEmail)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please enter a valid email address."
                });
            }

            // -----------------------------
            // Allowed subjects
            // -----------------------------

            const allowedSubjects = [
                "General support",
                "Business listing",
                "Report a problem",
                "Report a business",
                "Other"
            ];

            if (
                !allowedSubjects.includes(
                    cleanSubject
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid support topic."
                });
            }

            // -----------------------------
            // Save request
            // -----------------------------

            await SupportRequest.create({
                name: cleanName,
                email: cleanEmail,
                subject: cleanSubject,
                message: cleanMessage
            });

            return res.status(201).json({
                success: true,
                message:
                    "Your message has been received. MAYNA support will review it."
            });

        } catch (error) {

            return next(error);
        }
    }
);
// =========================================
// SUBMIT EFT DONATION
// =========================================

app.post(
    "/api/donations",
    donationLimiter,
    async (req, res) => {

        try {

            const name =
                String(req.body.name || "")
                    .trim();

            const email =
                String(req.body.email || "")
                    .trim()
                    .toLowerCase();

            const amount =
                Number(req.body.amount);

            const reference =
                String(req.body.reference || "")
                    .trim()
                    .toUpperCase();

            if (
                !name ||
                name.length > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please enter a valid name."
                });
            }

            if (
                !email ||
                email.length > 200 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please enter a valid email address."
                });
            }

            if (
                !Number.isFinite(amount) ||
                amount < 1 ||
                amount > 1000000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please enter a valid donation amount."
                });
            }

            if (
                !/^MAYNA-\d{6}$/.test(reference)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid MAYNA payment reference."
                });
            }
            const existingDonation =
    await Donation.findOne({
        reference
    }).lean();

if (existingDonation) {

    return res.status(409).json({
        success: false,
        message:
            "This donation reference has already been submitted."
    });
}

            const donation =
                await Donation.create({
                    name,
                    email,
                    amount,
                    reference,
                    paymentMethod: "eft",
                    status: "pending"
                });

            return res.status(201).json({
                success: true,
                message:
                    "Your EFT donation has been submitted for confirmation.",
                donation: {
                    reference:
                        donation.reference,
                    status:
                        donation.status
                }
            });

} catch (error) {

    if (
        error &&
        error.code === 11000
    ) {
        return res.status(409).json({
            success: false,
            message:
                "This donation reference has already been submitted."
        });
    }

    console.error(
        "DONATION SUBMISSION ERROR:",
        error
    );

    return res.status(500).json({
        success: false,
        message:
            "Could not submit the donation."
    });
}
    }
);
// =========================================
// 404 HANDLER
// =========================================

app.use((req, res) => {

    // Unknown API route
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            message: "API endpoint not found."
        });
    }

    // Unknown website page
    return res.status(404).sendFile(
        path.join(
            frontendPath,
            "404.html"
        )
    );
});
// =========================================
// API ERROR HANDLER
// =========================================

app.use((error, req, res, next) => {

    if (
        error instanceof SyntaxError &&
        error.status === 400 &&
        "body" in error
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request."
        });
    }

    if (
        error.type === "entity.too.large"
    ) {
        return res.status(413).json({
            success: false,
            message: "Request body is too large."
        });
    }

    console.error(
        "Unhandled server error:",
        error
    );

    return res.status(500).json({
        success: false,
        message: "Internal server error."
    });
});


// =========================================
// START SERVER
// =========================================

async function startServer() {

    try {

        await connectDatabase();

        app.listen(
            PORT,
            () => {

                console.log("");

                console.log(
                    "=============================="
                );

                console.log(
                    "       MAYNA IS RUNNING"
                );

                console.log(
                    "=============================="
                );

                console.log(
                    "http://localhost:" + PORT
                );

                console.log("");
            }
        );

    } catch (error) {

        console.error(
            "SERVER START ERROR:",
            error
        );

        process.exit(1);
    }
}

startServer();
