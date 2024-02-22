import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

const packageJSON = JSON.parse(readFileSync('./package.json'))
const { version } = packageJSON

const DEFAULT_VARS = { lang: 'en', title: 'CSSX', description: 'Site generated with CSSX', generator: `CSSX v${version}` }

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
    generateHtmlFromCssx(inputFile, outputFile)
  }
})

export function generateHtmlFromCssx (inputFile, outputFile) {
  const filename = basename(inputFile, '.cssx')

  const content = readFileSync(inputFile, 'utf8')
  const { vars, components } = processCssx(content)

  if (components.length === 0) {
    console.log(`No components found in ${inputFile}`)
    return
  }

  const styles = components
    .map((component) => {
      const { hash, selector, styles } = component
      const className = hash ? `.cssx-${hash}` : ''
      if (!styles) return null
      return `${selector}${className} { ${styles} }`
    })
    .filter(Boolean)
    .join('\n')

  const body = components
    .map((component) => {
      const { hash, selector, contentValue, touchAction } = component

      if (contentValue === '') return null

      const classAttribute = hash
        ? ` class="cssx-${hash}"`
        : ''
      const actionAttribute = touchAction
        ? (selector === 'a' ? ` href="${touchAction}"` : ` onclick="${touchAction}"`)
        : ''
      if (selector === 'script') {
        return `<${selector} type="module" src='${contentValue}'></${selector}>`
      }
      if (selector === 'img') {
        return `<${selector}${classAttribute}${actionAttribute} src='${contentValue}' />`
      }
      return `<${selector}${classAttribute}${actionAttribute}>${contentValue}</${selector}>`
    })
    .filter(Boolean)
    .join('\n')

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

export function processCssx (content) {
  let vars = null
  const components = []
  content.replace(/([^{]+)\s*{\s*([^}]+)}/g, (match) => {
    const result = getVars(match)
    if (result && Object.keys(result).length > 0) {
      vars = result
    }

    const component = parseComponent(match)
    components.push(component)
  })
  return { vars, components }
}

function getVars (content) {
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

function parseComponent (content) {
  let selector = ''
  let styles = ''
  let contentValue = ''
  let touchAction = ''

  content.replace(
    /([^{]+)\s*{\s*([^}]+)}/g,
    (match, foundSelector, foundStyles) => {
      selector = foundSelector.trim()

      // remove attributes reserved for CSSX
      const reservedAttributes = ['content', 'touch-action', 'src']
      const stylesParsed = foundStyles
        .trim()
        .replace(
          new RegExp(`(${reservedAttributes.join('|')})\\s*:\\s*"[^"]+";`, 'g'),
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

  content.replace(/content:\s*"([^"]+)";/g, (match, found) => {
    contentValue = found.trim()
    return ''
  })

  content.replace(/src:\s*"([^"]+)";/g, (match, found) => {
    contentValue = found.trim()
    return ''
  })

  content.replace(/touch-action:\s*"([^"]+)";/g, (match, found) => {
    touchAction = found.trim()
    return ''
  })

  const hash = contentValue ? Math.random().toString(36).substring(7) : ''
  return { hash, selector, styles, contentValue, touchAction }
}
