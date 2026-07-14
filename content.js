let copyMode = "tag";
let cumulativeMode = false;
let shouldStartNewCumulative = false;
let shortcutGroup = "1234";
const SENTENCE_DELIMITERS = new Set([".", "!", "?", "…", "。"]);
const CODE_PATTERN_REGEX = /\b[A-Za-z]+-\d+\b/g;
const SINGLE_CODE_PATTERN_REGEX = /[A-Za-z]+-\d+/;
const DATE_PATTERN_REGEX = /(?:\b\d{4}\.\s?(?:0?[1-9]|1[0-2])\.\s?(?:0?[1-9]|[12]\d|3[01])\.)|(?:\b\d{4}\/(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\b)|(?:\b\d{4}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])\b)/g;
const SINGLE_DATE_PATTERN_REGEX = /(?:\b\d{4}\.\s?(?:0?[1-9]|1[0-2])\.\s?(?:0?[1-9]|[12]\d|3[01])\.)|(?:\b\d{4}\/(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\b)|(?:\b\d{4}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])\b)/;
const COPY_MODE_LABELS = {
  tag: "태그 기준",
  sentence: "문장 기준",
  pattern: "코드 패턴 기준",
  date: "날짜 기준",
};

// 옵션값을 미리 읽어둠
chrome.storage.sync.get({ copyMode: "tag", cumulativeMode: false, shortcutGroup: "1234" }, (items) => {
  copyMode = items.copyMode;
  cumulativeMode = items.cumulativeMode;
  shortcutGroup = items.shortcutGroup;
  shouldStartNewCumulative = items.cumulativeMode;
});

// 옵션 변경 시 즉시 반영
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    if (changes.copyMode) {
      copyMode = changes.copyMode.newValue;
      const modeLabel = COPY_MODE_LABELS[copyMode] || copyMode;
      showToast(`복사 기준: ${modeLabel}`);
    }
    if (changes.cumulativeMode) {
      cumulativeMode = changes.cumulativeMode.newValue;
      shouldStartNewCumulative = changes.cumulativeMode.newValue;
      showToast(
        `누적 모드: ${cumulativeMode ? "켜짐" : "꺼짐"}`
      );
    }
    if (changes.shortcutGroup) {
      shortcutGroup = changes.shortcutGroup.newValue;
      showToast(`단축키 세트: ALT+${shortcutGroup[0]}~${shortcutGroup[3]}`);
    }
  }
});

document.addEventListener("keydown", function (event) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;

  const target = event.target;
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  ) {
    return;
  }

  const modeKeys =
    shortcutGroup === "5678"
      ? { "5": "tag", "6": "sentence", "7": "pattern", "8": "date" }
      : { "1": "tag", "2": "sentence", "3": "pattern", "4": "date" };

  if (event.key === "0") {
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: "open-options-page" });
    return;
  }

  const nextMode = modeKeys[event.key];
  if (!nextMode) return;

  event.preventDefault();
  event.stopPropagation();
  chrome.storage.sync.set({ copyMode: nextMode });
}, true);

function showToast(message) {
  if (!message) return;

  const existing = document.getElementById("ctrl-click-copier-toast");
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = "ctrl-click-copier-toast";
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.right = "16px";
  toast.style.bottom = "16px";
  toast.style.padding = "10px 14px";
  toast.style.borderRadius = "10px";
  toast.style.background = "rgba(22, 22, 22, 0.9)";
  toast.style.color = "#ffffff";
  toast.style.fontSize = "13px";
  toast.style.fontWeight = "600";
  toast.style.lineHeight = "1.4";
  toast.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.35)";
  toast.style.zIndex = "2147483647";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(4px)";
  toast.style.transition = "opacity 0.15s ease, transform 0.15s ease";
  toast.style.pointerEvents = "none";

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(4px)";

    setTimeout(() => {
      toast.remove();
    }, 160);
  }, 1200);
}

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

  if (copyMode === "date") {
    const dateInfo = getDateFromClick(block, event.clientX, event.clientY);
    text = sanitizeDatePattern(dateInfo.text || "");

    // 클릭 지점 기반 탐색이 실패해도 블록 텍스트에서 날짜만 추출해 복사한다.
    if (!text) {
      text = sanitizeDatePattern(block.innerText || "");
    }

    highlightRange = dateInfo.range;
  }

  if (!text) return;

  try {
    let clipboardText = text;
    const shouldResetCumulative = event.shiftKey;
    const borderColor = cumulativeMode ? "#22c55e" : "red";
    
    if (cumulativeMode && !shouldResetCumulative) {
      if (shouldStartNewCumulative) {
        // 누적 모드로 전환된 뒤 첫 복사는 외부 앱의 기존 클립보드를 무시하고 시작한다.
        clipboardText = text;
      } else {
        try {
          const existingText = await navigator.clipboard.readText();
          clipboardText = existingText + "\n" + text;
        } catch (readError) {
          // 클립보드 읽기 실패 시 새 텍스트만 복사
          clipboardText = text;
        }
      }
    }
    
    await navigator.clipboard.writeText(clipboardText);
    if (cumulativeMode) {
      shouldStartNewCumulative = false;
    }

    if (highlightRange) {
      flashRangeBorder(highlightRange, borderColor);
    } else {
      flashBorder(highlightElement, borderColor);
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

function getDateFromClick(block, x, y) {
  const segments = getTextSegments(block);
  if (segments.length === 0) return { text: "", range: null };

  const fullText = segments.map((segment) => segment.text).join("");
  const matches = Array.from(fullText.matchAll(DATE_PATTERN_REGEX));
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

  const dateRange = document.createRange();
  dateRange.setStart(startPos.node, startPos.offset);
  dateRange.setEnd(endPos.node, endPos.offset);

  return { text: selectedMatch[0], range: dateRange };
}

function sanitizeCodePattern(text) {
  if (!text) return "";

  const match = text.match(SINGLE_CODE_PATTERN_REGEX);
  return match ? match[0] : "";
}

function sanitizeDatePattern(text) {
  if (!text) return "";

  const match = text.match(SINGLE_DATE_PATTERN_REGEX);
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

function flashBorder(element, color = "red") {
  if (!element) return;

  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;

  element.style.outline = `3px solid ${color}`;
  element.style.outlineOffset = "2px";

  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.outlineOffset = originalOutlineOffset;
  }, 1000);
}

function flashRangeBorder(range, color = "red") {
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
    overlay.style.border = `2px solid ${color}`;
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