// Multi-panel Send All for composers built on Lexical: signed-in Meta AI and
// Microsoft 365 Copilot Chat (copilot.cloud.microsoft/chat).
//
// The shared injector in text-injection-all-providers.js only knows the
// signed-out landing inputs for these two sites (a plain <input>/<textarea>).
// Once the user is signed in, the real composer is a Lexical contenteditable,
// so the shared injector finds nothing and logs "input element not found".
// This script fills and sends the real composer instead. On the signed-out
// landing pages it finds no Lexical composer and stays out of the way.
(() => {
  if (window.__panelizeLexicalComposerSendLoaded) {
    return;
  }
  window.__panelizeLexicalComposerSendLoaded = true;

  const MULTI_PANEL_CONTEXT = 'multi-panel';
  const MAX_TEXT_LENGTH = 1048576;
  const COMPOSER_WAIT_MS = 3000;
  const EDITOR_SETTLE_MS = 50;
  const SEND_SETTLE_MS = 300;
  const SEND_WAIT_MS = 6000;
  const POLL_INTERVAL_MS = 100;

  const PROVIDERS = {
    'meta-ai': {
      hostnames: ['meta.ai', 'www.meta.ai'],
      composerSelectors: [
        '[data-testid="composer-input"][contenteditable="true"]',
        'textarea[data-testid="composer-input"]:not([disabled]):not([data-ecto-composer-prehydration-input])'
      ],
      sendSelectors: [
        'button[data-testid="composer-send-button"]'
      ],
      // The shared injector already answers TRIGGER_SEND with button[aria-label="Send"],
      // which matches Meta AI's send button; clicking it here too could send twice.
      handlesTriggerSend: false
    },
    copilot: {
      hostnames: ['copilot.cloud.microsoft'],
      composerSelectors: [
        '#m365-chat-editor-target-element[contenteditable="true"]',
        '[role="combobox"][contenteditable="true"][data-lexical-editor="true"]',
        '[role="textbox"][contenteditable="true"][data-lexical-editor="true"]'
      ],
      sendSelectors: [
        'button.fai-SendButton[type="submit"]',
        'button.fai-SendButton',
        '.fai-ChatInput__actions button[type="submit"]'
      ],
      handlesTriggerSend: true
    }
  };

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function detectProvider() {
    const hostname = window.location.hostname;
    return Object.keys(PROVIDERS).find((provider) => PROVIDERS[provider].hostnames.includes(hostname)) || null;
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }
    if (element.offsetParent !== null) {
      return true;
    }
    return typeof element.getClientRects === 'function' && element.getClientRects().length > 0;
  }

  function findFirstVisible(selectors) {
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (isVisible(element)) {
          return element;
        }
      }
    }
    return null;
  }

  async function waitFor(find, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let found = find();
    while (!found && Date.now() < deadline) {
      await delay(POLL_INTERVAL_MS);
      found = find();
    }
    return found;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, '');
  }

  function editorContains(editor, text) {
    const expected = normalizeText(text);
    return expected.length > 0 && normalizeText(editor.textContent).includes(expected);
  }

  function selectEditorContents(editor) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function insertIntoEditor(editor, text) {
    editor.focus();
    // Select any leftover draft so the shared prompt replaces it.
    selectEditorContents(editor);

    // Lexical listens for beforeinput; execCommand fires a trusted one and
    // Lexical commits the change on its next update, so check after a tick.
    try {
      document.execCommand('insertText', false, text);
    } catch (_error) {
      // Fall through to the paste path.
    }
    await delay(EDITOR_SETTLE_MS);
    if (editorContains(editor, text)) {
      return true;
    }

    // Lexical also accepts a paste event that carries plain text.
    try {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      editor.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      }));
    } catch (_error) {
      // DataTransfer/ClipboardEvent unavailable; use the DOM fallback below.
    }
    await delay(EDITOR_SETTLE_MS);
    if (editorContains(editor, text)) {
      return true;
    }

    editor.textContent = text;
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return editorContains(editor, text);
  }

  function fillTextarea(textarea, text) {
    textarea.focus();
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (descriptor?.set) {
      descriptor.set.call(textarea, text);
    } else {
      textarea.value = text;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    return textarea.value === text;
  }

  function isStopControl(button) {
    if (button.querySelector('.fai-SendButton__stopIcon')) {
      return true;
    }
    const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`;
    return /\bstop\b/i.test(label);
  }

  function isSendControlReady(button) {
    return Boolean(
      button &&
      isVisible(button) &&
      !button.disabled &&
      button.getAttribute('aria-disabled') !== 'true' &&
      !isStopControl(button)
    );
  }

  function findReadySendControl(config) {
    for (const selector of config.sendSelectors) {
      for (const button of document.querySelectorAll(selector)) {
        if (isSendControlReady(button)) {
          return button;
        }
      }
    }
    return null;
  }

  async function handleInjectText(provider, config, data) {
    const text = data.text;
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT_LENGTH) {
      return;
    }

    const composer = await waitFor(() => findFirstVisible(config.composerSelectors), COMPOSER_WAIT_MS);
    if (!composer) {
      // Signed-out landing page: the shared injector handles its plain input.
      return;
    }

    const filled = composer.isContentEditable || composer.getAttribute('contenteditable') === 'true'
      ? await insertIntoEditor(composer, text)
      : fillTextarea(composer, text);
    if (!filled) {
      console.warn(`[Lexical Composer] Could not fill the ${provider} composer`);
      return;
    }

    if (data.autoSubmit !== true) {
      return;
    }

    await delay(SEND_SETTLE_MS);
    const sendButton = await waitFor(() => findReadySendControl(config), SEND_WAIT_MS);
    if (!sendButton) {
      console.warn(`[Lexical Composer] ${provider} send button did not become available`);
      return;
    }
    sendButton.click();
  }

  function handleTriggerSend(config) {
    if (!findFirstVisible(config.composerSelectors)) {
      return;
    }
    const sendButton = findReadySendControl(config);
    if (sendButton) {
      sendButton.click();
    }
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object' || data.context !== MULTI_PANEL_CONTEXT) {
      return;
    }

    const provider = detectProvider();
    const config = provider ? PROVIDERS[provider] : null;
    if (!config) {
      return;
    }

    if (data.type === 'INJECT_TEXT') {
      handleInjectText(provider, config, data).catch((error) => {
        console.warn(`[Lexical Composer] ${provider} send failed:`, error);
      });
    } else if (data.type === 'TRIGGER_SEND' && config.handlesTriggerSend) {
      handleTriggerSend(config);
    }
  });
})();
