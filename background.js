const COPY_MODE_COMMANDS = {
  "set-copy-mode-tag": "tag",
  "set-copy-mode-sentence": "sentence",
  "set-copy-mode-pattern": "pattern",
};

chrome.commands.onCommand.addListener((command) => {
  const copyMode = COPY_MODE_COMMANDS[command];

  if (copyMode) {
    chrome.storage.sync.set({ copyMode });
    return;
  }

  if (command === "toggle-cumulative-mode") {
    chrome.storage.sync.get({ cumulativeMode: false }, (items) => {
      chrome.storage.sync.set({ cumulativeMode: !items.cumulativeMode });
    });
  }
});
