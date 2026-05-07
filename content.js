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
  let highlightRange = null;

  const block = event.target.closest("p, div, li");
  if (!block) return;

  if (copyMode === "tag") {
    text = block.innerText.trim();
    highlightElement = block;
  }

  if (copyMode === "sentence") {
    const sentenceInfo = getSentenceFromClick(block, event.clientX, event.clientY);
    text = sentenceInfo.text;
    highlightRange = sentenceInfo.range;
  }

  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    if (copyMode === "sentence" && highlightRange) {
      flashRangeBorder(highlightRange);
    } else {
      flashBorder(highlightElement);
    }
    console.log("Copied:", text);
  } catch (error) {
    console.error("Clipboard copy failed:", error);
  }
}, true);

function getSentenceFromClick(block, x, y) {
  const range = getCaretRangeFromPoint(x, y);
  if (!range) return { text: "", range: null };

  const clickedNode = range.startContainer;
  const clickedOffset = range.startOffset;

  if (!clickedNode || clickedNode.nodeType !== Node.TEXT_NODE) {
    return { text: "", range: null };
  }

  const segments = getTextSegments(block);
  if (segments.length === 0) return { text: "", range: null };

  const clickedSegment = segments.find((segment) => segment.node === clickedNode);
  if (!clickedSegment) return { text: "", range: null };

  const fullText = segments.map((segment) => segment.text).join("");
  const globalOffset = clickedSegment.start + clickedOffset;

  let start = fullText.lastIndexOf(".", globalOffset);
  let end = fullText.indexOf(".", globalOffset);

  start = start === -1 ? 0 : start + 1;
  end = end === -1 ? fullText.length : end + 1;

  const sentenceText = fullText.slice(start, end).trim();
  if (!sentenceText) return { text: "", range: null };

  const startPos = getPositionFromOffset(segments, start);
  const endPos = getPositionFromOffset(segments, end);
  if (!startPos || !endPos) return { text: "", range: null };

  const sentenceRange = document.createRange();
  sentenceRange.setStart(startPos.node, startPos.offset);
  sentenceRange.setEnd(endPos.node, endPos.offset);

  return { text: sentenceText, range: sentenceRange };
}

function getTextSegments(block) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const segments = [];
  let cursor = 0;
  let node = walker.nextNode();

  while (node) {
    const text = node.textContent || "";
    if (text.length > 0) {
      segments.push({
        node,
        text,
        start: cursor,
        end: cursor + text.length,
      });
      cursor += text.length;
    }
    node = walker.nextNode();
  }

  return segments;
}

function getPositionFromOffset(segments, offset) {
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (offset >= segment.start && offset <= segment.end) {
      return {
        node: segment.node,
        offset: offset - segment.start,
      };
    }
  }

  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) return null;

  return {
    node: lastSegment.node,
    offset: lastSegment.text.length,
  };
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
  if (!element) return;

  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;

  element.style.outline = "3px solid red";
  element.style.outlineOffset = "2px";

  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.outlineOffset = originalOutlineOffset;
  }, 1000);
}

function flashRangeBorder(range) {
  if (!range) return;

  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0
  );

  if (rects.length === 0) return;

  const overlays = rects.map((rect) => {
    const overlay = document.createElement("div");

    overlay.style.position = "fixed";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.border = "2px solid red";
    overlay.style.boxSizing = "border-box";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483647";

    document.body.appendChild(overlay);
    return overlay;
  });

  setTimeout(() => {
    overlays.forEach((overlay) => overlay.remove());
  }, 1000);
}