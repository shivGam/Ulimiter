// Constants
const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// State variables
let shortsWatched = 0;
let shortsHidden = false;
let limit = 10; // Default limit

// Function to safely send messages to the background script
function safeSendMessage(message) {
  return new Promise((resolve, reject) => {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          console.error("Failed to send message: ", chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } else {
      console.error("Chrome runtime is not available");
      reject(new Error("Chrome runtime is not available"));
    }
  });
}

// Hide Shorts content function
function hideShorts() {
  if (shortsHidden) return;
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
    stopAllShortsAudio();
    console.log("YouTube Shorts have been hidden and audio stopped. You have reached your limit.");
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

// Function to stop all Shorts audio
function stopAllShortsAudio() {
  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    if (video.closest('ytd-reel-video-renderer')) {
      video.pause();
      video.currentTime = 0;
    }
  });
}

// Function to continuously check and stop Shorts audio
function continuouslyStopShortsAudio() {
  if (shortsHidden) {
    stopAllShortsAudio();
    requestAnimationFrame(continuouslyStopShortsAudio);
  }
}

// Check if the user is watching a YouTube short
function isWatchingShort() {
  return window.location.pathname.startsWith("/shorts/");
}

// Create and insert the Shorts counter
function createShortsCounter() {
  const counterDiv = document.createElement('div');
  counterDiv.id = 'yt-shorts-counter';
  counterDiv.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: #282828;
    color: #FFFFFF;
    border: 1px solid #FF0000;
    border-radius: 2px;
    padding: 2px 6px;
    font-size: 14px;
    font-weight: bold;
    margin-right: 16px;
  `;
  
  const counterLabel = document.createElement('span');
  counterLabel.textContent = 'Shorts: ';
  counterLabel.style.marginRight = '4px';
  
  const counterValue = document.createElement('span');
  counterValue.id = 'yt-shorts-count-value';
  counterValue.style.color = '#FF0000';
  
  counterDiv.appendChild(counterLabel);
  counterDiv.appendChild(counterValue);
  
  return counterDiv;
}

// Update the Shorts counter
function updateShortsCounter() {
  const counterValue = document.getElementById('yt-shorts-count-value');
  if (counterValue) {
    counterValue.textContent = shortsWatched.toString();
  }
}

// Insert the counter next to the signin/profile icon
function insertShortsCounter() {
  const targetElement = document.getElementById('end');
  if (targetElement && !document.getElementById('yt-shorts-counter')) {
    const counterDiv = createShortsCounter();
    targetElement.insertBefore(counterDiv, targetElement.firstChild);
    updateShortsCounter();
  }
}

// Check how many shorts have been watched and handle the limit
async function checkShortsWatch() {
  if (shortsHidden) return;

  if (isWatchingShort()) {
    shortsWatched++;

    try {
      await safeSendMessage({ type: "updateShortsWatched", count: shortsWatched });
      updateShortsCounter();

      const response = await safeSendMessage({ type: "getLimit" });
      if (response && response.limit) {
        limit = response.limit;
      }

      if (shortsWatched >= limit) {
        hideShorts();
        continuouslyStopShortsAudio();
      }
    } catch (error) {
      console.error("Error in checkShortsWatch:", error);
      if (shortsWatched >= limit) {
        hideShorts();
        continuouslyStopShortsAudio();
      }
    }
  }
}

// Reset shorts watched if more than 24 hours have passed
async function resetIfNeeded() {
  const result = await new Promise(resolve => chrome.storage.sync.get(['lastReset', 'shortsWatched'], resolve));
  const lastReset = result.lastReset ? new Date(result.lastReset) : null;
  const now = new Date();

  if (!lastReset || (now - lastReset) >= ONE_DAY) {
    shortsWatched = 0;
    chrome.storage.sync.set({ shortsWatched: 0, lastReset: now.toISOString() });
    showShorts();
    console.log("Shorts watched have been reset after 24 hours.");
  }
}

// Initialize the extension
async function initializeExtension() {
  try {
    await resetIfNeeded();

    const result = await new Promise(resolve => chrome.storage.sync.get(['shortsWatched', 'limit'], resolve));
    shortsWatched = result.shortsWatched || 0;
    limit = result.limit || 10;

    insertShortsCounter();

    if (shortsWatched >= limit) {
      hideShorts();
      continuouslyStopShortsAudio();
    }
  } catch (error) {
    console.error("Error initializing extension:", error);
  }
}

// Set up URL change detection using MutationObserver
function setupUrlChangeDetection() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      checkShortsWatch();
      if (shortsHidden) {
        stopAllShortsAudio();
      }
    }
  }).observe(document, { subtree: true, childList: true });
}

// Add a mutation observer to handle dynamic page changes
function observePageChanges() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const addedNodes = mutation.addedNodes;
        for (const node of addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.id === 'end') {
            insertShortsCounter();
            return;
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Listen for reset messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "reset") {
    shortsWatched = 0;
    showShorts();
    safeSendMessage({ type: "updateShortsWatched", count: 0 });
    chrome.storage.sync.set({ lastReset: new Date().toISOString() });
    updateShortsCounter();
    console.log("Limit reset!");
    sendResponse({ success: true });
  }
  return true;
});

// Initialize the extension when the script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeExtension();
    setupUrlChangeDetection();
    observePageChanges();
  });
} else {
  initializeExtension();
  setupUrlChangeDetection();
  observePageChanges();
}