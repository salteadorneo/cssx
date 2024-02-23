import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

const packageJSON = JSON.parse(readFileSync('./package.json'))
const { version } = packageJSON

const RESERVED_PROPERTIES = [
  'content',
  'touch-action',
  'src'
]

const DEFAULT_VARS = {
  lang: 'en',
  title: 'CSSX',
  description: 'Site generated with CSSX',
  generator: `CSSX v${version}`
}

const __dirname = dirname(fileURLToPath(import.meta.url))

const currentDirectory = join(__dirname, 'src')

// if (fs.existsSync(path.join(__dirname, 'dist'))) {
//   fs.rmdirSync(path.join(__dirname, 'dist'), { recursive: true });
// }
if (!existsSync(join(__dirname, 'dist'))) {
  mkdirSync(join(__dirname, 'dist'))
}

readdirSync(currentDirectory).forEach((file) => {
  if (extname(file) === '.cssx') {
    const inputFile = join(currentDirectory, file)
    const name = basename(file, '.cssx')
    const outputFile = join(__dirname, 'dist', `${name}.html`)
    generateHtml(inputFile, outputFile)
  }
})

export function generateHtml (inputFile, outputFile) {
  const filename = basename(inputFile, '.cssx')

  const content = readFileSync(inputFile, 'utf8')

  const { vars, elements } = processCSSX(content)

  if (elements.length === 0) {
    console.log(`No components found in ${filename}.cssx`)
    return
  }

  const styles = elements
    .map(drawClass)
    .filter(Boolean)
    .join('\n')

  const elementsOpen = []

  const body = elements.reduce((acc, element, index) => {
    const nextElement = elements[index + 1]
    if (nextElement?.selectorParent === element.selector) {
      elementsOpen.push(element.selector)
      const elementContent = drawElement(element, false)
      if (elementContent) {
        return `${acc}\n${elementContent}`
      }
    }
    const elementContent = drawElement(element)
    if (elementContent) {
      let elementsToClose = ''
      while (elementsOpen.length && nextElement?.selectorParent !== elementsOpen.at(-1)) {
        elementsToClose += `\n</${elementsOpen.at(-1)}>`
        elementsOpen.pop()
      }

      if (elementsToClose !== '') {
        return `${acc}\n${elementContent}${elementsToClose}`
      }

      return `${acc}\n${elementContent}`
    }
    return acc
  }, '')

  const { lang, title, description, generator } = { ...DEFAULT_VARS, ...vars }

  const htmlContent = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="generator" content="${generator}" />
<style>
${styles}
</style>
</head>
<body>
${body}
</body>
</html>`

  writeFileSync(outputFile, htmlContent, 'utf8')

  console.log(`Generated ${filename}.html with CSSX`)
}

export function processCSSX (content) {
  let vars = null
  const elements = []

  content.replace(/([^{]+)\s*{\s*([^}]+)}/g, (block) => {
    const result = getVariables(block)
    if (result && Object.keys(result).length > 0) {
      vars = result
    }

    const elem = getInfoElement(block)
    elements.push(elem)
  })
  return { vars, elements }
}

export function drawClass (element) {
  const { hash, selector, styles } = element
  if (!styles) {
    return null
  }
  const className = hash ? `.cssx-${hash}` : ''
  return `${selector}${className} { ${styles} }`
}

export function drawElement (element, endTag = true) {
  const {
    hash,
    selector,
    content = '',
    src = '',
    'touch-action': touchAction = ''
  } = element

  if (selector === ':root' || selector === 'body') {
    return null
  }

  if (selector === 'script') {
    return `<${selector} type="module" src='${src}'></${selector}>`
  }

  const attributes = {}
  attributes.class = `cssx-${hash}`

  if (touchAction) {
    if (selector === 'a') {
      attributes.href = touchAction
    } else {
      attributes.onclick = touchAction
    }
  }

  const attr = Object.keys(attributes)
    .map((key) => ` ${key}="${attributes[key]}"`)
    .join('')

  if (selector === 'img') {
    return `<${selector}${attr} src='${src}' alt='${content}' />`
  }

  if (!endTag) {
    return `<${selector}${attr}>${content}`
  }

  return `<${selector}${attr}>${content}</${selector}>`
}

function getVariables (content) {
  const result = {}
  content.replace(
    /([^{]+)\s*{\s*([^}]+)}/g,
    (match, foundSelector, foundStyles) => {
      const selector = foundSelector.trim()

      if (selector !== ':root') return null

      foundStyles
        .trim()
        .replace(/\n/g, '')
        .replace(/\s{2,}/g, ' ')
        .split(';')
        .filter(Boolean)
        .forEach((varValue) => {
          const [name, value] = varValue.split(':')
          const nameParsed = name.replace('--', '').trim()
          const valueParsed = value.replace(/"/g, '').trim()
          result[nameParsed] = valueParsed
        })
    }
  )
  return result
}

function getInfoElement (value) {
  let selector = ''
  let selectorParent = null

  let styles = ''

  const properties = {}

  value.replace(
    /([^{]+)\s*{\s*([^}]+)}/g,
    (match, foundSelector, foundStyles) => {
      selector = foundSelector.trim()

      const selectors = selector.split(' ')
      if (selectors.length > 1) {
        selectorParent = selectors.at(-2)
        selector = selectors.at(-1)
      }

      const stylesParsed = foundStyles
        .trim()
        .replace(
          new RegExp(`(${RESERVED_PROPERTIES.join('|')})\\s*:\\s*"[^"]+";`, 'g'),
          ''
        )
      const stylesClean = stylesParsed
        .trim()
        .replace(/\n/g, '')
        .replace(/\s{2,}/g, ' ')

      styles = stylesClean
      return ''
    }
  )
  const regexProps = new RegExp(`(${RESERVED_PROPERTIES.join('|')}):\\s*"([^"]+)";`, 'g')

  value.replace(regexProps, (match, property, found) => {
    properties[property] = found.trim()
    return ''
  })

  const selectorsNonClass = [':root', 'html', 'body']

  const hash = !selectorsNonClass.includes(selector) && Math.random().toString(36).substring(7)

  return { hash, selector, selectorParent, styles, ...properties }
}
