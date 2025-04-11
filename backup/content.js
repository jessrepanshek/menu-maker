/* Goal Structure
[
  {
    "name": "Blue Dream",
    "farm": "Example Farm"
    "effect": "SATIVA",
    "effect_priority": 1,
    "thc_percent": "23%",
    "cbd_percent": "0.1%",
    "price": 25
  }
]
*/

(() => {
    console.log("Clearing local storage before processing");
    chrome.storage.local.clear(() => {
              console.log("Local storage cleared.");
          });

    let productCards = document.querySelectorAll(".PaB-product-card");
    let scrapedData = [];

    let pageIdentifier = document.querySelector("h2.PaB-product-listing__title")?.innerText.trim().toLowerCase() || "Unknown Page";

    productCards.forEach(card => {
        let name = card.querySelector(".PaB-product-card__title")?.innerText.trim() || "N/A";
        let metaStats = card.querySelectorAll(".PaB-product__meta-item"); // Metadata group
        let farm = metaStats[0]?.querySelector("dd")?.innerText.trim().replace("by ", "").toUpperCase() || "N/A"; // Farm name
        let effect = metaStats[1]?.querySelector("dd")?.innerText.trim() || "N/A"; // Sativa, hybrid, indica
        let thcPercent = metaStats[2]?.querySelector("dd")?.innerText.trim() || "N/A"; 
        let cbdPercent = metaStats[3]?.querySelector("dd")?.innerText.trim() || "N/A";
        let priceText = card.querySelector(".PaB-product-card__offer li span")?.innerText.trim() || "N/A";
        let price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, "")) : null; // Remove unnecessary formatting, convert to float
        if (price === null || isNaN(price)) {
            console.warn("Missing or invalid price:", priceText);
        }

        scrapedData.push({ name, farm, effect, thc_percent: thcPercent, cbd_percent: cbdPercent, price, page_identifier: pageIdentifier });
    });

    console.log("Content.js: The Scraped Data set:", scrapedData);

    // Tell background.js to save the data
    chrome.runtime.sendMessage({ action: "saveRawData", data: scrapedData });

})();
