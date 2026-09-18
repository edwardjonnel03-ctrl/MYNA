require("dotenv").config();

const cloudinary =
    require("./config/cloudinary");

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

            return callback(
                new Error("Not allowed by CORS")
            );
        },

        credentials: true
    })
);

app.use(
    express.json({
        limit: "30mb"
    })
);


app.use(
    express.urlencoded({
        extended: true
    })
);


// =========================================
// SESSION
// =========================================

app.use(
    session({
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

if (
    typeof image !== "string" ||
    !image.startsWith("data:image/")
) {
    return res.status(400).json({
        success: false,
        message:
            "Invalid image format."
    });
}

const base64Data =
    image.split(",")[1] || "";

const imageSizeBytes =
    Buffer.byteLength(
        base64Data,
        "base64"
    );

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

                req.session.isAdmin = true;

                return req.session.save(
                    (error) => {

                        if (error) {

                            console.error(
                                "Admin session save failed:",
                                error
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