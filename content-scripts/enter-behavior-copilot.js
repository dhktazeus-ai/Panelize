// Copilot Enter/Shift+Enter behavior swap
// Depends on enter-behavior-utils.js and button-finder-utils.js.

// Signed-in Microsoft 365 Copilot Chat uses a Lexical contenteditable composer;
// the textarea is the signed-out landing box.
const COPILOT_INPUT_SELECTORS = [
  '#m365-chat-editor-target-element[contenteditable="true"]',
  '[role="combobox"][contenteditable="true"][data-lexical-editor="true"]',
  '[role="textbox"][contenteditable="true"][data-lexical-editor="true"]',
  'textarea#unauth-prompt-input',
  'textarea[aria-label="input"]',
  'textarea[placeholder*="Copilot"]'
];
const COPILOT_SEND_BUTTON_SELECTORS = [
  { type: 'css', value: 'button.fai-SendButton[type="submit"]' },
  { type: 'css', value: 'button.fai-SendButton' },
  { type: 'css', value: '#unauth-prompt-submit[aria-label="Send"]' },
  { type: 'css', value: '[role="button"][aria-label="Send"]' }
];

function isCopilotInput(element) {
  return Boolean(
    element &&
    (element.tagName === 'TEXTAREA' || element.isContentEditable) &&
    element.matches(COPILOT_INPUT_SELECTORS.join(',')) &&
    element.offsetParent !== null
  );
}

function isCopilotStopButton(button) {
  if (button.querySelector('.fai-SendButton__stopIcon')) {
    return true;
  }
  return /\bstop\b/i.test(button.getAttribute('aria-label') || '');
}

function insertCopilotNewline(textarea) {
  textarea.setRangeText('\n', textarea.selectionStart, textarea.selectionEnd, 'end');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertCopilotEditorLineBreak(editor) {
  // Lexical handles Shift+Enter as a line break; this synthetic event is not
  // trusted, so the swap handler below ignores it.
  const shiftEnter = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    shiftKey: true,
    bubbles: true,
    cancelable: true
  });
  const handled = !editor.dispatchEvent(shiftEnter);
  if (!handled) {
    document.execCommand('insertLineBreak');
  }
}

function handleCopilotEnterSwap(event) {
  if (!event.isTrusted || event.code !== 'Enter' || event.isComposing || !enterKeyConfig?.enabled) {
    return;
  }

  const input = document.activeElement;
  if (!isCopilotInput(input)) {
    return;
  }

  if (matchesModifiers(event, enterKeyConfig.newlineModifiers)) {
    if (input.tagName === 'TEXTAREA') {
      event.preventDefault();
      event.stopImmediatePropagation();
      insertCopilotNewline(input);
    } else if (!event.shiftKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      insertCopilotEditorLineBreak(input);
    }
    return;
  }

  if (!matchesModifiers(event, enterKeyConfig.sendModifiers)) {
    return;
  }

  const sendButton = window.ButtonFinderUtils?.findButton(COPILOT_SEND_BUTTON_SELECTORS);
  if (
    !sendButton ||
    sendButton.disabled ||
    sendButton.getAttribute('aria-disabled') === 'true' ||
    isCopilotStopButton(sendButton)
  ) {
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
