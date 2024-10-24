import test from 'node:test'
import { strictEqual } from 'node:assert/strict'

import postcss from 'postcss'

import { globals, transpileCSSX } from '../core.js'

test('default', () => {
  const result = transpileCSSX('')

  const { lang, title, description, generator } = { ...globals }

  strictEqual(result, `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="icon" href="favicon.svg" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="generator" content="${generator}" />
</head>

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
  strictEqual(result, `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="icon" href="favicon.svg" />
<title>Demo title</title>
<meta name="description" content="Demo description" />
</head>

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
    strictEqual(node.selector.split('.')[0], 'body')
    strictEqual(node.nodes[0].prop, 'font-size')
    strictEqual(node.nodes[0].value, '16px')
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

  strictEqual(nodes[0].selector.split('.')[0], 'body')
  strictEqual(nodes[0].nodes[0].prop, 'font-size')
  strictEqual(nodes[0].nodes[0].value, '16px')

  strictEqual(nodes[1].selector.split('.')[0], 'h1')
  strictEqual(nodes[1].nodes[0].prop, 'font-size')
  strictEqual(nodes[1].nodes[0].value, '32px')
})
