import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';

test('React Markdown and the updated KaTeX render inline and display mathematics', () => {
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { trust: false }]],
  }, 'Rumus $x^2 + y^2 = z^2$.\n\n$$\nE = mc^2\n$$\n\nTeks biasa.'));
  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /Teks biasa/);
  assert.doesNotMatch(html, /katex-error/);
});

test('untrusted mathematics cannot introduce an active hyperlink', () => {
  const html = katex.renderToString('\\href{javascript:alert(1)}{klik}', { trust: false, throwOnError: false });
  assert.doesNotMatch(html, /<a\b/i);
});

test('inherited trust cannot enable links in KaTeX options', () => {
  const prototype = Object.prototype as { trust?: boolean };
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'trust');
  Object.defineProperty(prototype, 'trust', { value: true, writable: true, configurable: true });
  try {
    const html = katex.renderToString('\\href{https://example.com/}{klik}', { throwOnError: false });
    assert.doesNotMatch(html, /<a\b/i);
  } finally {
    if (descriptor) Object.defineProperty(prototype, 'trust', descriptor);
    else delete prototype.trust;
  }
});
