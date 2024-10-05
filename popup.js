document.addEventListener('DOMContentLoaded', () => {
    const limitInput = document.getElementById("limit");
    const saveButton = document.getElementById("save");
    const resetButton = document.getElementById("reset");
    const shortsWatchedDisplay = document.getElementById("shorts-watched");
  
    // Load current limit and shorts count
    chrome.storage.sync.get(['limit', 'shortsWatched'], ({ limit, shortsWatched }) => {
      limitInput.value = limit || 10; // Default to 10
      shortsWatchedDisplay.textContent = shortsWatched || 0;
    });
  
    // Save new limit
    saveButton.addEventListener("click", () => {
      const newLimit = parseInt(limitInput.value);
      if (newLimit > 0) {
        chrome.storage.sync.set({ limit: newLimit }, () => {
          alert("Limit saved!");
        });
      } else {
        alert("Please enter a valid limit greater than 0.");
      }
    });
  
    // Reset the shorts count
    resetButton.addEventListener("click", () => {
      chrome.storage.sync.set({ shortsWatched: 0 }, () => {
        shortsWatchedDisplay.textContent = "0";
        chrome.runtime.sendMessage({ type: "reset" }); // Send reset message
        alert("Count reset!");
      });
    });
  });
  