const fs = require('fs')
const path = require('path')

const { version } = require('./package.json')

const DEFAULT_VARS = { lang: 'en', title: 'CSSX', description: 'Site generated with CSSX', generator: `CSSX v${version}` }

const currentDirectory = path.join(__dirname, 'src')

// if (fs.existsSync(path.join(__dirname, 'dist'))) {
//   fs.rmdirSync(path.join(__dirname, 'dist'), { recursive: true });
// }
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'))
}

fs.readdirSync(currentDirectory).forEach((file) => {
  if (path.extname(file) === '.cssx') {
    const inputFile = path.join(currentDirectory, file)
    const name = path.basename(file, '.cssx')
    const outputFile = path.join(__dirname, 'dist', `${name}.html`)
    generateHtmlFromCssx(inputFile, outputFile)
  }
})

function generateHtmlFromCssx (inputFile, outputFile) {
  const filename = path.basename(inputFile, '.cssx')

  const content = fs.readFileSync(inputFile, 'utf8')
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
      if (component.contentValue === '') return null
      const classAttribute = component.hash
        ? ` class="cssx-${component.hash}"`
        : ''
      const touchAction = component.touchAction
        ? (component.selector === 'a' ? ` href="${component.touchAction}"` : ` onclick="${component.touchAction}"`)
        : ''
      if (component.selector === 'script') {
        return `<${component.selector} type="module" src='${component.contentValue}'></${component.selector}>`
      }
      if (component.selector === 'img') {
        return `<${component.selector}${classAttribute}${touchAction} src='${component.contentValue}' />`
      }
      return `<${component.selector}${classAttribute}${touchAction}>${component.contentValue}</${component.selector}>`
    })
    .filter(Boolean)
    .join('\n')

  const varsJson = vars
  const { lang, title, description, generator } = { ...DEFAULT_VARS, ...varsJson }

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

  fs.writeFileSync(outputFile, htmlContent, 'utf8')

  console.log(`Generated ${filename}.html with CSSX`)
}

function processCssx (content) {
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
