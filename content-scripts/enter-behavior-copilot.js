// Copilot Enter/Shift+Enter behavior swap
// Depends on enter-behavior-utils.js and button-finder-utils.js.

const COPILOT_INPUT_SELECTORS = [
  'textarea#unauth-prompt-input',
  'textarea[aria-label="input"]',
  'textarea[placeholder*="Copilot"]'
];
const COPILOT_SEND_BUTTON_SELECTORS = [
  { type: 'css', value: '#unauth-prompt-submit[aria-label="Send"]' },
  { type: 'css', value: '[role="button"][aria-label="Send"]' }
];

function isCopilotInput(element) {
  return Boolean(
    element &&
    element.tagName === 'TEXTAREA' &&
    element.matches(COPILOT_INPUT_SELECTORS.join(',')) &&
    element.offsetParent !== null
  );
}

function insertCopilotNewline(textarea) {
  textarea.setRangeText('\n', textarea.selectionStart, textarea.selectionEnd, 'end');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleCopilotEnterSwap(event) {
  if (!event.isTrusted || event.code !== 'Enter' || event.isComposing || !enterKeyConfig?.enabled) {
    return;
  }

  const textarea = document.activeElement;
  if (!isCopilotInput(textarea)) {
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    insertCopilotNewline(textarea);
    return;
  }

  if (!matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    return;
  }

  const sendButton = window.ButtonFinderUtils?.findButton(COPILOT_SEND_BUTTON_SELECTORS);
  if (!sendButton || sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true') {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  sendButton.click();
}

function handleEnterSwap(event) {
  handleCopilotEnterSwap(event);
}

applyEnterSwapSetting();
