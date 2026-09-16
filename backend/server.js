require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
const { Resend } = require("resend");

const resend = new Resend(
    process.env.RESEND_API_KEY
);

const app = express();

const PORT = 5000;

// =========================================
// MIDDLEWARE
// =========================================

app.use(cors());

app.use(express.json());

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
secret: "MAYNA-DEVELOPMENT-SESSION-SECRET",
resave: false,
saveUninitialized: false,


    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 8
    }
})

);

// =========================================
// FRONTEND
// =========================================

const frontendPath = path.join(
__dirname,
"..",
"frontend"
);

app.use(
express.static(frontendPath)
);

// =========================================
// ADMIN LOGIN
// =========================================

app.post(
"/api/admin/login",
(req, res) => {


    const username =
        req.body.username;

    const password =
        req.body.password;


    const correctUsername =
        "admin";

    const correctPassword =
        "MAYNA123";


    if (
        username === correctUsername &&
        password === correctPassword
    ) {

        req.session.isAdmin = true;


        return res.json({

            success: true,

            message:
                "Admin login successful."

        });

    }


    return res.status(401).json({

        success: false,

        message:
            "Invalid username or password."

    });

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


    return res.status(401).json({

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


                return res.status(500).json({

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


    res.json({

        success: true,

        message:
            "MAYNA API is running"

    });

}


);

// =========================================
// START SERVER
// =========================================

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
