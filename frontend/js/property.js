const params = new URLSearchParams(location.search);
const searchForm = document.getElementById("propertySearch");
const searchInput = document.getElementById("search");
const listingInput = document.getElementById("listing");
const grid = document.getElementById("propertyGrid");
const count = document.getElementById("propertyCount");

searchInput.value = params.get("search") || "";
listingInput.value = params.get("listing") || "";

function money(value) { return `N$${new Intl.NumberFormat("en-NA").format(value)}`; }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value || ""; return div.innerHTML; }
function card(property) {
    const image = property.images && property.images[0];
    const visual = image ? `<img src="${image}" alt="${escapeHtml(property.title)}">` : `<div class="property-placeholder">MAYNA<br>PROPERTY</div>`;
    const rooms = [property.bedrooms !== null ? `${property.bedrooms} bed` : "", property.bathrooms !== null ? `${property.bathrooms} bath` : "", property.size ? `${property.size} m²` : ""].filter(Boolean).join(" · ");
    return `<a class="property-card" href="property-detail.html?id=${encodeURIComponent(property._id)}"><div class="property-image">${visual}<span>${property.listingType}</span></div><div class="property-card-body"><p class="property-price">${money(property.price)}${property.listingType === "For rent" ? " / month" : ""}</p><h3>${escapeHtml(property.title)}</h3><p class="property-location">${escapeHtml(property.area ? `${property.area}, ${property.town}` : property.town)}</p>${rooms ? `<p class="property-meta">${rooms}</p>` : ""}</div></a>`;
}
async function loadProperties() {
    grid.innerHTML = `<p class="property-state">Loading property listings...</p>`;
    const query = new URLSearchParams();
    ["search", "listing"].forEach(key => { if (params.get(key)) query.set(key, params.get(key)); });
    try {
        const response = await fetch(`/api/properties?${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        count.textContent = data.properties.length ? `${data.properties.length} listing${data.properties.length === 1 ? "" : "s"} found` : "No listings found yet";
        grid.innerHTML = data.properties.length ? data.properties.map(card).join("") : `<div class="property-empty"><h3>Property is starting here.</h3><p>There are no approved listings matching this search yet. Be one of the first agents or owners to list.</p><a href="list-property.html" class="nav-button">List a property</a></div>`;
    } catch (error) { grid.innerHTML = `<p class="property-state">We could not load property listings. Please try again.</p>`; count.textContent = ""; }
}
searchForm.addEventListener("submit", event => { event.preventDefault(); const query = new URLSearchParams(); if (searchInput.value.trim()) query.set("search", searchInput.value.trim()); if (listingInput.value) query.set("listing", listingInput.value); location.search = query.toString(); });
loadProperties();
