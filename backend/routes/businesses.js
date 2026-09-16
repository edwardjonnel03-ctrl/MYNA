const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Resend } = require("resend");

const router = express.Router();

const resend = new Resend(
    process.env.RESEND_API_KEY
);

const dataFile = path.join(
    __dirname,
    "..",
    "..",
    "data",
    "businesses.json"
);


// ========================================
// LOAD BUSINESSES
// ========================================

function loadBusinesses() {

    try {

        if (!fs.existsSync(dataFile)) {

            fs.writeFileSync(
                dataFile,
                "[]"
            );
        }

        const data =
            fs.readFileSync(
                dataFile,
                "utf8"
            );

        if (!data.trim()) {
            return [];
        }

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "ERROR LOADING BUSINESSES:",
            error
        );

        return [];
    }
}


// ========================================
// SAVE BUSINESSES
// ========================================

function saveBusinesses(data) {

    fs.writeFileSync(
        dataFile,
        JSON.stringify(
            data,
            null,
            4
        )
    );
}


// ========================================
// HIDE PRIVATE OWNER DATA
// ========================================

function publicBusiness(business) {

    const safeBusiness = {
        ...business
    };

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

        return crypto.timingSafeEqual(
            Buffer.from(
                result.passwordHash,
                "hex"
            ),
            Buffer.from(
                storedHash,
                "hex"
            )
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


let businesses =
    loadBusinesses();


// ========================================
// GET ALL BUSINESSES
// ========================================

router.get(
    "/",
    (req, res) => {

        businesses =
            loadBusinesses();

        const safeBusinesses =
            businesses.map(
                publicBusiness
            );

        return res.json({

            success: true,

            businesses:
                safeBusinesses

        });
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


            businesses =
                loadBusinesses();


            const business =
                businesses.find(
                    item =>
                        String(
                            item.ownerEmail || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        email
                );


            if (!business) {

                return res.json({

                    success: true,

                    message:
                        genericMessage

                });
            }


            // =====================================
            // CREATE RESET TOKEN
            // =====================================

            const resetToken =
                crypto
                    .randomBytes(32)
                    .toString("hex");


            const resetTokenHash =
                hashResetToken(
                    resetToken
                );


            const resetTokenExpires =
                Date.now() +
                (
                    60 *
                    60 *
                    1000
                );


            business.resetTokenHash =
                resetTokenHash;


            business.resetTokenExpires =
                resetTokenExpires;


            saveBusinesses(
                businesses
            );


            // =====================================
            // RESET LINK
            // =====================================

            const resetLink =
    `https://myna-web-i92o.onrender.com/reset-password.html?token=${resetToken}`;

            // =====================================
            // SEND EMAIL
            // =====================================

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

                        <div
                            style="
                                font-family: Arial, sans-serif;
                                max-width: 600px;
                                margin: auto;
                                padding: 30px;
                                color: #222;
                            "
                        >

                            <h1>
                                MAYNA
                            </h1>

                            <h2>
                                Reset your password
                            </h2>

                            <p>
                                Hello
                                ${business.businessName || "Business Owner"},
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

                            <p
                                style="
                                    margin: 30px 0;
                                "
                            >

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

                            <p
                                style="
                                    color: #777;
                                    font-size: 13px;
                                "
                            >
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


            console.log("");

            console.log(
                "========================================"
            );

            console.log(
                "       PASSWORD RESET EMAIL SENT"
            );

            console.log(
                "========================================"
            );

            console.log(
                "Business:",
                business.businessName
            );

            console.log(
                "Email:",
                email
            );

            console.log(
                "Resend ID:",
                data?.id || "No ID"
            );

            console.log(
                "========================================"
            );

            console.log("");


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
    (req, res) => {

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


            businesses =
                loadBusinesses();


            const tokenHash =
                hashResetToken(
                    token
                );


            const business =
                businesses.find(
                    item =>
                        item.resetTokenHash ===
                            tokenHash
                        &&
                        Number(
                            item.resetTokenExpires
                        ) >
                            Date.now()
                );


            if (!business) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This reset link is invalid or has expired."

                });
            }


            // CREATE NEW PASSWORD HASH

            const passwordData =
                hashPassword(
                    newPassword
                );


            business.ownerPasswordHash =
                passwordData.passwordHash;


            business.ownerPasswordSalt =
                passwordData.passwordSalt;


            // DELETE RESET TOKEN
            // MAKES THE LINK SINGLE-USE

            delete business.resetTokenHash;

            delete business.resetTokenExpires;


            saveBusinesses(
                businesses
            );


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
// GET ONE BUSINESS
// ========================================

router.get(
    "/:id",
    (req, res) => {

        businesses =
            loadBusinesses();


        const id =
            String(
                req.params.id
            );


        const business =
            businesses.find(
                item =>
                    String(item.id) ===
                    id
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

            business:
                publicBusiness(
                    business
                )

        });
    }
);


// ========================================
// REGISTER BUSINESS
// ========================================

router.post(
    "/",
    (req, res) => {

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


            if (!ownerPassword) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Owner password is required."

                });
            }


            if (
                ownerPassword.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must be at least 6 characters."

                });
            }


            businesses =
                loadBusinesses();


            const existingOwner =
                businesses.find(
                    item =>
                        String(
                            item.ownerEmail || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        ownerEmail
                );


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


            const newBusiness = {

                id:
                    Date.now(),

                businessName:
                    req.body.businessName || "",

                image:
                    req.body.image || "",

                country:
                    "Namibia",

                town:
                    req.body.location || "",

                category:
                    req.body.category || "",

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

            };


            businesses.push(
                newBusiness
            );


            saveBusinesses(
                businesses
            );


            req.session.ownerBusinessId =
                newBusiness.id;


            console.log(
                "New business registered:",
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


            return res.status(500).json({

                success: false,

                message:
                    "Server error while registering business."

            });
        }
    }
);


// ========================================
// OWNER LOGIN
// ========================================

router.post(
    "/owner/login",
    (req, res) => {

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


            businesses =
                loadBusinesses();


            const business =
                businesses.find(
                    item =>
                        String(
                            item.ownerEmail || ""
                        )
                        .trim()
                        .toLowerCase() ===
                        email
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
    (req, res) => {

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


        businesses =
            loadBusinesses();


        const business =
            businesses.find(
                item =>
                    String(item.id) ===
                    String(
                        req.session.ownerBusinessId
                    )
            );


        if (!business) {

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

    (req, res) => {

        try {

            const id =
                String(
                    req.params.id
                );


            businesses =
                loadBusinesses();


            const businessIndex =
                businesses.findIndex(
                    item =>
                        String(item.id) ===
                        id
                );


            if (
                businessIndex === -1
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Business not found."

                });
            }


            const verified =
                req.body.verified === true;


            businesses[
                businessIndex
            ].verified =
                verified;


            saveBusinesses(
                businesses
            );


            return res.json({

                success: true,

                message:
                    verified
                        ? "Business verified successfully."
                        : "Business unverified successfully.",

                business:
                    publicBusiness(
                        businesses[
                            businessIndex
                        ]
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
    (req, res) => {

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
                String(
                    req.params.id
                );


            if (
                String(
                    req.session.ownerBusinessId
                ) !== id
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You are not authorized to edit this business."

                });
            }


            businesses =
                loadBusinesses();


            const businessIndex =
                businesses.findIndex(
                    item =>
                        String(item.id) ===
                        id
                );


            if (
                businessIndex === -1
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Business not found."

                });
            }


            const currentBusiness =
                businesses[
                    businessIndex
                ];


            const updatedBusiness = {

                ...currentBusiness,

                businessName:
                    req.body.businessName ??
                    currentBusiness.businessName,

                image:
                    req.body.image ??
                    currentBusiness.image ??
                    "",

                category:
                    req.body.category ??
                    currentBusiness.category,

                town:
                    req.body.location ??
                    currentBusiness.town,

                phone:
                    req.body.phone ??
                    currentBusiness.phone ??
                    "",

                whatsapp:
                    req.body.whatsapp ??
                    currentBusiness.whatsapp ??
                    "",

                email:
                    req.body.email ??
                    currentBusiness.email ??
                    "",

                description:
                    req.body.description ??
                    currentBusiness.description ??
                    "",

                services:
                    req.body.services ??
                    currentBusiness.services ??
                    "",

                hours:
                    req.body.hours ??
                    currentBusiness.hours ??
                    {}

            };


            businesses[
                businessIndex
            ] =
                updatedBusiness;


            saveBusinesses(
                businesses
            );


            return res.json({

                success: true,

                message:
                    "Business updated successfully.",

                business:
                    publicBusiness(
                        updatedBusiness
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


module.exports = router;