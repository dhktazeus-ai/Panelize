// Meta AI Enter/Shift+Enter behavior swap
// Depends on enter-behavior-utils.js and button-finder-utils.js.

const META_AI_INPUT_SELECTORS = [
  'input[aria-label="Ask Meta AI"]',
  'textarea[aria-label="Ask Meta AI"]',
  'input[placeholder^="Ask Meta AI"]',
  'textarea[placeholder^="Ask Meta AI"]'
];
const META_AI_SEND_BUTTON_SELECTORS = [
  { type: 'css', value: 'button[aria-label="Send"]' }
];

function isMetaAIInput(element) {
  return Boolean(
    element &&
    element.matches(META_AI_INPUT_SELECTORS.join(',')) &&
    element.offsetParent !== null
  );
}

function insertMetaAINewline(textarea) {
  textarea.setRangeText('\n', textarea.selectionStart, textarea.selectionEnd, 'end');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleMetaAIEnterSwap(event) {
  if (!event.isTrusted || event.code !== 'Enter' || event.isComposing || !enterKeyConfig?.enabled) {
    return;
  }

  const input = document.activeElement;
  if (!isMetaAIInput(input)) {
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    if (input.tagName === 'TEXTAREA') {
      event.preventDefault();
      event.stopImmediatePropagation();
      insertMetaAINewline(input);
    }
    return;
  }

  if (!matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    return;
  }

  const sendButton = window.ButtonFinderUtils?.findButton(META_AI_SEND_BUTTON_SELECTORS);
  if (!sendButton || sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true') {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  sendButton.click();
}

function handleEnterSwap(event) {
  handleMetaAIEnterSwap(event);
}

applyEnterSwapSetting();
