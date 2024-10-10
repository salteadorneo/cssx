import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join, extname, basename, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import postcss from 'postcss'

import { createServer } from 'http'
import { readFile } from 'fs/promises'

const packageJSON = JSON.parse(readFileSync('./package.json'))
const { version } = packageJSON

export const globals = {
  lang: 'en',
  icon: 'favicon.svg',
  title: 'CSSX',
  description: 'Site generated with CSSX',
  generator: `CSSX v${version}`
}

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

const __dirname = dirname(fileURLToPath(import.meta.url))

if (existsSync(join(__dirname, buildDir))) {
  readdirSync(join(__dirname, buildDir)).forEach((file) => {
    unlinkSync(join(__dirname, buildDir, file))
  })
} else {
  mkdirSync(join(__dirname, buildDir))
}

try {
  const publicDirectory = join(__dirname, 'public')
  readdirSync(publicDirectory).forEach((file) => {
    const inputFile = join(publicDirectory, file)
    const outputFile = join(__dirname, buildDir, file)
    writeFileSync(outputFile, readFileSync(inputFile))
  })
} catch (err) {
  console.log('No public directory found')
}

const pagesDirectory = join(__dirname, 'src/pages')
readdirSync(pagesDirectory).forEach((file) => {
  if (extname(file) === '.cssx') {
    const inputFile = join(pagesDirectory, file)
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
  return btoa(selector).replace(/=/g, '').substring(0, 8)
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

    const className = `cssx-${generateHash(elementTag + Math.random())}`
    props.class = className

    let elementStyles = ''
    let bodyImport = ''
    const subelementStyles = {}

    let exit = false
    node.walkDecls(decl => {
      if (exit) return
      if (decl.parent.selector === elementTag) {
        if (decl.prop.startsWith('--')) {
          if (decl.prop === '--import') {
            const importFile = decl.value.replace(/['"]/g, '')
            const importContent = readFileSync(join(pagesDirectory, importFile), 'utf8')
            if (extname(importFile) === '.cssx') {
              const importRoot = postcss.parse(importContent)
              bodyImport = processCSSX(importRoot, styles, classMappings)
            } else {
              bodyImport = importContent
            }
          } else {
            props[decl.prop.replace('--', '')] = decl.value.replace(/['"]/g, '')
          }
        } else {
          if (decl.parent.selector.startsWith('&')) {
            const adjustedSelector = decl.parent.selector
            subelementStyles[adjustedSelector] = (subelementStyles[adjustedSelector] || '') + `${decl.prop}: ${decl.value};`
          } else {
            elementStyles += `${decl.prop}: ${decl.value};\n`
          }
        }
      } else {
        exit = true
      }
    })

    if (elementStyles) {
      const substyles = Object.keys(subelementStyles).map(key => {
        return `${key} {\n${subelementStyles[key]}\n}`
      }).join('\n')

      styles.push(`${elementTag}.${className} {\n${elementStyles}${substyles}}`)
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

    if (!elementTag.startsWith('&')) {
      body += `<${elementTag}${propsParser(props)}>`
    }

    if (bodyImport) {
      body += bodyImport
    }

    if (elementTag === 'code') {
      props.content = props.content.split('\n').map(line => {
        if (line.trimEnd().endsWith('\\')) {
          return line.trimEnd().slice(0, -1)
        }
        return line
      }).join('\n')
    }

    body += props.content || ''

    node.nodes.forEach(childNode => {
      body += processCSSX(childNode, styles, classMappings)
    })

    if (!elementTag.startsWith('&')) {
      body += `</${elementTag}>\n`
    }
  }

  return body
}

export function transpileCSSX (code) {
  const root = postcss.parse(code)

  const styles = []

  const body = processCSSX(root, styles)

  const { lang, icon, title, description, generator } = { ...globals }

  let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="icon" href="${icon}">
<title>${title}</title>
<meta name="description" content="${description}" />`

  if (generator) {
    html += `\n<meta name="generator" content="${generator}" />`
  }

  if (styles.length > 0) {
    html += '<style>\n' + styles.join('\n') + '</style>'
  }

  html += `\n</head>\n${body}\n</html>`

  return html
}

const server = createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url
  const path = resolve(__dirname, buildDir, `.${url}`)

  try {
    const data = await readFile(path)
    res.end(data)
  } catch (err) {
    res.statusCode = 404
    res.end('Not Found')
  }
})

if (args.includes('--serve')) {
  server.listen(3000, () => {
    console.log('Server running at http://localhost:3000/')
  })
}
