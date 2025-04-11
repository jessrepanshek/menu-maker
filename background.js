chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetchData") {
        console.log(`Fetching data for category: ${message.category}`);
        
        fetchDataFromAPI(message.category)
            .then(data => {
                console.log("API Response Received:", data);

                // Store data temporarily in Chrome storage
                chrome.storage.local.set({ fetchedData: data, selectedCategory: message.category }, () => {
                    console.log("Data and category stored successfully.");

                    // Open display.html in a new tab
                    chrome.tabs.create({ url: chrome.runtime.getURL("display.html") });
                });
            })
            .catch(error => console.error("Error fetching data:", error));
    }
});

async function fetchDataFromAPI(category) {
    const categoryUrls = {
        carts: "https://app.posabit.com/api/v1/menu_feeds/538176e0-39fd-42c5-9b81-d9dd6d2f0591",
        dabs: "https://app.posabit.com/api/v1/menu_feeds/4d688b26-d0bd-481e-89ec-68ce0c72d0f6",
        flower: "https://app.posabit.com/api/v1/menu_feeds/04c0a074-8bbb-4948-89d3-1e8f54556d44",
        prerolls: "https://app.posabit.com/api/v1/menu_feeds/c3f32dc0-f575-48fe-a83d-3c28bdf00841",
        prepacks: "https://app.posabit.com/api/v1/menu_feeds/ea944211-7cb0-4f3b-8298-6a95147a8f6e"
    };

    const FETCH_URL = categoryUrls[category];
    if (!FETCH_URL) {
        console.error("Invalid category:", category);
        throw new Error(`Invalid category: ${category}`);
    }

    return new Promise((resolve, reject) => {
        chrome.storage.local.get("theSauce", async (result) => {
            if (!result.theSauce) {
                console.error("The sauce not found!");
                return reject("Missing sauce");
            }

            try {
                const response = await fetch(FETCH_URL, {
                    method: "GET",
                    headers: { "Authorization": `Bearer ${result.theSauce}` }
                });

                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                resolve(await response.json());
            } catch (error) {
                console.error("Fetch Error:", error);
                reject(error);
            }
        });
    });
}


