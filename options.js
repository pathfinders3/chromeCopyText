const radios = document.querySelectorAll("input[name='copyMode']");
const status = document.getElementById("status");

chrome.storage.sync.get(
  { copyMode: "tag" },
  (items) => {
    const selected = document.querySelector(
      `input[name='copyMode'][value='${items.copyMode}']`
    );

    if (selected) selected.checked = true;
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