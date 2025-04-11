document.addEventListener("DOMContentLoaded", function () {
    const buttons = {
        carts: document.getElementById("carts"),
        dabs: document.getElementById("dabs"),
        flower: document.getElementById("flower"),
        prerolls: document.getElementById("prerolls"),
        prepacks: document.getElementById("prepacks")
    };

    // Iterate over the object values (button elements)
    Object.values(buttons).forEach(button => {
        if (button) {  // Ensure the button exists before adding an event listener
            button.addEventListener("click", function () {
                const category = this.id; // Extract category from the ID
                console.log(`Button clicked: ${category}`);
                this.classList.toggle("clicked"); // Toggle class to trigger transition
                
                // Send message to background.js to initiate API fetch
                chrome.runtime.sendMessage({ action: "fetchData", category: category });
            });
        } else {
            console.warn("A button is missing from the DOM.");
        }
    });
});