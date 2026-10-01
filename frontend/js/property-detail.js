const target =
    document.getElementById("propertyDetail");

const id =
    new URLSearchParams(
        location.search
    ).get("id");

function escapeHtml(value) {
    const div =
        document.createElement("div");

    div.textContent = value || "";

    return div.innerHTML;
}

function money(value) {
    return `N$${new Intl.NumberFormat(
        "en-NA"
    ).format(value)}`;
}

function fact(label, value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "";
    }

    return `
        <span>
            <strong>${escapeHtml(value)}</strong>
            ${escapeHtml(label)}
        </span>
    `;
}

async function load() {
    if (!id) {
        target.innerHTML = `
            <div class="property-empty">
                <h2>Property not found</h2>
                <a href="property.html">
                    Back to property
                </a>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(
            `/api/properties/${encodeURIComponent(id)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        const property = data.property;

        document.title =
            `${property.title} | MAYNA`;

        const images = Array.isArray(property.images)
            ? property.images
            : [];

        const photos = images.length
            ? images
                .map(function (url, index) {
                    return `
                        <img
                            src="${url}"
                            alt="${escapeHtml(
                                `${property.title} photo ${index + 1}`
                            )}"
                        >
                    `;
                })
                .join("")
            : `
                <div class="property-placeholder detail-placeholder">
                    MAYNA PROPERTY
                </div>
            `;

        const galleryCount = images.length
            ? `
                <span class="detail-gallery-count">
                    ${images.length} photo${images.length === 1 ? "" : "s"}
                </span>
            `
            : "";

        const whatsappNumber =
            (property.whatsapp || property.phone || "")
                .replace(/\D/g, "");

        const features = Array.isArray(property.features)
            ? property.features
            : [];

        const featureSection = features.length
            ? `
                <section class="detail-features">
                    <h2>Property features</h2>

                    <div class="feature-list">
                        ${features
                            .map(function (feature) {
                                return `
                                    <span>
                                        <b>✓</b>
                                        ${escapeHtml(feature)}
                                    </span>
                                `;
                            })
                            .join("")}
                    </div>
                </section>
            `
            : "";

        target.innerHTML = `
            <section class="detail-grid">
                <div>
                    <div class="detail-gallery">
                        ${photos}
                        ${galleryCount}
                    </div>

                    ${featureSection}
                </div>

                <aside class="detail-card">
                    <p class="eyebrow">
                        ${escapeHtml(property.listingType)}
                    </p>

                    <h1>
                        ${escapeHtml(property.title)}
                    </h1>

                    <p class="property-price">
                        ${money(property.price)}
                        ${
                            property.listingType === "For rent"
                                ? " / month"
                                : ""
                        }
                    </p>

                    <p class="property-location">
                        ${escapeHtml(
                            property.area
                                ? `${property.area}, ${property.town}`
                                : property.town
                        )}
                    </p>

                    <div class="detail-facts">
                        ${fact("beds", property.bedrooms)}
                        ${fact("baths", property.bathrooms)}
                        ${fact("garages", property.garages)}
                        ${fact("floor m²", property.size)}
                        ${fact("land m²", property.landSize)}
                        <span>
                            ${escapeHtml(property.propertyType)}
                        </span>
                    </div>

                    <h2>About this property</h2>

                    <p class="detail-description">
                        ${escapeHtml(property.description)
                            .replace(/\n/g, "<br>")}
                    </p>

                    <div class="agent-box">
                        <strong>
                            ${escapeHtml(property.agentName)}
                        </strong>

                        ${
                            property.agencyName
                                ? `
                                    <span>
                                        ${escapeHtml(
                                            property.agencyName
                                        )}
                                    </span>
                                `
                                : ""
                        }

                        <a
                            class="nav-button"
                            href="https://wa.me/${whatsappNumber}"
                            target="_blank"
                            rel="noopener"
                        >
                            WhatsApp agent
                        </a>

                        <a
                            class="outline-button"
                            href="tel:${escapeHtml(property.phone)}"
                        >
                            Call ${escapeHtml(property.phone)}
                        </a>
                    </div>
                </aside>
            </section>
        `;
    } catch (error) {
        target.innerHTML = `
            <div class="property-empty">
                <h2>This property is unavailable.</h2>

                <p>
                    It may no longer be active.
                </p>

                <a href="property.html">
                    Back to property
                </a>
            </div>
        `;
    }
}

load();