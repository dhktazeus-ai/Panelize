import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const contentScriptSource = readFileSync(
  resolve(process.cwd(), 'content-scripts/text-injection-all-providers.js'),
  'utf8'
);

function markVisible(element) {
  Object.defineProperty(element, 'offsetParent', {
    configurable: true,
    get: () => document.body,
  });
}

function dispatchMultiPanelMessage(payload) {
  window.dispatchEvent(new MessageEvent('message', { data: payload }));
}

beforeAll(() => {
  window.eval(contentScriptSource);
});

describe.each([
  {
    provider: 'Meta AI',
    url: 'https://meta.ai/',
    html: '<input aria-label="Ask Meta AI" placeholder="Ask Meta AI anything..."><button aria-label="Send" aria-disabled="true">Send</button>',
    inputSelector: 'input[aria-label="Ask Meta AI"]',
    sendSelector: 'button[aria-label="Send"]',
  },
  {
    provider: 'Copilot',
    url: 'https://copilot.cloud.microsoft/',
    html: '<textarea id="unauth-prompt-input" aria-label="input" placeholder="Ask Copilot"></textarea><div id="unauth-prompt-submit" role="button" aria-label="Send" aria-disabled="true">Send</div>',
    inputSelector: 'textarea#unauth-prompt-input',
    sendSelector: '#unauth-prompt-submit[aria-label="Send"]',
  },
])('$provider multi-panel send', ({ url, html, inputSelector, sendSelector }) => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    window.happyDOM.setURL(url);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('injects the shared prompt and clicks the provider send control', async () => {
    document.body.innerHTML = html;
    const input = document.querySelector(inputSelector);
    const sendButton = document.querySelector(sendSelector);
    markVisible(input);
    markVisible(sendButton);
    const submittedPrompts = [];
    input.addEventListener('input', () => {
      setTimeout(() => sendButton.setAttribute('aria-disabled', 'false'), 600);
    });
    sendButton.addEventListener('click', () => submittedPrompts.push(input.value));

    dispatchMultiPanelMessage({
      type: 'INJECT_TEXT',
      text: 'shared test prompt',
      autoSubmit: true,
      context: 'multi-panel',
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(submittedPrompts).toEqual([]);

    await vi.advanceTimersByTimeAsync(300);
    expect(input.value).toBe('shared test prompt');
    expect(submittedPrompts).toEqual(['shared test prompt']);
  });
});
