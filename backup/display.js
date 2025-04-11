// Currently set up to sort, group, and display data based on cart/dab parameters
// TODO: Modify display handling to change display type based on page_identifier
// TODO: Improve sorting so that product type is extracted (blunt, pack, infused) and added to mini menu header
// ex. Hellavated 5 pack and Blunts are same price, so show up in the same $20 mini menu

// The data from background.js
let sortedData, backupData = {}; 

document.addEventListener("DOMContentLoaded", function () {
    // Setup undo button
    let undoButton = document.getElementById("undo-button");
    undoButton.addEventListener("click", undoLastChange);

    // Grab products from local storage
    chrome.storage.local.get("scrapedProducts", (data) => {
        let scrapedProducts = data.scrapedProducts;
        console.log("Scraped Products:", scrapedProducts);

        // Ensure scrapedProducts is always an array
        if (scrapedProducts && !Array.isArray(scrapedProducts)) {
            console.warn("Scraped products is not an array.");
        }

        if (scrapedProducts && Array.isArray(scrapedProducts)) {
            // Save initial state for Undo
            backupData = JSON.parse(JSON.stringify(scrapedProducts));

            // Create page identifier to determine which type of output to display
            let identifier = data.scrapedProducts[0].page_identifier || "Unknown Page";
            console.log("Current Page Identifier:", identifier);

            // Process and group products
            sortedData = sortAndGroupProducts(scrapedProducts);

            // Create UI elements
            createUI(sortedData);

            // Display products
            const selectedFarms = getSelectedFarms();
            displayProducts(sortedData, selectedFarms);
        } else {
            console.warn("No valid products to show.");
            document.getElementById("product-container").innerHTML = "<p>No products to show.</p>";
        }
    });

    // Farm checkbox selector event listener
    document.getElementById("filter-container").addEventListener("change", () => {
        const selectedFarms = getSelectedFarms();
        displayProducts(sortedData, selectedFarms);
    });

    // Add product form rules
    document.getElementById("add-product-form").addEventListener("submit", function (event) {
        event.preventDefault();

        // Get form values
        let selectedFarmPrice = document.getElementById("farmPrice").value;
        let selectedFarms = getSelectedFarms();
        let [farm, price] = selectedFarmPrice.split("|");
        let strainName = document.getElementById("strainName").value.trim();
        let effect = document.getElementById("effect").value.trim();
        let effectPriority = getEffectPriority(effect); // Assign effect priority for sorting
        let thcPercentage = parseFloat(document.getElementById("thcPercentage").value);
        let cbdPercentage = parseFloat(document.getElementById("cbdPercentage").value);

        if (!farm || !strainName || isNaN(thcPercentage)) {
            alert("Please fill out all fields correctly.");
            return;
        }   

        // Ensure sortedData exists
        if (!sortedData[farm]) sortedData[farm] = {}; // Initialize farm if it doesn't exist
        if (!sortedData[farm][price]) sortedData[farm][price] = []; // Initialize price group if it doesn't exist

        // Create a new product with the same structure as existing ones
        let newProduct = {
            name: strainName.replace(/\b\w/g, (char) => char.toUpperCase()),
            farm: farm,
            effect: effect,
            effect_priority: effectPriority,
            thc_percent: `${thcPercentage}%`,
            cbd_percent: `${cbdPercentage}%`,
            price: parseFloat(price)
        };

        // Add new product to the sortedData structure
        sortedData[farm][price].push(newProduct);
        console.log("New product added:", newProduct);

        // Re-sort the entire dataset
        reSortedData = sortAndGroupProducts(sortedData);

        // Convert sortedData back into a flat array before saving
        let flatArray = Object.values(reSortedData).flatMap(farm =>
            Object.values(farm).flat()
        );

        // Save the updated sortedData back to chrome.storage.local
        chrome.storage.local.set({ "scrapedProducts": flatArray }, function() {
            console.log("Updated scraped products saved to local storage.", flatArray);
        });

        // Refresh displayed products with the latest selection
        selectedFarms = getSelectedFarms();
        displayProducts(reSortedData, selectedFarms);

        // Clear form fields
        document.getElementById("strainName").value = "";
        document.getElementById("effect").value = "";
        document.getElementById("thcPercentage").value = "";
        document.getElementById("cbdPercentage").value = "";
    });
});

function createUI(sortedData) {
    console.log("Creating UI");
    createFarmSelection(sortedData);
    createFarmCheckboxes(sortedData);
    populateFarmPriceDropdown(sortedData);
}

function validateProduct(product) {
    // Check if the product exists
    if (!product) {
        console.warn("Skipping invalid product: Product object is missing.", product);
        return false;
    }

    // Check if the product has a name
    if (!product.name) {
        console.warn("Skipping invalid product: Product name is missing.", product);
        return false;
    }

    // Check if the product has a farm
    if (!product.farm) {
        console.warn("Skipping invalid product: Product farm is missing.", product);
        return false;
    }

    // Check if the price is a valid number
    if (isNaN(product.price)) {
        console.warn("Skipping invalid product: Product price is not a valid number.", product);
        console.log(product.price);
        return false;
    }

    return true;
}

function sortAndGroupProducts(products) {
    products = normalizeProducts(products);
    const grouped = {};

    products.forEach(product => {
        if (!validateProduct(product)) return;

        const processedProduct = processProduct(product);

        // Initialize farm and price group
        grouped[processedProduct.farm] ??= {};
        grouped[processedProduct.farm][processedProduct.priceGroup] ??= [];

        // Store processed product
        grouped[processedProduct.farm][processedProduct.priceGroup].push(processedProduct);
    });

    return sortGroupedProducts(grouped);
}

// Normalizes the input in case it's not already an array
function normalizeProducts(products) {
    if (Array.isArray(products)) return products;
    return Object.values(products).flatMap(farm => Object.values(farm).flat());
}

// Extracts and processes relevant product details
function processProduct(product) {
    const variations = getVariations();
    const combinedPatterns = new RegExp(`(${Object.values(variations).flat().join("|")}).*`, "i");

    return {
        ...product,
        cleanedName: cleanProductName(product.name, combinedPatterns),
        cbd_percent: parseCBD(product.cbd_percent),
        thc_percent: parseTHC(product.thc_percent),
        effect_priority: getEffectPriority(product.effect),
        priceGroup: product.price.toFixed(2) // String format for grouping
    };
}

// Returns an object containing product variations
function getVariations() {
    return {
        quantity: ['2pk', '5pk', '6pk', '8pk', '10pk', '20pk'],
        size: ['2.51g', '2.5g', '1.5g', '0.5g', '.53g', '.5g', '.78g', '.75g', '1g', '2g'],
        cart: ['all in one', 'all in 1', 'dispo'],
        product: ['cart', 'cartridge', 'blend', 'infused', 'preroll', 'prerolls', 'blunt', 'kief', 'shatter',
            'badder', 'batter', 'crumble', 'bubble hash', 'moonrock', 'moon rock', 'cured hash', 'rso', 'elro', 'elro/rso',
            'sugar wax', 'live rosin/cured resin', 'live resin', 'cured resin', 'temple ball', 'wax',
            'live rosin', 'rosin', 'diamonds & sauce', 'diamonds', 'slim', 'HTE']
    };
}

// Sorts products first by effect priority, then alphabetically by name
function sortGroupedProducts(grouped) {
    console.log("Grouped products:", grouped);
    Object.keys(grouped).forEach(farm => {
        Object.keys(grouped[farm]).forEach(priceGroup => {
            grouped[farm][priceGroup] = grouped[farm][priceGroup].sort((a, b) => {
                return a.effect_priority - b.effect_priority || a.name.localeCompare(b.name);
            });
        });
    });
    return grouped;
}

// Helper function to clean product name
function cleanProductName(name) {
    // Step 1: Remove any price information (e.g., [$6] Hellavated - )
    let cleanedName = name.replace(/\[.*?-/, "").trim();

    // Step 2: Convert numbers to strings properly for regex matching
    let variations = getVariations();
    let allPatterns = [...variations.quantity, ...variations.size, ...variations.cart, ...variations.product];

    // Escape special regex characters, especially `.`
    let regex = new RegExp(`(?:^|\\s)(?:${allPatterns.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=\\s|$)`, 'gi');

    // Step 3: Remove all matched variations and clean up extra spaces
    cleanedName = cleanedName.replace(regex, "").replace(/\s+/g, " ").trim();

    return cleanedName;
}

// Process THC value, takes raw data, returns numerical string value
function parseTHC(value) {
    if (!value) return "N/A";
    let percent = value.toString().trim();
    if (percent.includes('-')) percent = percent.split('-')[1].trim();
    if (percent.endsWith('mg')) {
        const mgValue = parseInt(percent.match(/\d+/)[0]);
        return mgValue > 999 ? (mgValue / 20).toFixed(1) + "%" : (mgValue / 10).toFixed(1) + "%";
    }
    return percent;
}

// Function to parse CBD percent (handling cases like "<LOQ")
function parseCBD(cbd) {
    if (cbd === "<LOQ") {
        return 0; // Return 0 if CBD is "<LOQ"
    }

    if (typeof cbd === 'string') {
        // Clean any non-numeric characters except for dot or hyphen
        let cleanedCBD = cbd.replace(/[^\d.-]/g, '');

        // Handle the case where the string is in the form "value-0%"
        if (cleanedCBD.includes('-0')) {
            // Remove the "-0" part
            let cleanedCBDWithoutZero = cleanedCBD.split('-')[0];
            // Return number before the hyphen with percent
            return parseFloat(cleanedCBDWithoutZero) + "%"; 
        }

        // Otherwise, try to parse the cleaned value
        let numericValue = parseFloat(cleanedCBD);

        // Return the numeric value or null if it's invalid
        return isNaN(numericValue) ? null : numericValue + "%";
    }

    return null; // Return null if the value is not a string
}

// Creates farm selection checkboxes
function createFarmCheckboxes(sortedData) {
    const filterContainer = document.getElementById("filter-container");
    filterContainer.innerHTML = ""; // Clear existing checkboxes

    if (!sortedData || Object.keys(sortedData).length === 0) {
        return; // Don't display anything if there's no data
    }

    let heading = document.createElement("h2");
    heading.textContent = "Select Farms to Display";
    filterContainer.appendChild(heading);

    // Only generate checkboxes when explicitly called elsewhere
    Object.keys(sortedData).sort().forEach(farm => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "farm-checkbox";
        checkbox.value = farm;
        checkbox.checked = false; // Initially unchecked

        const label = document.createElement("label");
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(`${farm}`));

        filterContainer.appendChild(label);
        filterContainer.appendChild(document.createElement("br"));
    });

    // Attach event listener to update display when checkboxes are clicked
    filterContainer.addEventListener("change", () => {
        const selectedFarms = getSelectedFarms();
        displayProducts(sortedData, selectedFarms);
    });
}

// Creates farm selection dropdown menu for form
function createFarmSelection(sortedData) {
    const dropdown = document.getElementById("farmPrice");
    dropdown.innerHTML = ""; // Clear existing options

    Object.keys(sortedData).forEach(farm => {
        let option = document.createElement("option");
        option.value = farm;
        option.textContent = farm;
        dropdown.appendChild(option);
    });

    console.log("Dropdown populated successfully.");
}

function getSelectedFarms() {
    return Array.from(document.querySelectorAll(".farm-checkbox:checked")).map(cb => cb.value);
}

// Show sorted and grouped data
function displayProducts(sortedData, selectedFarms) {
    // console.log("Displaying products:", sortedData);
    const container = document.getElementById("product-container");
    container.innerHTML = ""; // Clear previous content

    // Ensure the dropdown reflects updated farm/price options
    populateFarmPriceDropdown(sortedData);

    // Check if there's valid data to display
    if (!sortedData || Object.keys(sortedData).length === 0 || selectedFarms.length === 0) {
        container.innerHTML = "<p>Select a farm to see products.</p>";
        return;
    }

    // Create two columns for layout balancing
    const columns = [document.createElement("div"), document.createElement("div")];
    columns.forEach(col => col.className = "column");

    let lineCount = 0;
    let useCol1 = true;

    selectedFarms.forEach(farm => {
        if (!sortedData[farm]) return; // Skip if the farm isn't found in sortedData

        Object.keys(sortedData[farm]).forEach(price => {
            const products = sortedData[farm][price];

            if (!products || products.length === 0) return; // Skip if no products for this price

            const section = createFarmSection(farm, products, price);
            const estimatedLines = 3 + (products.length * 2); // Estimate height usage

            // Balance content between the two columns
            if (useCol1 && (lineCount + estimatedLines) <= 98) {
                columns[0].appendChild(section);
                lineCount += estimatedLines;
            } else {
                useCol1 = false;
                columns[1].appendChild(section);
            }
        });
    });

    container.append(...columns);
}

// Build the menu section with details, by farm and price group
function createFarmSection(farm, products, price) {
    const section = document.createElement("div");

    const priceHeader = document.createElement("div");
    priceHeader.innerHTML = `<h4>${farm} <span style="float: right;">$${price}</span></h4>`;
    section.appendChild(priceHeader);


    // Display the products in this price group
    products.forEach(product => {
        const productDiv = document.createElement("div");
        productDiv.className = "product";
        // Determine which percent to display based on effect_priority
        const percentToDisplay = product.effect_priority === 4 ? product.cbd_percent : product.thc_percent;
        
        productDiv.innerHTML = `
            <strong style="color: ${getEffectColor(product.effect_priority)};">${product.cleanedName}</strong>
            <strong style="float: right; color: ${getEffectColor(product.effect_priority)}">${percentToDisplay}</strong>
        `;
        section.appendChild(productDiv);
    });

    return section;
}

// Function: Assigns priority ordering based on effects
function getEffectPriority(effect) {
    if (effect.toLowerCase().includes("sativa")) return 1;
    if (effect.toLowerCase() == ("hybrid")) return 2;
    if (effect.toLowerCase().includes("indica")) return 3;
    return 4; // Default priority for unknown effects
}

// Assigns color based on product effect
function getEffectColor(effect_priority) {
    // Define color mapping for each effect using RGB values
    if (effect_priority == 1) return "rgb(250, 0, 0)";  // Red
    if (effect_priority == 2) return "rgb(0, 128, 0)";  // Green
    if (effect_priority == 3) return "rgb(160, 32, 240)";  // Purple
    return "rgb(0, 0, 240)";  // Blue (default color)
}

// Populates the drop down selector menu on the Add Product form, 
// for farm/price grouping consistency when adding products
function populateFarmPriceDropdown(sortedData, selectedFarm = null) {
    // console.log("Populating farm price dropdown with:", sortedData);

    const farmSelect = document.getElementById("farmPrice");
    farmSelect.innerHTML = ""; // Clear old options

    if (!sortedData || Object.keys(sortedData).length === 0) {
        console.warn("No farms available for dropdown.");
        return;
    }

    // Helper function to sort price in ascending order
    const sortPrices = (a, b) => parseFloat(a) - parseFloat(b);

    if (selectedFarm && sortedData[selectedFarm]) {
        // If a specific farm is selected, populate its price points
        Object.keys(sortedData[selectedFarm])
            .sort(sortPrices)  // Sort prices in ascending order
            .forEach(price => {
                const option = document.createElement("option");
                option.value = `${selectedFarm}|${price}`;
                option.textContent = `${selectedFarm} - $${price}`;
                farmSelect.appendChild(option);
            });
        console.log("Price dropdown updated for farm:", selectedFarm);
    } else {
        // If no specific farm is selected, populate for all farms
        Object.keys(sortedData)
            .sort()  // Sort farms alphabetically
            .forEach(farm => {
                Object.keys(sortedData[farm])
                    .sort(sortPrices)  // Sort prices in ascending order
                    .forEach(price => {
                        const option = document.createElement("option");
                        option.value = `${farm}|${price}`;
                        option.textContent = `${farm} - $${price}`;
                        farmSelect.appendChild(option);
                    });
            });
    }
}

function undoLastChange() {
    // Restore sortedData from backup
    restoredData = JSON.parse(JSON.stringify(backupData));
    console.log("Undo action: sortedData restored to initial state.");

    // Re-sort the entire dataset
    sortedData = sortAndGroupProducts(restoredData);

    // Rebuild UI
    createUI(sortedData);

    // Convert sortedData back into a flat array before saving
    let flatArray = Object.values(sortedData).flatMap(farm =>
        Object.values(farm).flat()
    );

    // Save the updated sortedData back to chrome.storage.local
    chrome.storage.local.set({ "scrapedProducts": flatArray }, function() {
        console.log("Restored products saved to local storage.", flatArray);
    });

    // Refresh displayed products with the latest selection
    selectedFarms = getSelectedFarms();
    displayProducts(sortedData, selectedFarms);
}
