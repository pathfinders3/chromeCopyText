let copyMode = "tag";

// 옵션값을 미리 읽어둠
chrome.storage.sync.get({ copyMode: "tag" }, (items) => {
  copyMode = items.copyMode;
});

// 옵션 변경 시 즉시 반영
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.copyMode) {
    copyMode = changes.copyMode.newValue;
  }
});

document.addEventListener("click", async function (event) {
  if (!event.ctrlKey) return;

  event.preventDefault();
  event.stopPropagation();

  let text = "";
  let highlightElement = null;

  const block = event.target.closest("p, div, li");
  if (!block) return;

  if (copyMode === "tag") {
    text = block.innerText.trim();
    highlightElement = block;
  }

  if (copyMode === "sentence") {
    text = getSentenceFromClick(block, event.clientX, event.clientY);
    highlightElement = block;
  }

  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    flashBorder(highlightElement);
    console.log("Copied:", text);
  } catch (error) {
    console.error("Clipboard copy failed:", error);
  }
}, true);

function getSentenceFromClick(block, x, y) {
  const range = getCaretRangeFromPoint(x, y);
  if (!range) return "";

  const clickedNode = range.startContainer;
  const clickedOffset = range.startOffset;

  if (!clickedNode || clickedNode.nodeType !== Node.TEXT_NODE) {
    return "";
  }

  const text = clickedNode.textContent;
  if (!text) return "";

  let start = text.lastIndexOf(".", clickedOffset);
  let end = text.indexOf(".", clickedOffset);

  start = start === -1 ? 0 : start + 1;
  end = end === -1 ? text.length : end + 1;

  return text.slice(start, end).trim();
}

function getCaretRangeFromPoint(x, y) {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;

    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    return range;
  }

  return null;
}

function flashBorder(element) {
  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;

  element.style.outline = "3px solid red";
  element.style.outlineOffset = "2px";

  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.outlineOffset = originalOutlineOffset;
  }, 1000);
}