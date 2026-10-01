const form = document.getElementById("propertyForm");
const message = document.getElementById("formMessage");
const imageInput = document.getElementById("propertyImages");
const preview = document.getElementById(
    "propertyImagePreview"
);
let selectedPropertyFiles = [];

function showMessage(text, type) {
    message.className =
        type === "error"
            ? "error-message"
            : "success-message";

    message.textContent = text;
}

function showPreviews(files) {
    preview.innerHTML = "";

    Array.from(files).forEach(function (file, index) {
        const item = document.createElement("div");

        item.className = "property-preview-item";

        const image = document.createElement("img");
        image.alt = "Selected property photo";

        const removeButton =
            document.createElement("button");

        removeButton.type = "button";
        removeButton.className =
            "remove-property-image";
        removeButton.dataset.removePropertyImage =
            String(index);
        removeButton.setAttribute(
            "aria-label",
            `Remove photo ${index + 1}`
        );
        removeButton.textContent = "×";

        const reader = new FileReader();

        reader.onload = function () {
            image.src = reader.result;
        };

        reader.readAsDataURL(file);

        item.appendChild(image);
        item.appendChild(removeButton);
        preview.appendChild(item);
    });
}

preview.addEventListener(
    "click",
    function (event) {
        const removeButton = event.target.closest(
            "[data-remove-property-image]"
        );

        if (!removeButton) {
            return;
        }

        const index = Number(
            removeButton.dataset.removePropertyImage
        );

        if (!Number.isInteger(index)) {
            return;
        }

        selectedPropertyFiles.splice(index, 1);
        showPreviews(selectedPropertyFiles);

        showMessage(
            "Photo removed.",
            "success"
        );
    }
);

function compressImage(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();

        reader.onload = function () {
            const sourceImage = new Image();

            sourceImage.onload = function () {
                const maxSize = 1600;

                let width = sourceImage.width;
                let height = sourceImage.height;

                if (
                    width > maxSize ||
                    height > maxSize
                ) {
                    const scale = Math.min(
                        maxSize / width,
                        maxSize / height
                    );

                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                const canvas =
                    document.createElement("canvas");

                canvas.width = width;
                canvas.height = height;

                const context =
                    canvas.getContext("2d");

                context.drawImage(
                    sourceImage,
                    0,
                    0,
                    width,
                    height
                );

                canvas.toBlob(
                    function (blob) {
                        if (!blob) {
                            reject(
                                new Error(
                                    "Could not prepare image."
                                )
                            );

                            return;
                        }

                        const compressedReader =
                            new FileReader();

                        compressedReader.onload =
                            function () {
                                resolve(
                                    compressedReader.result
                                );
                            };

                        compressedReader.onerror =
                            function () {
                                reject(
                                    new Error(
                                        "Could not prepare image."
                                    )
                                );
                            };

                        compressedReader.readAsDataURL(
                            blob
                        );
                    },
                    "image/jpeg",
                    0.8
                );
            };

            sourceImage.onerror = function () {
                reject(
                    new Error("Could not read image.")
                );
            };

            sourceImage.src = reader.result;
        };

        reader.onerror = function () {
            reject(
                new Error("Could not read image.")
            );
        };

        reader.readAsDataURL(file);
    });
}

imageInput.addEventListener(
    "change",
    function () {
        const newlySelectedFiles = Array.from(
            imageInput.files
        );

        const remainingSlots =
            20 - selectedPropertyFiles.length;

        if (remainingSlots <= 0) {
            imageInput.value = "";
            showMessage(
                "You can upload a maximum of 20 photos.",
                "error"
            );
            return;
        }

        if (newlySelectedFiles.length > remainingSlots) {
            showMessage(
                `Only ${remainingSlots} more photo(s) can be added.`,
                "error"
            );

            selectedPropertyFiles =
                selectedPropertyFiles.concat(
                    newlySelectedFiles.slice(0, remainingSlots)
                );
        } else {
            selectedPropertyFiles =
                selectedPropertyFiles.concat(
                    newlySelectedFiles
                );
        }

        imageInput.value = "";
        showPreviews(selectedPropertyFiles);
        message.textContent = "";
    }
);

async function uploadImages(files) {
    const uploadedImages = [];

    for (const file of files) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            throw new Error(
                "Only JPEG, PNG and WebP photos are allowed."
            );
        }

        const image = await compressImage(file);

        const response = await fetch(
            "/api/upload",
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({ image })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Could not upload property photo."
            );
        }

        uploadedImages.push(data.url);
    }

    return uploadedImages;
}

form.addEventListener(
    "submit",
    async function (event) {
        event.preventDefault();

        const button = form.querySelector(
            "button[type=submit]"
        );

const files = selectedPropertyFiles;

        button.disabled = true;
        button.textContent =
            files.length
                ? "Uploading photos..."
                : "Submitting...";

        message.textContent = "";

        try {
            const body = Object.fromEntries(
                new FormData(form).entries()
            );

            if (files.length) {
                body.images =
                    await uploadImages(files);
            }

            button.textContent =
                "Submitting property...";

            const response = await fetch(
                "/api/properties",
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify(body)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);
            }

            form.reset();
            selectedPropertyFiles = [];
            preview.innerHTML = "";

            showMessage(
                data.message,
                "success"
            );
        } catch (error) {
            showMessage(
                error.message ||
                "Could not submit property.",
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent =
                "Submit property for review";
        }
    }
);