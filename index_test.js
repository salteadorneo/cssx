import test from 'node:test'
import { strictEqual } from 'node:assert/strict'

import { processCssx } from './index.js'

test('get vars root', () => {
  const result = processCssx(`
    :root {
      --lang: "es";
      --title: "Test";
      --description: "My description";
      --generator: "";
    }
  `)
  strictEqual(result.vars.lang, 'es')
  strictEqual(result.vars.title, 'Test')
  strictEqual(result.vars.description, 'My description')
  strictEqual(result.vars.generator, '')
})

test('get basic html', () => {
  const result = processCssx(`
    body {
      font-size: 16px;
    }
  `)
  strictEqual(result.components[0].selector, 'body')
})

test('get basic html', () => {
  const result = processCssx(`
    body {
      font-size: 16px;
    }

    h1 {
      font-size: 32px;
    }
  `)
  strictEqual(result.components[0].selector, 'body')
  strictEqual(result.components[1].selector, 'h1')
})
