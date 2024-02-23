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

const args = process.argv.slice(2)
args.forEach((arg) => {
  if (arg === '--help') {
    console.log(`CSSX v${version}`)
    console.log('Usage: node index.js [options]')
    console.log('Options:')
    console.log('  --output=dist   Output directory')
    console.log('  --help          Show help')
    console.log('  --version       Show version number')
    console.log('Examples:')
    console.log('  node index.js --output=dist')
    process.exit(0)
  }
  if (arg === '--version') {
    console.log(version)
    process.exit(0)
  }
})

let buildDir = 'dist'
args
  .filter((arg) => arg.startsWith('--output'))
  .forEach((arg) => {
    buildDir = arg.split('=')[1] || 'dist'
  })

if (!existsSync(join(__dirname, buildDir))) {
  mkdirSync(join(__dirname, buildDir))
}

readdirSync(currentDirectory).forEach((file) => {
  if (extname(file) === '.cssx') {
    const inputFile = join(currentDirectory, file)
    const content = readFileSync(inputFile, 'utf8')

    const htmlContent = getHtmlFromCSSX(content)

    const name = basename(file, '.cssx')
    const outputFile = join(__dirname, buildDir, `${name}.html`)
    writeFileSync(outputFile, htmlContent, 'utf8')

    console.log(`Generated ${name}.html with CSSX`)
  }
})
console.log(`Build completed in /${buildDir} directory`)

export function getHtmlFromCSSX (code) {
  const { vars, elements } = processCSSX(code)

  if (elements.length === 0) {
    return ''
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

  return htmlContent
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
    if (src) {
      return `<${selector} src='${src}'></${selector}>`
    }
    return `<${selector}>${content}</${selector}>`
  }

  if (selector === 'link') {
    return `<${selector} rel="stylesheet" href='${src}' />`
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

  if (selector === 'pre') {
    const contentParsed = content
      .replace(/{/g, '&#123;')
      .replace(/}/g, '&#125;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\n/g, '<br />')
      .replace(/\s{2,}/g, ' ')
      .trim()

    return `<${selector}${attr}><code>${contentParsed}</code></${selector}>`
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
