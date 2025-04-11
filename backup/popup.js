document.addEventListener("DOMContentLoaded", function () {
    const scrapeButton = document.getElementById("scrape-button");
    const viewButton = document.getElementById("view-data");
    const clearButton = document.getElementById("clear-data");
    const dataOutput = document.getElementById("data-output");

    // LISTEN for messages from background.js
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "updatePopup") {
            dataOutput.innerHTML = "<p>Data successfully gathered, click View Menus to see.</p>";
        }
    });

    // Scrape Data when button is clicked
    scrapeButton.addEventListener("click", scrapeData);

    // Button to view data in display.html
    viewButton.addEventListener("click", () => {
        chrome.tabs.create({ url: "display.html" });
    });

    // Clear stored data
    clearButton.addEventListener("click", () => {
        chrome.storage.local.clear(() => {
            dataOutput.innerHTML = "<p>Data successfully cleared.</p>";
        });
    });

    // SCRAPE DATA: Scrapes data from the current tab
    function scrapeData() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ["content.js"]
            });
        });
    }
});

