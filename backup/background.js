chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "saveRawData") {        
        // Process the scraped data and prepare it for storage
        let processedData = message.data.map(product => ({
            name: product.name,
            farm: product.farm,
            effect: product.effect,
            effect_priority: product.effect_priority,
            thc_percent: product.thc_percent,
            cbd_percent: product.cbd_percent,
            price: product.price,
            page_identifier: product.page_identifier
        }));

        // Save the processed data to chrome storage
        chrome.storage.local.set({ scrapedProducts: processedData }, () => {
            console.log("Updated stored products:", processedData);

            // Notify the popup (if it's open) after saving
            chrome.runtime.sendMessage({ action: "updatePopup", data: processedData });

            // Send response to indicate success
            sendResponse({ status: "success" });
        });

        return true; // Indicates async response
    }

    return false; // Default case for other messages
});
