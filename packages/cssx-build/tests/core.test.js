import test from 'node:test'
import assert from 'node:assert/strict'

import postcss from 'postcss'

import { globals, transpileCSSX } from '../core.js'

test('default', () => {
  const result = transpileCSSX('')

  const { lang, title, description, generator } = { ...globals }

  assert.strictEqual(result, `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="icon" href="favicon.svg" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="generator" content="${generator}" />
</head>
<body></body>
</html>`)
})

test('get vars root', () => {
  const result = transpileCSSX(`
    :root {
      --lang: "es";
      --title: "Demo title";
      --description: "Demo description";
      --generator: "";
    }
  `)
  assert.strictEqual(result, `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="icon" href="favicon.svg" />
<title>Demo title</title>
<meta name="description" content="Demo description" />
</head>
<body></body>
</html>`)
})

test('get basic body style', () => {
  const result = transpileCSSX(`
    body {
      font-size: 16px;
    }
  `)
  const style = result.match(/<style>(.*)<\/style>/s)[1]
  postcss.parse(style).nodes.forEach(node => {
    assert.strictEqual(node.selector.split('.')[0], 'body')
    assert.strictEqual(node.nodes[0].prop, 'font-size')
    assert.strictEqual(node.nodes[0].value, '16px')
  })
})

test('get basic nested', () => {
  const result = transpileCSSX(`
    body {
      font-size: 16px;

      h1 {
        font-size: 32px;
      }
    }
  `)
  const style = result.match(/<style>(.*)<\/style>/s)[1]
  const nodes = postcss.parse(style).nodes

  assert.strictEqual(nodes[0].selector.split('.')[0], 'body')
  assert.strictEqual(nodes[0].nodes[0].prop, 'font-size')
  assert.strictEqual(nodes[0].nodes[0].value, '16px')

  assert.strictEqual(nodes[1].selector.split('.')[0], 'h1')
  assert.strictEqual(nodes[1].nodes[0].prop, 'font-size')
  assert.strictEqual(nodes[1].nodes[0].value, '32px')
})

test('get basic vars', () => {
  const result = transpileCSSX(`
    h1 {
      --text: "Demo title";
      content: var(--text);
    }
  `)
  const h1 = result.match(/<h1(?:\s[^>]*)?>(.*?)<\/h1>/s)[1].trim()
  assert.strictEqual(h1, 'Demo title')
})

test('get basic vars nested', () => {
  const result = transpileCSSX(`
    p {
      --text: "Text";
      content: var(--text);

      a {
        --value: "Link";
        content: var(--value);
        --href: "https://example.com";
      }
    }
  `)
  const p = result.match(/<p(?:\s[^>]*)?>(.*?)<\/p>/s)[1].trim()
  assert.match(p, /Text/)

  const a = result.match(/<a(?:\s[^>]*)?>(.*?)<\/a>/s)[1].trim()
  assert.strictEqual(a, 'Link')

  const href = result.match(/<a(?:\s[^>]*)? href="(.*?)"/s)[1].trim()
  assert.strictEqual(href, 'https://example.com')
})
