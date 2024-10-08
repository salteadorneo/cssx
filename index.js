import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import postcss from 'postcss'

const packageJSON = JSON.parse(readFileSync('./package.json'))
const { version } = packageJSON

export const globals = {
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

    const htmlContent = transpileCSSX(content)

    const name = basename(file, '.cssx')
    const outputFile = join(__dirname, buildDir, `${name}.html`)
    writeFileSync(outputFile, htmlContent, 'utf8')

    console.log(`Generated ${name}.html with CSSX`)
  }
})
console.log(`Build completed in /${buildDir} directory`)

function generateHash (selector) {
  return btoa(selector + Date.now()).replace(/=/g, '').substring(0, 8)
}

function processCSSX (node, styles = [], classMappings = {}) {
  let body = ''

  if (node.type === 'root') {
    node.nodes.forEach(childNode => {
      body += processCSSX(childNode, styles, classMappings)
    })
  } else if (node.type === 'rule') {
    if (node.selector === ':root') {
      node.walkDecls(({ prop, value }) => {
        globals[prop.replace('--', '')] = value.replace(/['"]/g, '')
      })
      return body
    }
    const elementTag = node.selector

    const props = {}

    const className = generateHash(elementTag + Math.random())
    props.class = className

    let elementStyles = ''
    node.walkDecls(decl => {
      if (decl.parent.selector === elementTag) {
        if (decl.prop.startsWith('--')) {
          props[decl.prop.replace('--', '')] = decl.value.replace(/['"]/g, '')
        } else {
          elementStyles += `${decl.prop}: ${decl.value};\n`
        }
      }
    })

    if (elementStyles) {
      styles.push(`${elementTag}.${className} {\n${elementStyles}}`)
      classMappings[elementTag] = className
    }

    const propsParser = (props) => {
      return Object.keys(props).reduce((acc, key) => {
        if (key === 'content') {
          return acc
        }
        return `${acc} ${key}="${props[key]}"`
      }, '')
    }

    body += `<${elementTag}${propsParser(props)}>`

    if (elementTag === 'pre') {
      props.content = props.content
        .replace(/{/g, '&#123;')
        .replace(/}/g, '&#125;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\\n/g, '<br />')
        .replace(/\s{2,}/g, ' ')
        .trim()
    }

    body += props.content || ''

    node.nodes.forEach(childNode => {
      body += processCSSX(childNode, styles, classMappings)
    })

    body += `</${elementTag}>\n`
  }

  return body
}

export function transpileCSSX (code) {
  const root = postcss.parse(code)

  const styles = []

  const body = processCSSX(root, styles)

  const { lang, title, description, generator } = { ...globals }

  let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description}" />`

  if (generator) {
    html += `\n<meta name="generator" content="${generator}" />`
  }

  if (styles.length > 0) {
    html += '<style>\n' + styles.join('\n') + '</style>\n'
  }

  html += `</head>
${body}</html>`

  return html
}
