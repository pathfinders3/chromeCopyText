const COPY_MODE_COMMANDS = {
  "set-copy-mode-tag": "tag",
  "set-copy-mode-sentence": "sentence",
  "set-copy-mode-pattern": "pattern",
  "set-copy-mode-date": "date",
};

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-options-page") {
    chrome.runtime.openOptionsPage();
    return;
  }

  const copyMode = COPY_MODE_COMMANDS[command];

  if (copyMode) {
    chrome.storage.sync.set({ copyMode });
    return;
  }
});
