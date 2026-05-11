const radios = document.querySelectorAll("input[name='copyMode']");
const cumulativeCheckbox = document.getElementById("cumulativeMode");
const status = document.getElementById("status");

chrome.storage.sync.get(
  { copyMode: "tag", cumulativeMode: false },
  (items) => {
    const selected = document.querySelector(
      `input[name='copyMode'][value='${items.copyMode}']`
    );

    if (selected) selected.checked = true;
    
    cumulativeCheckbox.checked = items.cumulativeMode;
  }
);

radios.forEach((radio) => {
  radio.addEventListener("change", () => {
    chrome.storage.sync.set(
      { copyMode: radio.value },
      () => {
        status.textContent = "저장되었습니다.";

        setTimeout(() => {
          status.textContent = "";
        }, 1000);
      }
    );
  });
});

cumulativeCheckbox.addEventListener("change", () => {
  chrome.storage.sync.set(
    { cumulativeMode: cumulativeCheckbox.checked },
    () => {
      status.textContent = "저장되었습니다.";

      setTimeout(() => {
        status.textContent = "";
      }, 1000);
    }
  );
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;

  if (changes.copyMode) {
    const nextMode = changes.copyMode.newValue;
    const selected = document.querySelector(
      `input[name='copyMode'][value='${nextMode}']`
    );

    if (selected) {
      selected.checked = true;
    }
  }

  if (changes.cumulativeMode) {
    cumulativeCheckbox.checked = changes.cumulativeMode.newValue;
  }
});