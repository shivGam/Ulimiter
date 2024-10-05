chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "updateShortsWatched") {
    chrome.storage.sync.set({ shortsWatched: message.count }, () => {
      sendResponse({success: true});
    });
    return true; // Indicates we want to use sendResponse asynchronously
  } else if (message.type === "getLimit") {
    chrome.storage.sync.get(['limit'], (result) => {
      sendResponse({limit: result.limit || 10});  // Default to 10 if not set
    });
    return true; // Indicates we want to use sendResponse asynchronously
  }
});

// Set default limit when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['limit'], (result) => {
    if (!result.limit) {
      chrome.storage.sync.set({ limit: 10 });
    }
  });
});