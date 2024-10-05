let shortsWatched = 0;
let shortsHidden = false;
let limit = 10; // Default limit
const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Function to safely send messages to the background script
function safeSendMessage(message) {
  return new Promise((resolve, reject) => {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          console.log("Failed to send message: ", chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } else {
      console.log("Chrome runtime is not available");
      reject(new Error("Chrome runtime is not available"));
    }
  });
}

// Hide Shorts content function
function hideShorts() {
  if (shortsHidden) return; // Ensure shorts are not hidden multiple times
  shortsHidden = true;

  let style = document.getElementById('youtube-shorts-limiter-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'youtube-shorts-limiter-style';
  }

  style.textContent = `
    ytd-reel-video-renderer,
    ytd-shorts,
    ytd-reel-shelf-renderer {
      display: none !important;
    }
  `;

  try {
    document.head.appendChild(style);
    console.log("YouTube Shorts have been hidden. You have reached your limit.");
  } catch (error) {
    console.error("Error hiding YouTube Shorts:", error);
  }
}

// Show Shorts content function
function showShorts() {
  shortsHidden = false;
  const style = document.getElementById('youtube-shorts-limiter-style');
  if (style) {
    try {
      style.remove();
      console.log("YouTube Shorts are now visible.");
    } catch (error) {
      console.error("Error showing YouTube Shorts:", error);
    }
  }
}

// Check if the user is watching a YouTube short
function isWatchingShort() {
  return window.location.pathname.startsWith("/shorts/");
}

// Check how many shorts have been watched and handle the limit
async function checkShortsWatch() {
  if (shortsHidden) return;

  if (isWatchingShort()) {
    shortsWatched++;

    try {
      await safeSendMessage({ type: "updateShortsWatched", count: shortsWatched });

      const response = await safeSendMessage({ type: "getLimit" });
      if (response && response.limit) {
        limit = response.limit;
      }

      if (shortsWatched >= limit) {
        hideShorts();
      }
    } catch (error) {
      console.error("Error in checkShortsWatch:", error);
      // If we can't communicate with the background script, use the last known limit
      if (shortsWatched >= limit) {
        hideShorts();
      }
    }
  }
}

// Set up URL change detection using MutationObserver
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    checkShortsWatch();
  }
}).observe(document.body, { childList: true, subtree: true }); // Observe specific changes instead of whole document

// Reset shorts watched if more than 24 hours have passed
async function resetIfNeeded() {
  const result = await new Promise(resolve => chrome.storage.sync.get(['lastReset', 'shortsWatched'], resolve));
  const lastReset = result.lastReset ? new Date(result.lastReset) : null;
  const now = new Date();

  if (!lastReset || (now - lastReset) >= ONE_DAY) {
    // Reset shorts watched and update last reset date
    shortsWatched = 0;
    chrome.storage.sync.set({ shortsWatched: 0, lastReset: now.toISOString() });
    showShorts();
    console.log("Shorts watched have been reset after 24 hours.");
  }
}

// Initialize the extension
async function initializeExtension() {
  try {
    // Check and reset shorts watched if 24 hours have passed
    await resetIfNeeded();

    // Load the shorts watched count and limit from storage
    const result = await new Promise(resolve => chrome.storage.sync.get(['shortsWatched', 'limit'], resolve));
    shortsWatched = result.shortsWatched || 0;
    limit = result.limit || 10;

    if (shortsWatched >= limit) {
      hideShorts();
    }
  } catch (error) {
    console.error("Error initializing extension:", error);
  }
}

// Listen for reset messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "reset") {
    shortsWatched = 0;
    showShorts();
    safeSendMessage({ type: "updateShortsWatched", count: 0 });
    chrome.storage.sync.set({ lastReset: new Date().toISOString() }); // Update reset time
    console.log("Limit reset!");
    sendResponse({ success: true });
  }
  return true; // Indicates we want to use sendResponse asynchronously
});

// Initialize the extension when the script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}
