const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { Resend } = require("resend");

const Business = require("../models/Business");
const PremiumRequest =
    require("../models/PremiumRequest");
const Review = require("../models/Review");
const Promotion = require("../models/Promotion");

const router = express.Router();

const resend = new Resend(
    process.env.RESEND_API_KEY
);


// ========================================
// HIDE PRIVATE OWNER DATA
// ========================================

function publicBusiness(business) {

    const safeBusiness =
        business.toObject
            ? business.toObject()
            : { ...business };

delete safeBusiness.ownerEmail;
delete safeBusiness.ownerPasswordHash;
delete safeBusiness.ownerPasswordSalt;
delete safeBusiness.resetTokenHash;
delete safeBusiness.resetTokenExpires;
delete safeBusiness.planStartedAt;
delete safeBusiness.planExpiresAt;
delete safeBusiness.analytics;

    return safeBusiness;
}
// ========================================
// BUSINESS INPUT VALIDATION
// ========================================
function validateBusinessInput(body) {

    const stringFields = [
        ["businessName", 120],
        ["location", 100],
        ["category", 80],
        ["phone", 30],
        ["whatsapp", 30],
        ["email", 254],
        ["ownerEmail", 254],
        ["description", 2000]
    ];

    for (
        const [field, maxLength]
        of stringFields
    ) {

        if (
            body[field] !== undefined &&
            typeof body[field] !== "string"
        ) {
            return `${field} must be text.`;
        }

        if (
            typeof body[field] === "string" &&
            body[field].length > maxLength
        ) {
            return `${field} is too long.`;
        }
    }

    // BUSINESS EMAIL
    if (
        body.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            body.email
        )
    ) {
        return "Please enter a valid email address.";
    }

    // OWNER EMAIL
    if (
        body.ownerEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            body.ownerEmail
        )
    ) {
        return "Please enter a valid owner email address.";
    }

        // BUSINESS NAME
    if (
        body.businessName === undefined ||
        typeof body.businessName !== "string" ||
        body.businessName.trim() === ""
    ) {
        return "Business name is required.";
    }

    // LOCATION
    if (
        body.location === undefined ||
        typeof body.location !== "string" ||
        body.location.trim() === ""
    ) {
        return "Business location is required.";
    }

    // MAIN IMAGE
    if (
        body.image !== undefined &&
        typeof body.image !== "string"
    ) {
        return "Invalid business image.";
    }

    if (
        body.image &&
        !body.image.startsWith(
            "https://res.cloudinary.com/"
        )
    ) {
        return "Invalid business image URL.";
    }

    // GALLERY
    if (
        body.gallery !== undefined &&
        !Array.isArray(
            body.gallery
        )
    ) {
        return "Gallery must be an array.";
    }

    if (
        Array.isArray(
            body.gallery
        )
    ) {

        if (
            body.gallery.length > 20
        ) {
            return "Gallery cannot contain more than 20 images.";
        }

        for (
            const image
            of body.gallery
        ) {

            if (
                typeof image !== "string" ||
                !image.startsWith(
                    "https://res.cloudinary.com/"
                )
            ) {
                return "Gallery contains an invalid image URL.";
            }
        }
    }

        // PREMIUM SOCIAL LINKS
    if (
        body.socialLinks !== undefined
    ) {
        if (
            !body.socialLinks ||
            typeof body.socialLinks !== "object" ||
            Array.isArray(body.socialLinks)
        ) {
            return "Social links must be an object.";
        }

        const allowedSocialLinks = [
            "website",
            "facebook",
            "instagram",
            "tiktok",
            "twitter",
            "linkedin",
            "youtube"
        ];

        for (const platform of allowedSocialLinks) {
            const value =
                body.socialLinks[platform];

            if (value === undefined) {
                continue;
            }

            if (typeof value !== "string") {
                return `${platform} link must be text.`;
            }

            if (value.length > 500) {
                return `${platform} link is too long.`;
            }

            if (value.trim() === "") {
                continue;
            }

            try {
                const parsedUrl =
                    new URL(value.trim());

                if (
                    parsedUrl.protocol !== "https:" &&
                    parsedUrl.protocol !== "http:"
                ) {
                    return `${platform} link must use http or https.`;
                }
            } catch {
                return `Please enter a valid ${platform} URL.`;
            }
        }
    }

    // SERVICES
    if (
        body.services !== undefined &&
        !Array.isArray(
            body.services
        )
    ) {
        return "Services must be an array.";
    }

    if (
        Array.isArray(
            body.services
        )
    ) {

        if (
            body.services.length > 50
        ) {
            return "Too many services.";
        }

        for (
            const service
            of body.services
        ) {

            if (
                !service ||
                typeof service !== "object" ||
                Array.isArray(service)
            ) {
                return "Invalid service.";
            }

            if (
                service.name !== undefined &&
                (
                    typeof service.name !== "string" ||
                    service.name.length > 120
                )
            ) {
                return "Invalid service name.";
            }

            if (
                service.price !== undefined &&
                (
                    typeof service.price !== "string" ||
                    service.price.length > 80
                )
            ) {
                return "Invalid service price.";
            }

            if (
                service.description !== undefined &&
                (
                    typeof service.description !== "string" ||
                    service.description.length > 500
                )
            ) {
                return "Invalid service description.";
            }
        }
    }

    // OPENING HOURS
    if (
        body.hours !== undefined
    ) {

        if (
            !body.hours ||
            typeof body.hours !== "object" ||
            Array.isArray(
                body.hours
            )
        ) {
            return "Invalid opening hours.";
        }

        const days = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday"
        ];

        for (
            const day
            of days
        ) {

            if (
                body.hours[day] !== undefined &&
                (
                    typeof body.hours[day] !== "string" ||
                    body.hours[day].length > 50
                )
            ) {
                return `Invalid ${day} opening hours.`;
            }
        }
    }

    return null;
}

// ========================================
// PASSWORD HASHING
// ========================================

function hashPassword(
    password,
    salt = null
) {

    const passwordSalt =
        salt ||
        crypto.randomBytes(16).toString("hex");

    const passwordHash =
        crypto
            .scryptSync(
                password,
                passwordSalt,
                64
            )
            .toString("hex");

    return {
        passwordHash,
        passwordSalt
    };
}


// ========================================
// CHECK PASSWORD
// ========================================

function verifyPassword(
    password,
    storedHash,
    storedSalt
) {

    if (
        !storedHash ||
        !storedSalt
    ) {
        return false;
    }

    try {

        const result =
            hashPassword(
                password,
                storedSalt
            );

        const calculatedHash =
            Buffer.from(
                result.passwordHash,
                "hex"
            );

        const savedHash =
            Buffer.from(
                storedHash,
                "hex"
            );

        if (
            calculatedHash.length !==
            savedHash.length
        ) {
            return false;
        }

        return crypto.timingSafeEqual(
            calculatedHash,
            savedHash
        );

    } catch (error) {

        return false;
    }
}


// ========================================
// HASH RESET TOKEN
// ========================================

function hashResetToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


// ========================================
// GET ALL BUSINESSES
// ========================================

router.get(
    "/",
    async (req, res) => {

        try {

            await Business.updateMany(
    {
        plan: "premium",
        planStatus: "active",
        planExpiresAt: {
            $ne: null,
            $lte: new Date()
        }
    },
    {
        $set: {
            plan: "free",
            planStatus: "expired"
        }
    }
);

            const search =
                typeof req.query.search === "string"
                    ? req.query.search
                        .trim()
                        .slice(0, 100)
                    : "";

            const category =
                typeof req.query.category === "string"
                    ? req.query.category
                        .trim()
                        .slice(0, 80)
                    : "";
                    const town =
    typeof req.query.town === "string"
        ? req.query.town
            .trim()
            .slice(0, 100)
        : "";

            const filter = {};

            if (
                req.query.verified === "true"
            ) {

                filter.verified =
                    true;
            }

            if (category) {

                filter.category =
                    category;
            }
            if (town) {

    filter.town =
        town;
}

            if (search) {

                const escapedSearch =
                    search.replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&"
                    );

                const searchRegex =
                    new RegExp(
                        escapedSearch,
                        "i"
                    );

                filter.$or = [
                    {
                        businessName:
                            searchRegex
                    },
                    {
                        category:
                            searchRegex
                    },
                    {
                        town:
                            searchRegex
                    },
                    {
                        description:
                            searchRegex
                    },
                    {
                        "services.name":
                            searchRegex
                    },
                    {
                        "services.price":
                            searchRegex
                    },
                    {
                        "services.description":
                            searchRegex
                    }
                ];
            }

            const requestedPage =
                Number.parseInt(
                    req.query.page,
                    10
                );

            const requestedLimit =
                Number.parseInt(
                    req.query.limit,
                    10
                );

            const paginationRequested =
                Number.isFinite(requestedPage) ||
                Number.isFinite(requestedLimit);

            const page =
                Number.isFinite(requestedPage) &&
                requestedPage > 0
                    ? requestedPage
                    : 1;

            const limit =
                Number.isFinite(requestedLimit) &&
                requestedLimit > 0
                    ? Math.min(
                        requestedLimit,
                        50
                    )
                    : 20;

let query =
    Business
        .find(filter)
        .sort({
            planStatus: 1,
            plan: -1,
            createdAt: -1
        });

            if (paginationRequested) {

                query =
                    query
                        .skip(
                            (page - 1) * limit
                        )
                        .limit(limit);
            }

            const businesses =
                await query;


            if (paginationRequested) {

                const total =
                    await Business.countDocuments(
                        filter
                    );

                return res.json({

                    success: true,

                    businesses:
                        businesses.map(
                            publicBusiness
                        ),

                    pagination: {

                        page:
                            page,

                        limit:
                            limit,

                        total:
                            total,

                        totalPages:
                            Math.ceil(
                                total / limit
                            )

                    }

                });
            }


            return res.json({

                success: true,

                businesses:
                    businesses.map(
                        publicBusiness
                    )

            });

        } catch (error) {

            console.error(
                "GET BUSINESSES ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error while loading businesses."

            });
        }
    }
);


// ========================================
// PASSWORD RESET REQUEST RATE LIMIT
// ========================================

const forgotPasswordLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        limit: 3,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many password reset requests. Please try again in 15 minutes."
        }
    });


// ========================================
// FORGOT PASSWORD
// ========================================

router.post(
    "/forgot-password",
    forgotPasswordLimiter,
    async (req, res) => {

        try {

            const email =
                String(
                    req.body.email || ""
                )
                    .trim()
                    .toLowerCase();

            const genericMessage =
                "If an account exists for that email, a password reset link has been generated.";

            if (!email) {

                return res.json({

                    success: true,

                    message:
                        genericMessage

                });
            }
            const business =
                await Business.findOne({
                    ownerEmail:
                        email
                });


            if (!business) {

                return res.json({

                    success: true,

                    message:
                        genericMessage

                });
            }


            const resetToken =
                crypto
                    .randomBytes(32)
                    .toString("hex");


            business.resetTokenHash =
                hashResetToken(
                    resetToken
                );


            business.resetTokenExpires =
                new Date(
                    Date.now() +
                    (60 * 60 * 1000)
                );


            await business.save();


            const resetLink =
                `https://myna-web-i92o.onrender.com/reset-password.html?token=${resetToken}`;


            const {
                data,
                error
            } =
                await resend.emails.send({

                    from:
                        "MAYNA <onboarding@resend.dev>",

                    to:
                        [email],

                    subject:
                        "MAYNA â€” Reset your password",

                    html: `
                        <div style="
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: auto;
                            padding: 30px;
                            color: #222;
                        ">

                            <h1>MAYNA</h1>

                            <h2>
                                Reset your password
                            </h2>

                            <p>
                                Hello ${
                                    business.businessName ||
                                    "Business Owner"
                                },
                            </p>

                            <p>
                                We received a request to reset
                                the password for your MAYNA
                                business owner account.
                            </p>

                            <p>
                                Click the button below to
                                create a new password.
                            </p>

                            <p style="margin: 30px 0;">

                                <a
                                    href="${resetLink}"
                                    style="
                                        display: inline-block;
                                        padding: 14px 22px;
                                        background: #2563eb;
                                        color: white;
                                        text-decoration: none;
                                        border-radius: 7px;
                                        font-weight: bold;
                                    "
                                >
                                    Reset My Password
                                </a>

                            </p>

                            <p>
                                This link expires in
                                <strong>1 hour</strong>.
                            </p>

                            <p>
                                If you did not request this
                                password reset, you can safely
                                ignore this email.
                            </p>

                            <hr>

                            <p style="
                                color: #777;
                                font-size: 13px;
                            ">
                                MAYNA â€” Discover. Connect. Grow.
                            </p>

                        </div>
                    `
                });


            if (error) {

                console.error(
                    "RESEND EMAIL ERROR:",
                    error
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Could not send the password reset email."

                });
            }


            console.log(
                "PASSWORD RESET EMAIL SENT:",
                data?.id || "No ID"
            );


            return res.json({

                success: true,

                message:
                    genericMessage

            });


        } catch (error) {

            console.error(
                "FORGOT PASSWORD ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Could not process your request."

            });
        }
    }
);


// ========================================
// PASSWORD RESET RATE LIMIT
// ========================================

const resetPasswordLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        limit: 5,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many password reset attempts. Please try again in 15 minutes."
        }
    });


// ========================================
// RESET PASSWORD
// ========================================

router.post(
    "/reset-password",
    resetPasswordLimiter,
    async (req, res) => {

        try {

            const token =
                String(
                    req.body.token || ""
                ).trim();

            const newPassword =
                String(
                    req.body.password || ""
                );

            if (!token) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Reset token is required."

                });
            }

            if (
                !newPassword ||
                newPassword.length < 6 ||
                newPassword.length > 128
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        newPassword.length > 128
                            ? "Password cannot exceed 128 characters."
                            : "Password must be at least 6 characters."

                });
            }

            const tokenHash =
                hashResetToken(
                    token
                );

            const business =
                await Business.findOne({

                    resetTokenHash:
                        tokenHash,

                    resetTokenExpires: {
                        $gt: new Date()
                    }

                }).select(
                    "+resetTokenHash +resetTokenExpires"
                );

            if (!business) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This reset link is invalid or has expired."

                });
            }

            const passwordData =
                hashPassword(
                    newPassword
                );

            business.ownerPasswordHash =
                passwordData.passwordHash;

            business.ownerPasswordSalt =
                passwordData.passwordSalt;

            business.resetTokenHash =
                null;

            business.resetTokenExpires =
                null;

            await business.save();

            return res.json({

                success: true,

                message:
                    "Password reset successfully. You can now log in."

            });

        } catch (error) {

            console.error(
                "RESET PASSWORD ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error while resetting password."

            });
        }
    }
);


// ========================================
// OWNER LOGIN RATE LIMIT
// ========================================

const ownerLoginLimiter =
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


// ========================================
// OWNER LOGIN
// ========================================

router.post(
    "/owner/login",
    ownerLoginLimiter,
    async (req, res) => {

        try {

            const email =
                String(
                    req.body.email || ""
                )
                    .trim()
                    .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );

            if (
                !email ||
                !password
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Email and password are required."
                });
            }

            const business =
                await Business.findOne({
                    ownerEmail: email
                }).select(
                    "+ownerPasswordHash +ownerPasswordSalt"
                );

            if (!business) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid email or password."
                });
            }

            const passwordCorrect =
                verifyPassword(
                    password,
                    business.ownerPasswordHash,
                    business.ownerPasswordSalt
                );

            if (!passwordCorrect) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid email or password."
                });
            }

 return req.session.regenerate(
    (regenerateError) => {

        if (regenerateError) {

            console.error(
                "Owner session regeneration failed:",
                regenerateError
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not create owner session."
            });
        }

        req.session.ownerBusinessId =
            business.id;

        return req.session.save(
            (saveError) => {

                if (saveError) {

                    console.error(
                        "Owner session save failed:",
                        saveError
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Could not create owner session."
                    });
                }

                return res.json({
                    success: true,
                    message:
                        "Owner login successful.",

business: {
    ...publicBusiness(
        business
    ),

    planStartedAt:
        business.planStartedAt,

planExpiresAt:
    business.planExpiresAt,

analytics:
    business.plan === "premium" &&
    business.planStatus === "active" &&
    business.planExpiresAt &&
    new Date(business.planExpiresAt) > new Date()
        ? {
            profileViews:
                business.analytics?.profileViews || 0,

            phoneClicks:
                business.analytics?.phoneClicks || 0,

            whatsappClicks:
                business.analytics?.whatsappClicks || 0,

            socialClicks:
                business.analytics?.socialClicks || 0
        }
        : null
}
                });
            }
        );
    }
);

        } catch (error) {

            console.error(
                "OWNER LOGIN ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error during owner login."
            });
        }
    }
);


// ========================================
// OWNER SESSION CHECK
// ========================================

router.get(
    "/owner/session",
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.ownerBusinessId
            ) {

                return res.status(401).json({
                    success: false,
                    authenticated: false
                });
            }

            const business =
                await Business.findOne({
                    id: Number(
                        req.session.ownerBusinessId
                    )
                });

            if (!business) {

                req.session.ownerBusinessId =
                    null;

                return res.status(401).json({
                    success: false,
                    authenticated: false
                });
            }
            // Automatically expire Premium plan
            if (
                business.plan === "premium" &&
                business.planStatus === "active" &&
                business.planExpiresAt &&
                new Date(business.planExpiresAt) <= new Date()
            ) {

                business.plan =
                    "free";

                business.planStatus =
                    "expired";

                await business.save();
            }
            return res.json({

                success: true,
                authenticated: true,

                business: {
                    ...publicBusiness(
                        business
                    ),

                    planStartedAt:
                        business.planStartedAt,

planExpiresAt:
    business.planExpiresAt,

analytics:
    business.plan === "premium" &&
    business.planStatus === "active" &&
    business.planExpiresAt &&
    new Date(business.planExpiresAt) > new Date()
        ? {
            profileViews:
                business.analytics?.profileViews || 0,

            phoneClicks:
                business.analytics?.phoneClicks || 0,

            whatsappClicks:
                business.analytics?.whatsappClicks || 0,

            socialClicks:
                business.analytics?.socialClicks || 0
        }
        : null
}

});

        } catch (error) {

            console.error(
                "OWNER SESSION ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                authenticated: false
            });
        }
    }
);

// ========================================
// PREMIUM REQUEST RATE LIMIT
// ========================================

const premiumRequestLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        limit: 5,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many Premium requests. Please try again in 15 minutes."
        }
    });
// ========================================
// CREATE PREMIUM REQUEST
// OWNER ONLY
// ========================================

router.post(
    "/premium/request",
    premiumRequestLimiter,
    async (req, res) => {

        try {

            if (
                !req.session ||
                !req.session.ownerBusinessId
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Owner authentication required."
                });
            }

            const billingCycle =
                String(
                    req.body.billingCycle || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                ![
                    "monthly",
                    "yearly"
                ].includes(billingCycle)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please choose a valid Premium billing cycle."
                });
            }

            const business =
                await Business.findOne({
                    id: Number(
                        req.session.ownerBusinessId
                    )
                });

            if (!business) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Business not found."
                });
            }

            if (
                business.plan === "premium" &&
                business.planStatus === "active"
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        "This business already has an active Premium plan."
                });
            }

            const existingRequest =
                await PremiumRequest.findOne({
                    businessId:
                        business.id,
                    status:
                        "pending"
                });

            if (existingRequest) {
                return res.status(409).json({
                    success: false,
                    message:
                        "This business already has a pending Premium request.",

                    request: {
                        billingCycle:
                            existingRequest.billingCycle,

                        amount:
                            existingRequest.amount,

                        reference:
                            existingRequest.reference,

                        status:
                            existingRequest.status
                    }
                });
            }
            const amount =
                billingCycle === "yearly"
                    ? 863.89
                    : 79.99;

            let reference;
            let referenceExists = true;

            while (referenceExists) {

                reference =
                    "MAYNA-PREM-" +
                    Math.floor(
                        100000 +
                        Math.random() * 900000
                    );

                referenceExists =
                    await PremiumRequest.exists({
                        reference
                    });
            }

            const premiumRequest =
                await PremiumRequest.create({
                    businessId:
                        business.id,

                    businessName:
                        business.businessName,

                    ownerEmail:
                        business.ownerEmail,

                    billingCycle,

                    amount,

                    reference,

                    paymentMethod:
                        "eft",

                    status:
                        "pending"
                });

            return res.status(201).json({
                success: true,

                message:
                    "Premium request created. Payment confirmation is required before Premium is activated.",

                request: {
                    billingCycle:
                        premiumRequest.billingCycle,

                    amount:
                        premiumRequest.amount,

                    reference:
                        premiumRequest.reference,

                    status:
                        premiumRequest.status
                }
            });

        } catch (error) {

            console.error(
                "PREMIUM REQUEST ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error while creating Premium request."
            });
        }
    }
);


// ========================================
// OWNER LOGOUT
// ========================================

router.post(
    "/owner/logout",
    (req, res) => {

        if (!req.session) {

            return res.json({
                success: true
            });
        }

        req.session.destroy(
            (error) => {

                if (error) {

                    console.error(
                        "OWNER LOGOUT ERROR:",
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
                        "Owner logged out successfully."
                });
            }
        );
    }
);


// ========================================
// BUSINESS REGISTRATION RATE LIMIT
// ========================================

const registrationLimiter =
    rateLimit({
        windowMs:
            60 * 60 * 1000,

        limit: 5,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                "Too many registration attempts. Please try again later."
        }
    });


// ========================================
// REGISTER BUSINESS
// ========================================

router.post(
    "/",
    registrationLimiter,
    async (req, res) => {

        try {
            const validationError =
    validateBusinessInput(
        req.body
    );

if (validationError) {

    return res.status(400).json({
        success: false,
        message:
            validationError
    });
}
const registrationGallery =
    Array.isArray(req.body.gallery)
        ? req.body.gallery
        : [];

if (registrationGallery.length > 3) {

    return res.status(403).json({
        success: false,
        message:
            "Free businesses can have up to 3 gallery photos. Upgrade to Premium for up to 20 photos."
    });
}

            const ownerEmail =
                String(
                    req.body.ownerEmail || ""
                )
                    .trim()
                    .toLowerCase();

            const ownerPassword =
                String(
                    req.body.ownerPassword || ""
                );

            if (!ownerEmail) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Owner email is required."

                });
            }

            if (
                !ownerPassword ||
                ownerPassword.length < 6 ||
                ownerPassword.length > 128
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        ownerPassword.length > 128
                            ? "Password cannot exceed 128 characters."
                            : "Password must be at least 6 characters."

                });
            }

            const existingOwner =
                await Business.findOne({
                    ownerEmail:
                        ownerEmail
                });

            if (existingOwner) {

                return res.status(409).json({

                    success: false,

                    message:
                        "An owner account with this email already exists."

                });
            }

            const passwordData =
                hashPassword(
                    ownerPassword
                );

            const newBusiness =
                await Business.create({

                    id:
                        Date.now(),

                    businessName:
                        req.body.businessName || "",

                    image:
                        req.body.image || "",

                    gallery:
                        registrationGallery,

                    services:
                        Array.isArray(req.body.services)
                            ? req.body.services
                            : [],

                    country:
                        "Namibia",

                    town:
                        req.body.location || "",

                    category:
                        req.body.category || "Other",

                    phone:
                        req.body.phone || "",

                    whatsapp:
                        req.body.whatsapp || "",

                    email:
                        req.body.email || "",

                    description:
                        req.body.description || "",

                    ownerEmail:
                        ownerEmail,

                    ownerPasswordHash:
                        passwordData.passwordHash,

                    ownerPasswordSalt:
                        passwordData.passwordSalt,

                    claimed:
                        true,

                    verified:
                        false,

                    hours: {

                        monday: "",
                        tuesday: "",
                        wednesday: "",
                        thursday: "",
                        friday: "",
                        saturday: "",
                        sunday: ""

                    }

                });

return req.session.regenerate(
    (regenerateError) => {

        if (regenerateError) {

            console.error(
                "Registration session regeneration failed:",
                regenerateError
            );

            return res.status(500).json({
                success: false,
                message:
                    "Business was registered, but the owner session could not be created."
            });
        }

        req.session.ownerBusinessId =
            newBusiness.id;

        return req.session.save(
            (saveError) => {

                if (saveError) {

                    console.error(
                        "Registration session save failed:",
                        saveError
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Business was registered, but the owner session could not be created."
                    });
                }

                console.log(
                    "New MongoDB business registered:",
                    newBusiness.businessName
                );

                return res.status(201).json({

                    success: true,

                    message:
                        "Business registered successfully.",

                    business:
                        publicBusiness(
                            newBusiness
                        )

                });
            }
        );
    }
);

        } catch (error) {

            console.error(
                "REGISTER BUSINESS ERROR:",
                error
            );

            if (
                error &&
                error.name === "ValidationError"
            ) {

                const firstError =
                    Object.values(
                        error.errors || {}
                    )[0];

                return res.status(400).json({

                    success: false,

                    message:
                        firstError?.message ||
                        "Invalid business data."

                });
            }

            if (
                error &&
                error.code === 11000
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "This business account already exists."

                });
            }

            return res.status(500).json({

                success: false,

                message:
                    "Server error while registering business."

            });
        }
    }
);


// ========================================
// VERIFY / UNVERIFY BUSINESS
// ADMIN ONLY
// ========================================

router.put(
    "/:id/verification",

    (req, res, next) => {

        if (
            req.session &&
            req.session.isAdmin === true
        ) {

            next();
            return;
        }

        return res.status(401).json({

            success: false,

            message:
                "Admin authentication required."

        });
    },

    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const verified =
                req.body.verified === true;

            const business =
                await Business.findOneAndUpdate(

                    {
                        id: id
                    },

                    {
                        $set: {
                            verified:
                                verified
                        }
                    },

                    {
                        new: true,
                        runValidators: true
                    }

                );

            if (!business) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Business not found."

                });
            }

            return res.json({

                success: true,

                message:
                    verified
                        ? "Business verified successfully."
                        : "Business unverified successfully.",

                business:
                    publicBusiness(
                        business
                    )

            });

        } catch (error) {

            console.error(
                "VERIFICATION ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error while changing verification status."

            });
        }
    }
);

// ========================================
// DELETE BUSINESS
// ADMIN ONLY
// ========================================

router.delete(
    "/:id",

    async (req, res) => {

        try {

            if (
                !req.session ||
                req.session.isAdmin !== true
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Admin authentication required."

                });
            }


            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isFinite(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid business ID."

                });
            }


            const business =
                await Business.findOneAndDelete({
                    id: id
                });


            if (!business) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Business not found."

                });
            }


            return res.json({

                success: true,

                message:
                    "Business deleted successfully."

            });


        } catch (error) {

            console.error(
                "DELETE BUSINESS ERROR:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Server error while deleting business."

            });
        }
    }
);

// ========================================
// UPDATE BUSINESS
// OWNER ONLY
// ========================================

router.put(
    "/:id",
    async (req, res) => {

        try {
            const validationError =
    validateBusinessInput(
        req.body
    );

if (validationError) {

    return res.status(400).json({
        success: false,
        message:
            validationError
    });
}


            if (
                !req.session ||
                !req.session.ownerBusinessId
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Owner login required."

                });
            }

            const id =
                Number(
                    req.params.id
                );

            if (
                String(
                    req.session.ownerBusinessId
                ) !==
                String(id)
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You are not authorized to edit this business."

                });
            }

            const business =
                await Business.findOne({
                    id: id
                });

            if (!business) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Business not found."

                });
            }

            if (
                req.body.businessName !==
                undefined
            ) {
                business.businessName =
                    req.body.businessName;
            }

            if (
                req.body.image !==
                undefined
            ) {
                business.image =
                    req.body.image;
            }

if (
    req.body.gallery !==
    undefined
) {
    const requestedGallery =
        Array.isArray(req.body.gallery)
            ? req.body.gallery
            : [];

    const hasActivePremium =
        business.plan === "premium" &&
        business.planStatus === "active" &&
        business.planExpiresAt &&
        business.planExpiresAt > new Date();

const existingGalleryLength =
    Array.isArray(business.gallery)
        ? business.gallery.length
        : 0;

if (
    hasActivePremium &&
    requestedGallery.length > 20
) {
    return res.status(403).json({
        success: false,
        message:
            "Premium businesses can have up to 20 gallery photos."
    });
}

if (
    !hasActivePremium &&
    requestedGallery.length > 3 &&
    requestedGallery.length >
        existingGalleryLength
) {
    return res.status(403).json({
        success: false,
        message:
            "Free businesses can have up to 3 gallery photos. Upgrade to Premium for up to 20 photos."
    });
}

    business.gallery =
        requestedGallery;
}

            if (
                req.body.socialLinks !==
                undefined
            ) {
                const hasActivePremium =
                    business.plan === "premium" &&
                    business.planStatus === "active" &&
                    business.planExpiresAt &&
                    business.planExpiresAt > new Date();

                if (!hasActivePremium) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Social media links are available to active Premium businesses only."
                    });
                }

                const allowedSocialLinks = [
                    "website",
                    "facebook",
                    "instagram",
                    "tiktok",
                    "twitter",
                    "linkedin",
                    "youtube"
                ];

                const socialLinks = {};

                for (const platform of allowedSocialLinks) {
                    const value =
                        req.body.socialLinks[
                            platform
                        ];

                    socialLinks[platform] =
                        typeof value === "string"
                            ? value.trim()
                            : "";
                }

                business.socialLinks =
                    socialLinks;
            }

            if (
                req.body.services !==
                undefined
            ) {
                business.services =
                    Array.isArray(req.body.services)
                        ? req.body.services
                        : [];
            }

            if (
                req.body.category !==
                undefined
            ) {
                business.category =
                    req.body.category;
            }

            if (
                req.body.location !==
                undefined
            ) {
                business.town =
                    req.body.location;
            }

            if (
                req.body.phone !==
                undefined
            ) {
                business.phone =
                    req.body.phone;
            }

            if (
                req.body.whatsapp !==
                undefined
            ) {
                business.whatsapp =
                    req.body.whatsapp;
            }

            if (
                req.body.email !==
                undefined
            ) {
                business.email =
                    req.body.email;
            }

            if (
                req.body.description !==
                undefined
            ) {
                business.description =
                    req.body.description;
            }

            if (
                req.body.hours !==
                undefined
            ) {
                business.hours =
                    req.body.hours;
            }

            await business.save();

            return res.json({

                success: true,

                message:
                    "Business updated successfully.",

                business:
                    publicBusiness(
                        business
                    )

            });

        } catch (error) {

    console.error(
        "UPDATE BUSINESS ERROR:",
        error
    );

    if (
        error &&
        error.name === "ValidationError"
    ) {

        const firstError =
            Object.values(
                error.errors || {}
            )[0];

        return res.status(400).json({

            success: false,

            message:
                firstError?.message ||
                "Invalid business data."

        });
    }

    if (
        error &&
        error.code === 11000
    ) {

        return res.status(409).json({

            success: false,

            message:
                "This business information conflicts with an existing record."

        });
    }

    return res.status(500).json({

        success: false,

        message:
            "Server error while updating business."

    });
}
    }
);


// ========================================
// CUSTOMER REVIEWS
// ========================================

const reviewLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message:
            "Too many review attempts. Please try again later."
    }
});

router.post(
    "/:id/reviews",
    reviewLimiter,
    async (req, res) => {

        try {

            const businessId =
                Number(req.params.id);

            if (
                !Number.isSafeInteger(businessId) ||
                businessId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid business ID."
                });
            }

const business =
    await Business.findOne({
        id: businessId
    }).select(
        "_id plan planStatus planExpiresAt"
    );

            if (!business) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Business not found."
                });
            }
            const premiumIsActive =
    business.plan === "premium" &&
    business.planStatus === "active" &&
    business.planExpiresAt &&
    business.planExpiresAt > new Date();

if (!premiumIsActive) {
    return res.status(403).json({
        success: false,
        message:
            "Ratings and reviews are available for Premium businesses only."
    });
}

            const customerName =
                typeof req.body.customerName === "string"
                    ? req.body.customerName.trim()
                    : "";

            const comment =
                typeof req.body.comment === "string"
                    ? req.body.comment.trim()
                    : "";

            const rating =
                Number(req.body.rating);

            if (
                customerName.length < 2 ||
                customerName.length > 60
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Name must be between 2 and 60 characters."
                });
            }

            if (
                !Number.isInteger(rating) ||
                rating < 1 ||
                rating > 5
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Rating must be between 1 and 5 stars."
                });
            }

            if (
                comment.length < 2 ||
                comment.length > 300
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Comment must be between 2 and 300 characters."
                });
            }

            await Review.create({
                businessId:
                    business._id,

                customerName,
                rating,
                comment,

                status:
                    "pending"
            });

            return res.status(201).json({
                success: true,
                message:
                    "Thank you. Your review was submitted for approval."
            });

        } catch (error) {

            console.error(
                "Review submission error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not submit review."
            });
        }
    }
);
// ========================================
// GET APPROVED BUSINESS REVIEWS
// ========================================

router.get(
    "/:id/reviews",
    async (req, res) => {

        try {

            const businessId =
                Number(req.params.id);

            if (
                !Number.isSafeInteger(businessId) ||
                businessId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid business ID."
                });
            }

const business =
    await Business.findOne({
        id: businessId
    }).select(
        "_id plan planStatus planExpiresAt"
    );

            if (!business) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Business not found."
                });
            }
            const premiumIsActive =
    business.plan === "premium" &&
    business.planStatus === "active" &&
    business.planExpiresAt &&
    business.planExpiresAt > new Date();

if (!premiumIsActive) {
    return res.status(403).json({
        success: false,
        message:
            "Ratings and reviews are available for Premium businesses only."
    });
}

            const reviews =
                await Review.find({
                    businessId:
                        business._id,

                    status:
                        "approved"
                })
                    .select(
                        "customerName rating comment createdAt"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .limit(20)
                    .lean();

            const ratingSummary =
                await Review.aggregate([
                    {
                        $match: {
                            businessId:
                                business._id,
                            status:
                                "approved"
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            averageRating: {
                                $avg: "$rating"
                            },
                            reviewCount: {
                                $sum: 1
                            }
                        }
                    }
                ]);

            const summary =
                ratingSummary[0];

            return res.json({
                success: true,

                averageRating:
                    summary
                        ? Number(
                            summary.averageRating.toFixed(1)
                        )
                        : 0,

                reviewCount:
                    summary
                        ? summary.reviewCount
                        : 0,

                reviews
            });

        } catch (error) {

            console.error(
                "Review loading error:",
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
// ========================================
// BUSINESS ANALYTICS RATE LIMIT
// ========================================

const analyticsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message:
            "Too many analytics requests. Please try again later."
    }
});
// ========================================
// RECORD BUSINESS ANALYTICS EVENT
// ========================================

router.post(
    "/:id/analytics",
    analyticsLimiter,
    async (req, res) => {

        try {

            const businessId =
                Number(req.params.id);

            if (
                !Number.isFinite(
                    businessId
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid business ID."
                });
            }

            const event =
                typeof req.body.event === "string"
                    ? req.body.event.trim()
                    : "";

            const eventFields = {
                profileView:
                    "analytics.profileViews",
                phoneClick:
                    "analytics.phoneClicks",
                whatsappClick:
                    "analytics.whatsappClicks",
                socialClick:
                    "analytics.socialClicks"
            };

            const analyticsField =
                eventFields[event];

            if (!analyticsField) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid analytics event."
                });
            }

            const business =
                await Business.findOneAndUpdate(
                    {
                        id: businessId
                    },
                    {
                        $inc: {
                            [analyticsField]: 1
                        }
                    },
                    {
                        new: false
                    }
                );

            if (!business) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Business not found."
                });
            }

            return res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "BUSINESS ANALYTICS ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not record analytics."
            });
        }
    }
);
// ========================================
// GET ONE BUSINESS
// Keep this near the bottom because /:id
// is a dynamic route.
// ========================================

router.get(
    "/:id",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            if (
                !Number.isFinite(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid business ID."

                });
            }

            const business =
                await Business.findOne({
                    id: id
                });

            if (!business) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Business not found."

                });
            }

            return res.json({

                success: true,

                business:
                    publicBusiness(
                        business
                    )

            });

        } catch (error) {

            console.error(
                "GET BUSINESS ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error while loading business."

            });
        }
    }
);

// ========================================
// CREATE PREMIUM PROMOTION
// OWNER ONLY
// ========================================

const promotionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message:
            "Too many promotion requests. Please try again later."
    }
});

router.post(
    "/promotions",
    promotionLimiter,
    async (req, res) => {
        try {
            if (
                !req.session ||
                !req.session.ownerBusinessId
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Owner authentication required."
                });
            }

            const business =
                await Business.findOne({
                    id: Number(
                        req.session.ownerBusinessId
                    )
                });

            if (!business) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Business not found."
                });
            }

            const premiumIsActive =
                business.plan === "premium" &&
                business.planStatus === "active" &&
                business.planExpiresAt &&
                business.planExpiresAt > new Date();

            if (!premiumIsActive) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Promotions and special offers are available to active Premium businesses only."
                });
            }

            const title =
                typeof req.body.title === "string"
                    ? req.body.title.trim()
                    : "";

            const description =
                typeof req.body.description === "string"
                    ? req.body.description.trim()
                    : "";

            const offer =
                typeof req.body.offer === "string"
                    ? req.body.offer.trim()
                    : "";

            const image =
                typeof req.body.image === "string"
                    ? req.body.image.trim()
                    : "";

            if (!title || title.length > 120) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Promotion title is required and must be 120 characters or less."
                });
            }

            if (
                !description ||
                description.length > 1000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Promotion description is required and must be 1000 characters or less."
                });
            }

            if (offer.length > 100) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Offer must be 100 characters or less."
                });
            }

            if (
                image &&
                !image.startsWith(
                    "https://res.cloudinary.com/"
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Promotion image must be a valid Cloudinary image."
                });
            }

            const startsAt =
                new Date(req.body.startsAt);

            const expiresAt =
                new Date(req.body.expiresAt);

            if (
                Number.isNaN(startsAt.getTime()) ||
                Number.isNaN(expiresAt.getTime())
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please provide valid promotion dates."
                });
            }

            if (expiresAt <= startsAt) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Promotion expiry must be after its start date."
                });
            }

            const promotionCount =
    await Promotion.countDocuments({
        businessId: business.id,
        status: "active",
        expiresAt: {
            $gt: new Date()
        }
    });

if (promotionCount >= 10) {
    return res.status(409).json({
        success: false,
        message:
            "You can have up to 10 active promotions at a time."
    });
}
            const promotion =
                await Promotion.create({
                    businessId:
                        business.id,
                    title,
                    description,
                    offer,
                    image,
                    startsAt,
                    expiresAt,
                    status:
                        "active"
                });

            return res.status(201).json({
                success: true,
                message:
                    "Promotion created successfully.",
                promotion
            });

        } catch (error) {
            console.error(
                "CREATE PROMOTION ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not create promotion."
            });
        }
    }
);
    // ========================================
// GET OWNER PROMOTIONS
// OWNER ONLY
// ========================================

router.get(
    "/owner/promotions",
    async (req, res) => {
        try {
            if (
                !req.session ||
                !req.session.ownerBusinessId
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Owner authentication required."
                });
            }

            const business =
                await Business.findOne({
                    id: Number(
                        req.session.ownerBusinessId
                    )
                }).select(
                    "id plan planStatus planExpiresAt"
                );

            if (!business) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Business not found."
                });
            }

            const premiumIsActive =
                business.plan === "premium" &&
                business.planStatus === "active" &&
                business.planExpiresAt &&
                business.planExpiresAt > new Date();

            const promotions =
                await Promotion.find({
                    businessId:
                        business.id
                })
                    .sort({
                        createdAt: -1
                    })
                    .select(
                        "title description offer image startsAt expiresAt status createdAt"
                    )
                    .lean();

            return res.json({
                success: true,
                premiumIsActive:
                    Boolean(premiumIsActive),
                promotions
            });

        } catch (error) {
            console.error(
                "GET OWNER PROMOTIONS ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not load promotions."
            });
        }
    }
    );
// ========================================
// GET ACTIVE BUSINESS PROMOTIONS
// PUBLIC
// ========================================

router.get(
    "/:id/promotions",
    async (req, res) => {
        try {
            const businessId =
                Number(req.params.id);

            if (
                !Number.isSafeInteger(businessId) ||
                businessId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid business ID."
                });
            }

            const business =
                await Business.findOne({
                    id: businessId
                }).select(
                    "id plan planStatus planExpiresAt"
                );

            if (!business) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Business not found."
                });
            }

            const now = new Date();

            const premiumIsActive =
                business.plan === "premium" &&
                business.planStatus === "active" &&
                business.planExpiresAt &&
                business.planExpiresAt > now;

            if (!premiumIsActive) {
                return res.json({
                    success: true,
                    promotions: []
                });
            }

            const promotions =
                await Promotion.find({
                    businessId:
                        business.id,

                    status:
                        "active",

                    startsAt: {
                        $lte: now
                    },

                    expiresAt: {
                        $gt: now
                    }
                })
                    .sort({
                        createdAt: -1
                    })
                    .limit(10)
                    .select(
                        "title description offer image startsAt expiresAt createdAt"
                    )
                    .lean();

            return res.json({
                success: true,
                promotions
            });

        } catch (error) {
            console.error(
                "GET PROMOTIONS ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not load promotions."
            });
        }
    }
    );
// ========================================
// DELETE OWNER PROMOTION
// OWNER ONLY
// ========================================

router.delete(
    "/owner/promotions/:promotionId",
    async (req, res) => {
        try {
            if (
                !req.session ||
                !req.session.ownerBusinessId
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Owner authentication required."
                });
            }

            const promotionId =
                req.params.promotionId;

            if (
                !promotionId ||
                !promotionId.match(
                    /^[a-f\d]{24}$/i
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid promotion ID."
                });
            }

            const businessId =
                Number(
                    req.session.ownerBusinessId
                );

            if (
                !Number.isSafeInteger(businessId) ||
                businessId <= 0
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid owner session."
                });
            }

            const promotion =
                await Promotion.findOneAndDelete({
                    _id: promotionId,
                    businessId
                });

            if (!promotion) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Promotion not found."
                });
            }

            return res.json({
                success: true,
                message:
                    "Promotion deleted successfully."
            });

        } catch (error) {
            console.error(
                "DELETE PROMOTION ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Could not delete promotion."
            });
        }
    }
);
module.exports = router;
