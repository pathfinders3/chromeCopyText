chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "open-options-page") {
    chrome.runtime.openOptionsPage();
  }
});
