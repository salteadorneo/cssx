import { readFileSync } from 'fs'
import { join, extname } from 'path'

import postcss from 'postcss'
import cssvariables from 'postcss-css-variables'

import MarkdownIt from 'markdown-it'
const md = new MarkdownIt({
  html: true,
  breaks: true,
  xhtmlOut: true
})
md.renderer.rules.paragraph_open = () => ''
md.renderer.rules.paragraph_close = () => ''

const packageJSON = JSON.parse(readFileSync('./package.json'))
const { version } = packageJSON

export const globals = {
  lang: 'en',
  icon: 'favicon.svg',
  title: 'CSSX',
  description: 'Site generated with CSSX',
  generator: `CSSX v${version}`,
  transition: false
}

function generateHash (selector) {
  return btoa(selector).replace(/=/g, '').substring(0, 8)
}

function processCSSX (node, styles = [], variables = {}) {
  let body = ''

  if (node.type === 'root') {
    node.nodes.forEach(childNode => {
      body += processCSSX(childNode, styles, variables)
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

    const className = `cssx-${generateHash(elementTag + node.source?.start.line)}`
    props.class = className

    let elementStyles = ''
    let bodyImport = ''
    const subelementStyles = {}

    const elementVars = { ...variables }

    let exit = false
    node.walkDecls(decl => {
      if (exit) return
      if (decl.parent.selector === elementTag) {
        if (decl.prop.startsWith('--')) {
          if (decl.prop === '--import') {
            try {
              const importFile = decl.value.replace(/['"]/g, '')
              const importContent = readFileSync(join(process.cwd(), 'src/pages', importFile), 'utf8')
              if (extname(importFile) === '.cssx') {
                const importRoot = postcss.parse(processCSS(importContent))
                bodyImport = processCSSX(importRoot, styles, elementVars)
              } else {
                bodyImport = importContent
              }
            } catch (err) {
              console.error(`Error: ${err.message}`)
            }
          } else {
            elementVars[decl.prop] = decl.value
            props[decl.prop.replace('--', '')] = decl.value.replace(/^["']|["']$/g, '')
          }
        } else {
          if (decl.parent.selector.startsWith('&')) {
            const adjustedSelector = decl.parent.selector
            subelementStyles[adjustedSelector] = (subelementStyles[adjustedSelector] || '') + `${decl.prop}: ${decl.value};`
          } else {
            if (decl.prop === 'content') {
              const value = decl.value.replace(/var\((--\w+)\)/g, (_, key) => {
                return elementVars[key] || decl.value
              })
              props[decl.prop] = elementTag !== 'code' ? md.render(value.replace(/^["']|["']$/g, '')) : value.replace(/^["']|["']$/g, '')
              return
            }
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
      body += processCSSX(childNode, styles, variables)
    })

    if (!elementTag.startsWith('&')) {
      body += `</${elementTag}>\n`
    }
  }

  return body
}

export function transpileCSSX (code) {
  const root = postcss.parse(processCSS(code))

  const styles = []

  let body = processCSSX(root, styles)

  const { lang, icon, title, description, generator, transition } = { ...globals }

  let html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="icon" href="${icon}" />
<title>${title}</title>
<meta name="description" content="${description}" />`

  if (generator) {
    html += `\n<meta name="generator" content="${generator}" />`
  }

  if (transition) {
    styles.push('@view-transition { navigation: auto; }')
  }

  if (styles.length > 0) {
    html += `\n<style>\n${styles.join('\n')}</style>`
  }

  if (!body.startsWith('<body>')) {
    body = `<body>${body}</body>`
  }

  html += `\n</head>\n${body}\n</html>`

  return html
}

function processCSS (code) {
  return postcss([
    cssvariables({
      preserve: true,
      preserveAtRulesOrder: true
    })
  ]).process(code).css
}
