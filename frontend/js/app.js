// ========================================
// MAYNA — FRONTEND JAVASCRIPT
// ========================================


// ----------------------------------------
// SEARCH
// ----------------------------------------

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");


function runSearch(value) {

    if (!value) {
        return;
    }

    const search = encodeURIComponent(value);

    window.location.href =
        "businesses.html?search=" + search;
}


// Search button
if (searchButton) {

    searchButton.addEventListener(
        "click",
        function () {

            const value =
                searchInput.value.trim();

            runSearch(value);

        }
    );

}


// Press ENTER to search
if (searchInput) {

    searchInput.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Enter") {

                const value =
                    searchInput.value.trim();

                runSearch(value);

            }

        }
    );

}


// ----------------------------------------
// POPULAR SEARCH BUTTONS
// ----------------------------------------

const searchButtons =
    document.querySelectorAll(
        "[data-search]"
    );


searchButtons.forEach(
    function (button) {

        button.addEventListener(
            "click",
            function () {

                const value =
                    button.dataset.search;

                // If homepage search exists,
                // put the text inside it.

                if (searchInput) {

                    searchInput.value =
                        value;

                    searchInput.focus();

                } else {

                    runSearch(value);

                }

            }
        );

    }
);


// ----------------------------------------
// MOBILE MENU
// ----------------------------------------

const menuButton =
    document.getElementById(
        "menuButton"
    );


if (menuButton) {

    menuButton.addEventListener(
        "click",
        function () {

            alert(
                "MAYNA mobile navigation is coming in the next build."
            );

        }
    );

}