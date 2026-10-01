const express = require("express");
const mongoose = require("mongoose");

const Business = require("../models/Business");
const Property = require("../models/Property");
const PropertyPlanRequest = require(
    "../models/PropertyPlanRequest"
);

const router = express.Router();

const requestPrices = {
    agent: 199.99,
    pro_agency: 399.99,
    featured_7_days: 50,
    featured_14_days: 100,
    custom_quote: 0
};

function requireOwner(req, res, next) {
    if (!req.session || !req.session.ownerBusinessId) {
        return res.status(401).json({
            success: false,
            message: "Please log in as a business owner."
        });
    }

    next();
}

router.post("/", requireOwner, async (req, res) => {
    try {
        const requestType = String(
            req.body.requestType || ""
        ).trim();

        if (!Object.prototype.hasOwnProperty.call(
            requestPrices,
            requestType
        )) {
            return res.status(400).json({
                success: false,
                message: "Please choose a valid Property plan request."
            });
        }

        const business = await Business.findOne({
            id: req.session.ownerBusinessId
        }).select("id businessName");

        if (!business) {
            return res.status(401).json({
                success: false,
                message: "Your business session is no longer valid."
            });
        }

        let propertyId = null;

        const isFeaturedRequest =
            requestType === "featured_7_days" ||
            requestType === "featured_14_days";

        if (isFeaturedRequest) {
            if (
                !mongoose.Types.ObjectId.isValid(
                    req.body.propertyId
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a valid property to feature."
                });
            }

            const property = await Property.findOne({
                _id: req.body.propertyId,
                ownerBusinessId: business.id
            }).select("_id");

            if (!property) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You can only feature a property that belongs to your business."
                });
            }

            propertyId = property._id;
        }

        const message = String(
            req.body.message || ""
        ).trim();

        const existingRequest =
            await PropertyPlanRequest.findOne({
                businessId: business.id,
                propertyId,
                requestType,
                status: "pending"
            });

        if (existingRequest) {
            return res.status(409).json({
                success: false,
                message:
                    "You already have a pending request for this option."
            });
        }

        const request = await PropertyPlanRequest.create({
            businessId: business.id,
            propertyId,
            requestType,
            amount: requestPrices[requestType],
            message
        });

        return res.status(201).json({
            success: true,
            message:
                "Your request was sent to MAYNA. We will contact you with payment and activation details.",
            request
        });
    } catch (error) {
        console.error(
            "CREATE PROPERTY PLAN REQUEST ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not send your Property plan request."
        });
    }
});

router.get("/owner", requireOwner, async (req, res) => {
    try {
        const requests =
            await PropertyPlanRequest.find({
                businessId: req.session.ownerBusinessId
            })
                .sort({ createdAt: -1 })
                .lean();

        return res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error(
            "GET OWNER PROPERTY PLAN REQUESTS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Could not load your Property plan requests."
        });
    }
});

module.exports = router;