const express = require("express");
const crypto = require("crypto");
const { Resend } = require("resend");

const Business = require("../models/Business");

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

    return safeBusiness;
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

            const businesses =
                await Business
                    .find()
                    .sort({
                        createdAt: -1
                    });

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
// FORGOT PASSWORD
// ========================================

router.post(
    "/forgot-password",
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
                    ownerEmail: email
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
                        "MAYNA — Reset your password",

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
                                Hello ${business.businessName || "Business Owner"},
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
                                MAYNA — Discover. Connect. Grow.
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
// RESET PASSWORD
// ========================================

router.post(
    "/reset-password",
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
                newPassword.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must be at least 6 characters."

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

                });

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
// OWNER LOGIN
// ========================================

router.post(
    "/owner/login",
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
                });

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

            req.session.ownerBusinessId =
                business.id;

            return res.json({

                success: true,

                message:
                    "Owner login successful.",

                business:
                    publicBusiness(
                        business
                    )

            });

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

                    authenticated:
                        false

                });
            }

            const business =
                await Business.findOne({
                    id:
                        Number(
                            req.session.ownerBusinessId
                        )
                });

            if (!business) {

                req.session.ownerBusinessId =
                    null;

                return res.status(401).json({

                    success: false,

                    authenticated:
                        false

                });
            }

            return res.json({

                success: true,

                authenticated:
                    true,

                business:
                    publicBusiness(
                        business
                    )

            });

        } catch (error) {

            console.error(
                "OWNER SESSION ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                authenticated:
                    false

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

        req.session.ownerBusinessId =
            null;

        return res.json({

            success: true,

            message:
                "Owner logged out successfully."

        });
    }
);


// ========================================
// REGISTER BUSINESS
// ========================================

router.post(
    "/",
    async (req, res) => {

        try {

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
                ownerPassword.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must be at least 6 characters."

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
    Array.isArray(req.body.gallery)
        ? req.body.gallery
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

                    services:
                        req.body.services || "",

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

            req.session.ownerBusinessId =
                newBusiness.id;

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

        } catch (error) {

            console.error(
                "REGISTER BUSINESS ERROR:",
                error
            );

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
// UPDATE BUSINESS
// OWNER ONLY
// ========================================

router.put(
    "/:id",
    async (req, res) => {

        try {

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
    business.gallery =
        Array.isArray(req.body.gallery)
            ? req.body.gallery
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
                req.body.services !==
                undefined
            ) {
                business.services =
                    req.body.services;
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

            return res.status(500).json({

                success: false,

                message:
                    "Server error while updating business."

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


module.exports = router;