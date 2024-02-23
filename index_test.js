import test from 'node:test'
import { strictEqual } from 'node:assert/strict'

import { processCSSX } from './index.js'

test('get vars root', () => {
  const result = processCSSX(`
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
  const result = processCSSX(`
    body {
      font-size: 16px;
    }
  `)
  strictEqual(result.elements[0].selector, 'body')
})

test('get basic html', () => {
  const result = processCSSX(`
    body {
      font-size: 16px;
    }

    h1 {
      font-size: 32px;
    }
  `)
  strictEqual(result.elements[0].selector, 'body')
  strictEqual(result.elements[1].selector, 'h1')
})

test('nested', () => {
  const result = processCSSX(`
    nav {
      display: "flex";
    }

    nav a {
      content: "About";
      touch-action: "about.html";
    }

    nav a {
      content: "Docs";
      touch-action: "docs.html";
    }
  `)
  strictEqual(result.elements[0].selector, 'nav')
  strictEqual(result.elements[1].selector, 'a')
  strictEqual(result.elements[1].selectorParent, 'nav')
  strictEqual(result.elements[2].selector, 'a')
  strictEqual(result.elements[2].selectorParent, 'nav')
})
