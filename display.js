// The data from background.js
let sortedData = {};

document.addEventListener("DOMContentLoaded", function () {
    // Retrieve the stored data
    chrome.storage.local.get(["fetchedData", "selectedCategory"], (result) => {
        if (result.fetchedData && result.selectedCategory) {
            console.log(`Loaded data for category: ${result.selectedCategory}`);
            
            rawData = processApiData(result.fetchedData);
            sortedData = sortAndGroupProducts(rawData);

            // Modify display logic based on category
            switch (result.selectedCategory) {
                case "carts":
                    console.log("Displaying cartridge data.", sortedData);
                    createFarmCheckboxes(sortedData);
                    displayProducts(sortedData);
                    break;
                case "dabs":
                    console.log("Displaying dabs data.", sortedData);
                    createFarmCheckboxes(sortedData);
                    displayProducts(sortedData);
                    break;
                case "flower":
                    console.log("Displaying flower data.", sortedData);
                    displayFlowers(sortedData);
                    break;
                case "prerolls":
                    console.log("Displaying prerolls data.", sortedData);
                    displayPrerolls(sortedData);
                    break;
                case "prepacks":
                    console.log("Displaying prepacks data.", sortedData);
                    displayPrepacks(sortedData);
                    break;
                default:
                    console.log("Unknown category. Displaying default data...");
                    // Handle default case
            }
        } else {
            console.error("No data found in storage.");
        }

        // Farm checkbox selector event listener
        document.getElementById("filter-container").addEventListener("change", () => {
            const selectedFarms = getSelectedFarms();
            displayProducts(sortedData, selectedFarms);
        });
    });
});

function createUI(sortedData) {
    createFarmSelection(sortedData);
    createFarmCheckboxes(sortedData);
}

// Function to process API data
function processApiData(apiData) {
    if (!apiData || !apiData.menu_feed || !apiData.menu_feed.menu_groups) {
        console.error("Invalid API response format");
        return [];
    }

    const processedItems = [];

    apiData.menu_feed.menu_groups.forEach(group => {
        group.menu_items.forEach(item => {
            const name = item.name;
            const strain = item.strain;
            const farm = item.brand || "Unknown";
            const effect = item.flower_type ? item.flower_type.toUpperCase() : "Unknown";
            const thcPercent = item.thc.current;
            const cbdPercent = item.cbd.current;
            const price = item.prices?.[0]?.price_cents ? item.prices[0].price_cents / 100 : "N/A"; // Convert cents to dollars
            const size = parseFloat(item.prices?.[0]?.unit);
            const tag_list = item.tag_list;

            // Assign an effect priority (for sorting if needed)
            const effectPriority = getEffectPriority(effect);

            processedItems.push({
                name,
                strain,
                farm,
                effect,
                effect_priority: effectPriority,
                thc_percent: thcPercent,
                cbd_percent: cbdPercent,
                price,
                size,
                tag_list
            });
        });
    });

    console.log("Processed API Data:", processedItems);
    return processedItems;
}

// Function: Assigns priority ordering based on effects
function getEffectPriority(effect) {
    if (effect.toLowerCase().includes("sativa")) return 1;
    if (effect.toLowerCase() == ("hybrid")) return 2;
    if (effect.toLowerCase().includes("indica")) return 3;
    if (effect.toLowerCase().includes("cbd")) return 4;
    return 2; // Default priority for unknown effects
}

// Assigns color based on product effect
function getEffectColor(effect_priority) {
    // Define color mapping for each effect using RGB values
    if (effect_priority == 1) return "rgb(190, 0, 0)";  // Red
    if (effect_priority == 2) return "rgb(0, 128, 0)";  // Green
    if (effect_priority == 3) return "rgb(160, 32, 240)";  // Purple
    return "rgb(0, 0, 240)";  // Blue (default color)
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

// Sorts products into farm, price groups
// Formats each product as an object and normalizes the daya
function sortAndGroupProducts(products) {
    products = normalizeProducts(products);
    const grouped = {};

    products.forEach(product => {
        if (!validateProduct(product)) return;

        const processedProduct = processProduct(product);

        // Initialize farm and price group
        grouped[processedProduct.farm] ??= {};
        grouped[processedProduct.farm][processedProduct.price_group] ??= [];

        // Store processed product
        grouped[processedProduct.farm][processedProduct.price_group].push(processedProduct);
    });

    return sortGroupedProducts(grouped);
}

// Normalizes the input in case it's not already an array
function normalizeProducts(products) {
    if (Array.isArray(products)) return products;
    return Object.values(products).flatMap(farm => Object.values(farm).flat());
}

// Master function to process products and detect variations
function processProduct(product) {
    return {
        ...product,
        // cleaned_name is a backup option for name data, sometimes necessary for flavored items
        cleaned_name: cleanProductName(product.name, getCombinedPattern()), 
        pack_size: matchPackSize(product.name),
        matched_size: matchSize(product.name),
        product_type: matchProductType(product.name),
        cbd_percent: parseCBD(product.cbd_percent, product.size),
        thc_percent: parseTHC(product.thc_percent, product.size),
        effect_priority: getEffectPriority(product.effect),
        price_group: product.price.toFixed(2) 
    };
}

// Match any integer before "pk" (e.g., "2pk", "12pk")
function matchPackSize(name) {
    const regex = /\b(\d+)pk\b/i;
    const match = name.match(regex);
    return match ? match[0] : null;
}

// Match any float or integer before "g" (e.g., "2.5g", "1g", ".5g")
function matchSize(name) {
    const regex = /(?<!\d)(\d*\.?\d+)g\b/i;
    const match = name.match(regex);
    
    if (match) {
        let size = match[1];  
        if (size.startsWith(".")) {
            size = "0" + size; // Add a leading zero for cases like .5g
        }
        return size + "g";
    }
    return null;
}

// Match product type variations (e.g., "preroll", "cart")
function matchProductType(name) {
    name = name.toLowerCase();
    // Extract/concentrate type
    const primary_patterns = [
        'cured resin', 'badder', 'batter', 'crumble', 'bubble hash', 'moonrock', 'moon rock', 
        'cured hash', 'sugar wax', 'rosin/cured resin', 'live resin', 'temple ball', 'wax',
        'rosin', 'diamonds & sauce', 'diamonds', 'HTE', 'liquid diamond', 
        'distillate', 'flavored', 'cloud bar', 'moon rocks', 'cold cured live hash', 
        'lit stick', 'lcr', 'llr', 'brush applicator'
    ];
    // Generic product type
    const secondary_patterns = [ 
        'cart', 'cartridge','disposable', 'preroll', 'prerolls', 'blunt', 'blend', 'infused',  'kief', 
        'shatter','slim', 'feco/rso','rso', 'elro', 'elro/rso','live terpene'
    ]
    // First attempt: Try to match with primary patterns
    let regex = new RegExp(`(${primary_patterns.join("|")})`, "i");
    let match = name.match(regex);
    if (match) return match[0]; // Return if found in primary patterns

    // Second attempt: Try to match with fallback patterns
    regex = new RegExp(`(${secondary_patterns.join("|")})`, "i");
    match = name.match(regex);
    return match ? match[0] : null; // Return match if found in fallback patterns, otherwise return null
}

// Combine all patterns for cleaning the name
function getCombinedPattern() {
    const variations = getVariations();
    return new RegExp(`(${Object.values(variations).flat().join("|")})`, "i");
}

// Returns an object containing product variations
// TODO: REfactor this to use for more accurate headers
function getVariations() {
    return {
        quantity: ['2pk', '5pk', '6pk', '8pk', '10pk', '20pk'],
        size: ['2.51g', '2.5g', '1.5g', '0.5g', '.53g', '.5g', '.78g', '.75g', '1g', '2g'],
        cart: ['all in one', 'all in 1', 'dispo', 'disposable'],
        product: [
            'cart', 'cartridge', 'blend', 'infused', 'preroll', 'prerolls', 'blunt', 'kief', 'shatter',
            'badder', 'batter', 'crumble', 'bubble hash', 'moonrock', 'moon rock', 'cured hash', 'rso', 'elro', 'elro/rso',
            'sugar wax', 'live rosin/cured resin', 'live resin', 'cured resin', 'temple ball', 'wax',
            'live rosin', 'rosin', 'diamonds & sauce', 'diamonds', 'slim', 'HTE', 'liquid diamond', 
            'distillate', 'flavored', 'live terpene', 'rosin/cured resin', 'cloud bar', 'feco/rso',
            'moon rocks', 'cold cured live hash', 'lr/distillate'
        ]
    };
}

// Helper function to clean product name
// If no product.strain, use and filter product.name
// applies to flavored items
function cleanProductName(name) {
    // Step 1: Remove any price information (e.g., [$6] Hellavated - )
    let cleaned_name = name.replace(/\[.*?-/, "").trim();

    // Step 2: Convert numbers to strings properly for regex matching
    let variations = getVariations();
    let allPatterns = [...variations.quantity, ...variations.size, ...variations.cart, ...variations.product];

    // Escape special regex characters, especially `.`
    let regex = new RegExp(`(?:^|\\s)(?:${allPatterns.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=\\s|$)`, 'gi');

    // Step 3: Remove all matched variations and clean up extra spaces
    cleaned_name = cleaned_name.replace(regex, "").replace(/\s+/g, " ").trim();

    return cleaned_name;
}

// Sorts products into farm/price groups, then by effect priority, then alphabetically by name
function sortGroupedProducts(grouped) {
    console.log("Grouped products:", grouped);
    Object.keys(grouped).forEach(farm => {
        Object.keys(grouped[farm]).forEach(price_group => {
            grouped[farm][price_group] = grouped[farm][price_group].sort((a, b) => {
                return a.effect_priority - b.effect_priority || a.name.localeCompare(b.name);
            });
        });
    });
    return grouped;
}

// Process THC value, takes float, returns formatted string
// TODO: take product.quantity to divide by to get correct percentages for .5, .78, 1.5, etc
function parseTHC(thc, size) {  
    const thc_float = parseFloat(thc);
    const size_float = parseFloat(size) * 10;

    if (!thc) return "N/A";

    if (thc < 99) return parseFloat(thc).toFixed(1) + "%";
    
    return (thc_float / size_float).toFixed(1) + "%";
}

// Function to parse CBD percent (handling cases like "<LOQ")
// Should return two decimal points, as prepacks will usually only have 0.0x%
function parseCBD(cbd, size) {
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
            return parseFloat(cleanedCBDWithoutZero).toFixed(2) + "%"; 
        }

        // Otherwise, try to parse the cleaned value
        let numericValue = parseFloat(cleanedCBD).toFixed(2);

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
        console.log("No data to display @ createFarmCheckboxes");
        return; // Don't display anything if there's no data
    }

    let heading = document.createElement("h2");
    heading.textContent = "Select Farms to Display";
    filterContainer.appendChild(heading);

    // Create "Select All" checkbox
    const selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.id = "select-all-farms";
    
    const selectAllLabel = document.createElement("label");
    selectAllLabel.appendChild(selectAllCheckbox);
    selectAllLabel.appendChild(document.createTextNode(" Select/Deselect All"));

    filterContainer.appendChild(selectAllLabel);
    filterContainer.appendChild(document.createElement("br"));

    // Store references to all farm checkboxes
    const checkboxes = [];

    // Generate farm checkboxes
    Object.keys(sortedData).sort().forEach(farm => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "farm-checkbox";
        checkbox.value = farm;
        checkbox.checked = false; // Initially unchecked

        checkboxes.push(checkbox);

        const label = document.createElement("label");
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(`${farm}`));

        filterContainer.appendChild(label);
        filterContainer.appendChild(document.createElement("br"));
    });

    // Event listener for "Select All" checkbox
    selectAllCheckbox.addEventListener("change", function () {
        checkboxes.forEach(cb => cb.checked = this.checked);
        updateDisplay();
    });

    // Event listener for individual farm checkboxes
    filterContainer.addEventListener("change", (event) => {
        if (event.target.classList.contains("farm-checkbox")) {
            // If any checkbox is unchecked, uncheck "Select All"
            if (!event.target.checked) {
                selectAllCheckbox.checked = false;
            }
            // If all checkboxes are checked, check "Select All"
            else if (checkboxes.every(cb => cb.checked)) {
                selectAllCheckbox.checked = true;
            }
            updateDisplay();
        }
    });

    function updateDisplay() {
        const selectedFarms = getSelectedFarms();
        displayProducts(sortedData, selectedFarms);
    }
}

function getSelectedFarms() {
    return Array.from(document.querySelectorAll(".farm-checkbox:checked")).map(cb => cb.value);
}

function displayProducts(sortedData, selectedFarms) {
    const container = document.getElementById("product-container");
    container.innerHTML = ""; // Clear previous content

    if (!Array.isArray(selectedFarms) || selectedFarms.length === 0 || !sortedData) {
        container.innerHTML = "<p>Select a farm to see products.</p>";
        return;
    }

    let currentPage, leftColumn, rightColumn;
    let leftLineCount = 0;
    let rightLineCount = 0;
    const maxLinesPerColumn = 98;

    function createNewPage() {
        currentPage = document.createElement("div");
        currentPage.className = "page";

        leftColumn = document.createElement("div");
        rightColumn = document.createElement("div");
        leftColumn.className = "column";
        rightColumn.className = "column";

        currentPage.append(leftColumn, rightColumn);
        container.appendChild(currentPage);

        leftLineCount = 0;
        rightLineCount = 0;
    }

    createNewPage(); // Start with the first page

    // Flatten sortedData into an array of objects { farm, price, products }
    let productGroups = [];
    selectedFarms.forEach(farm => {
        if (!sortedData[farm]) return;

        Object.keys(sortedData[farm]).forEach(price => {
            const priceValue = parseFloat(price); // Convert price to a number
            productGroups.push({
                farm,
                price: priceValue, // Store as a number for sorting
                products: sortedData[farm][price] || []
            });
        });
    });

    // Sort first by price (low to high), then alphabetically by farm name
    productGroups.sort((a, b) => a.price - b.price || a.farm.localeCompare(b.farm));

    // Iterate through sorted product groups
    productGroups.forEach(({ farm, price, products }) => {
        if (!products || products.length === 0) return;

        // Group products by product_type within the same price group
        const productsByType = {};
        products.forEach(product => {
            const type = product.product_type || "Other"; // Default to "Other" if missing
            if (!productsByType[type]) {
                productsByType[type] = [];
            }
            productsByType[type].push(product);
        });

        // Iterate through each product_type group and create separate sections
        Object.keys(productsByType).forEach(type => {
            const size = productsByType[type][0].size;
            const pack_size = productsByType[type][0].pack_size;
            const matched_size = productsByType[type][0].matched_size;
            const section = createFarmSection(farm, productsByType[type], price.toFixed(2), type, size, pack_size, matched_size);
            const estimatedLines = 3 + (productsByType[type].length * 2); // Estimate height usage

            if (leftLineCount + estimatedLines <= maxLinesPerColumn) {
                leftColumn.appendChild(section);
                leftLineCount += estimatedLines;
            } else if (rightLineCount + estimatedLines <= maxLinesPerColumn) {
                rightColumn.appendChild(section);
                rightLineCount += estimatedLines;
            } else {
                createNewPage();
                leftColumn.appendChild(section);
                leftLineCount = estimatedLines;
            }
        });
    });
    if (leftLineCount < 100) {
        let container = document.getElementById("product-container");
        container.style.lineHeight = 1.0;
    } else {
        let container = document.getElementById("product-container");
        container.style.lineHeight = 1.2;
    }
    
    // Resize body to fit new content, delay to ensure rendering
    setTimeout(updateBodyHeight, 50); 
}

function displayPrepacks(sortedData) {
    const container = document.getElementById("product-container");
    container.innerHTML = ""; // Clear previous content
    container.classList.toggle("prepack-container");

    if (!sortedData || Object.keys(sortedData).length === 0) {
        container.innerHTML = "<p>No prepacks available.</p>";
        return;
    }

    // Convert sortedData into an array and filter only products with "PrePack" in the name
    let productsArray = [];
    Object.keys(sortedData).forEach(farm => {
        Object.keys(sortedData[farm]).forEach(price => {
            sortedData[farm][price].forEach(product => {
                if (product.name && product.name.includes("PrePack")) {  // <-- Filter condition
                    productsArray.push({ ...product, farm, price: parseFloat(price) });
                }
            });
        });
    });


    productsArray.sort((a, b) => {
        let priceA = parseFloat(a.price) || 0;
        let priceB = parseFloat(b.price) || 0;

        if (priceA !== priceB) {
            return priceA - priceB; // Sort by price first
        }

        let sizeA = parseFloat(a.size) || 0;
        let sizeB = parseFloat(b.size) || 0;
        
        return sizeB - sizeA; // If prices are the same, sort by size
    });

    // Create a container for the list
    const listContainer = document.createElement("div");
    listContainer.className = "product-list";

    // Add a banner
    const banner = document.createElement("div");
    banner.className = "banner";
    banner.innerHTML = `
        <h1>1/2 Ounce PrePack Specials</h1>
        <p class="disclaimer red-text">No Discounts Apply</p>
    `
    listContainer.appendChild(banner);

    // Add a header row
    const headerRow = document.createElement("div");
    headerRow.className = "product-row header";
    headerRow.innerHTML = `
        <div class="product-cell price">Price</div>
        <div class="product-cell strain">Strain</div>
        <div class="product-cell thc">THC%</div>
        <div class="product-cell cbd">CBD%</div>
    `;
    listContainer.appendChild(headerRow);

    // Track last displayed price 
    let lastDisplayedPrice = null;
    let itemCount = 0;

    // Populate rows with products
    productsArray.forEach(product => {
        const row = document.createElement("div");
        const sizeLabel = product.size == 28 ? "OZ" : "";
        let priceString = `$${product.price % 1 === 0.5 ? product.price.toFixed(2) : product.price.toFixed(0)} ${sizeLabel}`.trim();
        let priceClass = "";
        const effectColor = getEffectColor(product.effect_priority);
        const strainName = product.strain || product.cleaned_name;
        let effect = product.effect.toLowerCase();
        const thcPercent = product.thc_percent || "N/A";
        const cbdPercent = product.cbd_percent || "N/A";

        if (effect.includes("sativa")) {
            effect = "sativa";
        } else if (effect.includes("indica")) {
            effect = "indica";
        } else {
            effect = "hybrid";
        }

        row.className = "product-row";
        
        if (lastDisplayedPrice === priceString && priceString !== "$12.50 OZ") {
            priceClass = "darkgrey"; // Add class if it's a repeated price (except for "$12.50 OZ")
        } else {
            lastDisplayedPrice = priceString; // Update lastDisplayedPrice only if it's a new price
        }

        row.innerHTML = `
            <div class="product-cell price ${priceClass}">${priceString}</div>
            <div class="product-cell strain line-item">
                <span class="bullet" style="color: ${effectColor};">• </span>
                ${strainName} 
                <span class="bullet" style="color: ${effectColor};">• ${effect} </span>
            </div>
            <div class="product-cell thc">${thcPercent}</div>
            <div class="product-cell cbd darkgrey">${cbdPercent === "0.00%" ? "0%" : cbdPercent}</div>
        `;
        itemCount++;

        if (itemCount < 26) { 
                let container = document.getElementById("product-container");
                container.style.lineHeight = 1.6;
            } else {
                container.style.lineHeight = 1.2;
            }

        listContainer.appendChild(row);
    });

    container.appendChild(listContainer);

    // Resize body to fit new content, delay to ensure rendering
    setTimeout(updateBodyHeight, 50); 
}


// Display Gold, Platinum, Diamond menus
function displayFlowers(sortedData) {
    const container = document.getElementById("product-container");
    container.innerHTML = "";

    if (!sortedData || Object.keys(sortedData).length === 0) {
        container.innerHTML = "<p>No flower data available.</p>";
        return;
    }

    // Categorize products into price tiers
    const priceTiers = {
        gold: [],
        platinum: [],
        diamond: []
    };

    Object.keys(sortedData).forEach(farm => {
        Object.keys(sortedData[farm]).forEach(price => {
            sortedData[farm][price].forEach(product => {
                const productEntry = { ...product, farm, price: parseFloat(price) };

                if (productEntry.price === 6) {
                    priceTiers.gold.push(productEntry);
                } else if (productEntry.price === 14) {
                    priceTiers.platinum.push(productEntry);
                } else if (productEntry.price === 15) {
                    priceTiers.diamond.push(productEntry);
                }
            });
        });
    });

    // Sort products by effect priority, then alphabetized
    function sortProducts(products) {
        return products.sort((a, b) => {
            // Ensure numbers are properly compared
            const effectPriorityA = a.effect_priority || 0; // Default to 0 if undefined/null
            const effectPriorityB = b.effect_priority || 0;

            if (effectPriorityA !== effectPriorityB) {
                return effectPriorityA - effectPriorityB; // Numeric sorting
            }

            // Sort alphabetically by strain name if effect_priority is the same
            return (a.strain || a.cleaned_name).localeCompare(b.strain || b.cleaned_name);
        });
    }

    // Sort each tier
    priceTiers.gold = sortProducts(priceTiers.gold);
    priceTiers.platinum = sortProducts(priceTiers.platinum);
    priceTiers.diamond = sortProducts(priceTiers.diamond);

    // Function to generate product lists and split into pages
    function createPagedProductLists(products, tierTitle) {
        const pageHeight = 92; // Define max rows per page
        let pages = [];
        let currentPage = [];

        // Add header for each tier
        let headerRow = `
            <div class="product-row header">
                <div class="product-cell strain bold-font left-align">Strain</div>
                <div class="product-cell farm bold-font">Farm</div>
                <div class="product-cell thc bold-font">THC%</div>
                <div class="product-cell cbd bold-font">CBD%</div>
            </div>
        `;

        let lineCount = 2; // Start with 2 for header + title
        let lastDisplayedPrice = null;

        products.forEach(product => {
            const sizeLabel = product.size == 28 ? "OZ" : "";
            let priceString = `$${product.price % 1 === 0.5 ? product.price.toFixed(2) : product.price.toFixed(0)} ${sizeLabel}`.trim();
            let priceClass = "";

            const effectColor = getEffectColor(product.effect_priority);
            const strainName = product.strain || product.cleaned_name;
            let effect = product.effect.toLowerCase();
            const thcPercent = product.thc_percent || "N/A";
            const cbdPercent = product.cbd_percent || "N/A";
            let farm = product.farm || "N/A";
            let tags = product.tag_list || [];
            let sale = "";

            if (effect.includes("sativa")) {
                effect = "sativa";
            } else if (effect.includes("indica")) {
                effect = "indica";
            } else if (effect.includes("cbd")) {
                effect = "cbd";
            } else {
                effect = "hybrid";
            }

            if (tags.includes("Manager Special Flower : Foster")) {
                sale = "50% off";
                saleBackground = "#FF00BF";
                saleColor = "white";
            } else if (tags.includes("Last Chance Flower : Foster")) {
                sale = "30% off";
                saleBackground = "#FFD700";
                saleColor = "black";
            } else {
                sale = "";
                saleBackground = "white";
                saleColor = "black";
            }

            if (lastDisplayedPrice === priceString && priceString !== "$12.50 OZ") {
                priceClass = "darkgrey";
            } else {
                lastDisplayedPrice = priceString;
            }

            let rowHTML = `
                <div class="product-row">
                    <div class="product-cell strain line-item left-align">
                        <span class="bullet" style="color: ${effectColor};">•</span>
                        ${strainName} 
                        <span class="bullet" style="color: ${effectColor};">• ${effect} </span>
                        <span class="sale-bubble" style="background-color: ${saleBackground}; color: ${saleColor}; ">${sale} </span>
                    </div>
                    <div class="product-cell farm">${farm}</div>
                    <div class="product-cell thc">${thcPercent}</div>
                    <div class="product-cell cbd darkgrey">${cbdPercent === "0.00%" ? "0%" : cbdPercent}</div>
                </div>
            `;

            currentPage.push(rowHTML);
            lineCount++;

            if (lineCount < 40) { 
                let container = document.getElementById("product-container");
                container.style.lineHeight = 1.6;
            } else {
                container.style.lineHeight = 1.2;
            }

            // Insert a page break if we reach the max lines per page
            if (lineCount > pageHeight) {
                currentPage.push(`<div class="page-break"></div>`); // Add a page break
                pages.push(currentPage.join("")); // Store the full page
                currentPage = []; // Start a new page
                lineCount = 2; // Reset line count
            }
        });

        // Push the last page if it has content
        if (currentPage.length > 0) {
            pages.push(currentPage.join(""));
        }

        const priceGroups = {
            "Gold": ["$6 - Gram", "$18 - Eighth", "$34 - Quarter"],
            "Platinum": ["$14 - Gram", "$40 - Eighth", "$72 - Quarter"],
            "Diamond": ["$15 - Gram", "$45 - Eighth", "$80 - Quarter"]
        };
        const medPriceGroups = {
            "Gold": ["$5 - Gram", "$14.40 - Eighth", "$28.33 - Quarter"],
            "Platinum": ["$11.87 - Gram", "$33.33 - Eighth", "$60 - Quarter"],
            "Diamond": ["$12.50 - Gram", "$37.50 - Eighth", "$66.67 - Quarter"]
        };

        // Function to generate the menu price group dynamically
        function getMenuPriceGroup(tierTitle) {
            const prices = priceGroups[tierTitle] || [];
            return prices.length
                ? `<div class="menu-price-group">
                       ${prices.map(price => `<p>${price}</p>`).join("")}
                   </div>`
                : "";
        }
        function getMedMenuPriceGroup(tierTitle) {
            const prices = medPriceGroups[tierTitle] || [];
            return prices.length
                ? `<div class="menu-price-group red-text">
                       ${prices.map(price => `<p>${price}</p>`).join("")}
                   </div>`
                : "";
        }

        // Return the formatted pages with banners
        return pages.map((pageContent, index) => `
            <div class="product-list page-break">
                <div class="header-group">
                    <div class="banner">
                        <h1>${tierTitle} Shelf</h1>
                        <p class="disclaimer"></p>
                    </div>
                    ${getMenuPriceGroup(tierTitle)}
                    ${getMedMenuPriceGroup(tierTitle)}
                </div>

                ${headerRow}
                ${pageContent}
            </div>
        `).join("");
    }

    // Generate the final paginated output
    const finalHTML = `
        ${createPagedProductLists(priceTiers.gold, "Gold")}
        ${createPagedProductLists(priceTiers.platinum, "Platinum")}
        ${createPagedProductLists(priceTiers.diamond, "Diamond")}
    `;

    // Insert the final HTML into the container
    container.innerHTML = finalHTML;

    // Resize body to fit new content
    setTimeout(updateBodyHeight, 50);
}

function displayPrerolls(sortedData) {
    console.log("displayPrerolls function begins");
    const categoryTitles = {
        infused: "Infused Prerolls",
        singlePrerolls: "Single Prerolls",
        prerollPacks: "Preroll Packs"
    };

    const container = document.getElementById("product-container");
    container.innerHTML = ""; // Clear previous content

    if (!sortedData || Object.keys(sortedData).length === 0) {
        console.warn("Early return triggered: sortedData is empty or undefined.");
        container.innerHTML = "<p>No products available.</p>";
        return;
    }

    let currentPage, leftColumn, rightColumn;
    let leftLineCount = 0;
    let rightLineCount = 0;
    const maxLinesPerColumn = 98;

    function createNewPage(title = "") {
        currentPage = document.createElement("div");
        currentPage.className = "page";

        leftColumn = document.createElement("div");
        rightColumn = document.createElement("div");
        leftColumn.className = "column";
        rightColumn.className = "column";

        currentPage.append(leftColumn, rightColumn);
        container.appendChild(currentPage);

        leftLineCount = 0;
        rightLineCount = 0;

        // If a title is provided, add it as the first element in the left column
        if (title) {
            const heading = document.createElement("h1");
            heading.textContent = title;
            heading.className = "page-title"; // Add a class for styling
            leftColumn.appendChild(heading); // Now it's the first item in the left column
            leftLineCount += 3; // Estimate that the heading takes 3 lines
        }
    }


    // Define product categories, grouped by farm and price
    let groupedProducts = {
        singlePrerolls: {},
        prerollPacks: {},
        infused: {}
    };

    let infused_variations = ["moonrock", "moon rock", "slim", "hellavated", "portland heights"];

    Object.keys(sortedData).forEach(farm => {
        Object.keys(sortedData[farm]).forEach(price => {
            const products = sortedData[farm][price];

            // Ensure products is an array
            const productArray = Array.isArray(products) ? products : Object.values(products);

            productArray.forEach(product => {
                const productEntry = { ...product, farm, price: parseFloat(price) };

                if (productEntry.farm.toLowerCase().includes("east fork")) {
                    productEntry.effect = "CBD";
                    productEntry.effect_priority = 4;
                }

                // Categorize preroll options into 3 objects for displaying - infused, single prerolls, preroll packs
                let category;
                if (infused_variations.some(variation => productEntry.name.toLowerCase().includes(variation))) {
                    category = "infused";
                } else if (productEntry.product_type && infused_variations.some(variation => productEntry.product_type.toLowerCase().includes(variation))) {
                    category = "infused";
                } else if (productEntry.product_type && productEntry.product_type.toLowerCase() === "infused") {
                    category = "infused"; 
                } else if (productEntry.pack_size) {
                    if (productEntry.farm.toLowerCase().includes("kleen karma") || productEntry.name.toLowerCase().includes("lit stick")) {
                        category = "singlePrerolls";
                    } else {
                        category = "prerollPacks";
                        productEntry.product_type = "preroll";
                    }
                } else if (productEntry.product_type && productEntry.product_type.toLowerCase() === "preroll") {
                    category = productEntry.pack_size === null ? "singlePrerolls" : "prerollPacks";
                } else {
                    category = "singlePrerolls";
                }

                if (!groupedProducts[category][farm]) {
                    groupedProducts[category][farm] = {};
                }
                if (!groupedProducts[category][farm][price]) {
                    groupedProducts[category][farm][price] = [];
                }

                groupedProducts[category][farm][price].push(productEntry);
            });
        });
    });

    // Call function to sort each category
    sortGroupedProductsByPrice(groupedProducts);

    console.log("Sorted groupedProducts:", groupedProducts);
    
    Object.keys(groupedProducts).forEach(category => {
        if (!groupedProducts[category]) return;

        // Get the correct title for the category
        const categoryTitle = categoryTitles[category] || "Unknown Category";

        createNewPage(categoryTitle); // Start a new page with the correct heading

        Object.keys(groupedProducts[category]).forEach(farm => {
            Object.keys(groupedProducts[category][farm]).forEach(price => {
                const priceValue = parseFloat(price); // Convert price to a number

                const products = groupedProducts[category][farm][price] || [];

                if (!products.length) return;

                // Group products by product_type
                const productsByType = {};
                products.forEach(product => {
                    const type = product.product_type || "Other"; // Default to "Other" if missing
                    if (!productsByType[type]) {
                        productsByType[type] = [];
                    }
                    productsByType[type].push(product);
                });

                // Iterate through each product_type group and create sections
                Object.keys(productsByType).forEach(type => {
                    const size = productsByType[type][0].size;
                    const pack_size = productsByType[type][0].pack_size;
                    const matched_size = productsByType[type][0].matched_size;

                    const section = createFarmSection(farm, productsByType[type], priceValue.toFixed(2), type, size, pack_size, matched_size);
                    const estimatedLines = 3 + (productsByType[type].length * 2); // Estimate height usage

                    if (leftLineCount + estimatedLines <= maxLinesPerColumn) {
                        leftColumn.appendChild(section);
                        leftLineCount += estimatedLines;
                    } else if (rightLineCount + estimatedLines <= maxLinesPerColumn) {
                        rightColumn.appendChild(section);
                        rightLineCount += estimatedLines;
                    } else {
                        createNewPage(categoryTitle); // Ensure new pages have the correct title
                        leftColumn.appendChild(section);
                        leftLineCount = estimatedLines;
                    }
                });
            });
        });
    });

    if (leftLineCount < 100) {
        container.style.lineHeight = 1.0;
    } else {
        container.style.lineHeight = 1.2;
    }

    // Resize body to fit new content, delay to ensure rendering
    setTimeout(updateBodyHeight, 50);
}

// Build the menu section with details, by farm and price group
function createFarmSection(farm, products, price, type, size, pack_size, matched_size) {
    const section = document.createElement("div");

    type = titleCase(type);

    const priceHeader = document.createElement("div");
    priceHeader.innerHTML = `<h4>
    ${farm} 
        <i style="font-weight: 400; font-family: 'Poppins', sans-serif; font-size: .8rem;">
            ${pack_size ? `${pack_size} ${matched_size || ""}` : `${size}g`} ${type}
        </i>
        <span style="float: right;">$${price}</span>
    </h4>`;
    section.appendChild(priceHeader);

    // Display the products in this price group
    products.forEach(product => {
        const product_div = document.createElement("div");
        product_div.className = "product";

        // Determine which percent to display based on effect_priority
        let percent_to_display;
        if (product.effect_priority === 4) {
            percent_to_display = `<span style="color: rgb(0, 128, 0);">${product.thc_percent}</span> / ${product.cbd_percent}`;
        } else {
            percent_to_display = product.thc_percent;
        }

        product_div.innerHTML = `
            <strong style="color: ${getEffectColor(product.effect_priority)};">${product.strain || product.cleaned_name}</strong>
            <strong style="float: right; color: ${getEffectColor(product.effect_priority)};">
                ${percent_to_display}
            </strong>
        `;
        section.appendChild(product_div);
    });

    return section;
}  

function updateBodyHeight() {
    document.body.style.height = "auto"; // Reset height to recalculate
    document.body.style.height = document.body.scrollHeight + "px"; // Set new height
}

function titleCase(str) {
    if ((str === null) || (str === ''))
        return false;
    else
        str = str.toString();

    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() +
            txt.substr(1).toLowerCase();
    });
}

// Function to sort each category by farm price (low to high)
function sortGroupedProductsByPrice(groupedProducts) {
    Object.keys(groupedProducts).forEach(category => {
        let sortedArray = [];

        // Flatten farm-price structure into an array of objects
        Object.keys(groupedProducts[category]).forEach(farm => {
            Object.keys(groupedProducts[category][farm]).forEach(price => {
                sortedArray.push({
                    farm,
                    price: parseFloat(price), // Ensure price is a number
                    products: groupedProducts[category][farm][price] || []
                });
            });
        });

        // Sort by price (low to high), then by farm name (alphabetically)
        sortedArray.sort((a, b) => a.price - b.price || a.farm.localeCompare(b.farm));

        // Rebuild sorted category
        let sortedCategory = {};
        sortedArray.forEach(({ farm, price, products }) => {
            if (!sortedCategory[farm]) sortedCategory[farm] = {};
            sortedCategory[farm][price] = products;
        });

        // Assign sorted structure back to groupedProducts
        groupedProducts[category] = sortedCategory;
    });
}

// TODO: Test flower pages with more numerous items, may need to mock up data
// TODO: Split carts into 510 and Dispos