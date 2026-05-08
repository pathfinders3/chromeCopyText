let copyMode = "tag";
let cumulativeMode = false;
const SENTENCE_DELIMITERS = new Set([".", "!", "?", "…", "。"]);
const CODE_PATTERN_REGEX = /\b[A-Za-z]+-\d+\b/g;
const SINGLE_CODE_PATTERN_REGEX = /[A-Za-z]+-\d+/;

// 옵션값을 미리 읽어둠
chrome.storage.sync.get({ copyMode: "tag", cumulativeMode: false }, (items) => {
  copyMode = items.copyMode;
  cumulativeMode = items.cumulativeMode;
});

// 옵션 변경 시 즉시 반영
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    if (changes.copyMode) {
      copyMode = changes.copyMode.newValue;
    }
    if (changes.cumulativeMode) {
      cumulativeMode = changes.cumulativeMode.newValue;
    }
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

  if (copyMode === "pattern") {
    const patternInfo = getPatternFromClick(block, event.clientX, event.clientY);
    text = sanitizeCodePattern(patternInfo.text || "");

    // 클릭 지점 기반 탐색이 실패해도 블록 텍스트에서 패턴만 추출해 복사한다.
    if (!text) {
      text = sanitizeCodePattern(block.innerText || "");
    }

    highlightRange = patternInfo.range;
  }

  if (!text) return;

  try {
    let clipboardText = text;
    const shouldResetCumulative = event.shiftKey;
    
    if (cumulativeMode && !shouldResetCumulative) {
      try {
        const existingText = await navigator.clipboard.readText();
        clipboardText = existingText + "\n" + text;
      } catch (readError) {
        // 클립보드 읽기 실패 시 새 텍스트만 복사
        clipboardText = text;
      }
    }
    
    await navigator.clipboard.writeText(clipboardText);
    if (highlightRange) {
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

  const start = findSentenceStart(fullText, globalOffset);
  const end = findSentenceEnd(fullText, globalOffset);

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

function getPatternFromClick(block, x, y) {
  const segments = getTextSegments(block);
  if (segments.length === 0) return { text: "", range: null };

  const fullText = segments.map((segment) => segment.text).join("");
  const matches = Array.from(fullText.matchAll(CODE_PATTERN_REGEX));
  if (matches.length === 0) return { text: "", range: null };

  const range = getCaretRangeFromPoint(x, y);
  let globalOffset = null;

  if (range && range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
    const clickedSegment = segments.find((segment) => segment.node === range.startContainer);
    if (clickedSegment) {
      globalOffset = clickedSegment.start + range.startOffset;
    }
  }

  let selectedMatch = matches[0];
  if (globalOffset !== null) {
    const containingMatch = matches.find((match) => {
      const start = match.index || 0;
      const end = start + match[0].length;
      return globalOffset >= start && globalOffset < end;
    });

    if (containingMatch) {
      selectedMatch = containingMatch;
    } else {
      selectedMatch = matches.reduce((best, current) => {
        const bestStart = best.index || 0;
        const currentStart = current.index || 0;
        const bestDistance = Math.abs(globalOffset - bestStart);
        const currentDistance = Math.abs(globalOffset - currentStart);

        return currentDistance < bestDistance ? current : best;
      }, matches[0]);
    }
  }

  const start = selectedMatch.index || 0;
  const end = start + selectedMatch[0].length;
  const startPos = getPositionFromOffset(segments, start);
  const endPos = getPositionFromOffset(segments, end);
  if (!startPos || !endPos) return { text: selectedMatch[0], range: null };

  const patternRange = document.createRange();
  patternRange.setStart(startPos.node, startPos.offset);
  patternRange.setEnd(endPos.node, endPos.offset);

  return { text: selectedMatch[0], range: patternRange };
}

function sanitizeCodePattern(text) {
  if (!text) return "";

  const match = text.match(SINGLE_CODE_PATTERN_REGEX);
  return match ? match[0] : "";
}

function isSentenceDelimiter(char) {
  return SENTENCE_DELIMITERS.has(char);
}

function skipLeadingSpaces(text, index) {
  let i = index;
  while (i < text.length && /\s/.test(text[i])) {
    i += 1;
  }
  return i;
}

function findSentenceStart(text, pivot) {
  if (!text) return 0;

  const startPivot = Math.min(Math.max(pivot, 0), text.length - 1);
  for (let i = startPivot; i >= 0; i -= 1) {
    if (isSentenceDelimiter(text[i])) {
      return skipLeadingSpaces(text, i + 1);
    }
  }

  return skipLeadingSpaces(text, 0);
}

function findSentenceEnd(text, pivot) {
  if (!text) return 0;

  const startPivot = Math.min(Math.max(pivot, 0), text.length - 1);
  for (let i = startPivot; i < text.length; i += 1) {
    if (isSentenceDelimiter(text[i])) {
      return i + 1;
    }
  }

  return text.length;
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