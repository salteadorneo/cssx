#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync, watch } from 'fs'
import { join, extname, basename } from 'path'

import { Command } from 'commander'

import { transpileCSSX } from './core.js'

const packageJSON = JSON.parse(readFileSync('./package.json'))
const { version } = packageJSON

const program = new Command()
program
  .version(version)
  .option('-h, --help', 'Show help')
  .option('-o, --output <dir>', 'Specify output directory', 'dist')
  .option('--serve', 'Start a local server')
  .option('--watch', 'Watch for file changes and rebuild automatically')
  .parse(process.argv)

const options = program.opts()

const srcDir = join(process.cwd(), 'src')
const pagesDir = join(process.cwd(), 'src', 'pages')
const publicDir = join(process.cwd(), 'public')
const buildDir = join(process.cwd(), options.output)

if (options.help) {
  console.log(`CSSX v${version}`)
  console.log('Usage: cssx-build [options]')
  console.log('Options:')
  console.log('  -o, --output=dist   Output directory')
  console.log('  --serve             Start a local server')
  console.log('  --watch             Watch for file changes and rebuild automatically')
  console.log('  --help              Show help')
  console.log('  --version           Show version number')
  console.log('Examples:')
  console.log('  cssx-build --output=dist')
  process.exit(0)
}

function setupBuildDirectory (buildDir) {
  if (existsSync(buildDir)) {
    readdirSync(buildDir).forEach((file) => unlinkSync(join(buildDir, file)))
  } else {
    mkdirSync(buildDir)
  }
}

function copyPublicDirectory (buildDir) {
  if (existsSync(publicDir)) {
    readdirSync(publicDir).forEach((file) => {
      const inputFile = join(publicDir, file)
      const outputFile = join(buildDir, file)
      writeFileSync(outputFile, readFileSync(inputFile))
    })
  } else {
    console.log('No public directory found')
  }
}

function processCSSXFiles (buildDir) {
  if (existsSync(pagesDir)) {
    readdirSync(pagesDir).forEach((file) => {
      if (extname(file) === '.cssx') {
        const inputFile = join(pagesDir, file)
        const content = readFileSync(inputFile, 'utf8')
        const htmlContent = transpileCSSX(content)

        const name = basename(file, '.cssx')
        const outputFile = join(buildDir, `${name}.html`)
        writeFileSync(outputFile, htmlContent, 'utf8')
        console.log(`Generated ${name}.html with CSSX`)
      }
    })
  } else {
    console.error(`${pagesDir} directory not found`)
  }
}

setupBuildDirectory(buildDir)
copyPublicDirectory(buildDir)
processCSSXFiles(buildDir)
console.log(`Build completed in ${buildDir} directory`)

if (options.serve && options.watch) {
  import('servor').then(async (servorModule) => {
    const servor = servorModule.default

    try {
      const instance = await servor({
        root: 'dist',
        static: true,
        reload: true,
        port: 3000
      })

      console.log('\n🌎 Dev server running at http://localhost:3000')
      console.log('📡 Live reload enabled')

      if (options.watch) {
        console.log('\n👀 Watching for changes...')
        console.log(`📁 Directory: ${pagesDir}`)

        let isProcessing = false

        const rebuild = async (filename) => {
          if (isProcessing) return

          try {
            isProcessing = true
            console.log(`\n🔄 Rebuilding due to changes in ${filename}`)

            setupBuildDirectory(buildDir)
            copyPublicDirectory(buildDir)
            processCSSXFiles(buildDir)

            console.log('✨ Build completed')
          } catch (error) {
            console.error('❌ Build failed:', error)
          } finally {
            isProcessing = false
          }
        }

        const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
          if (filename && filename.endsWith('.cssx')) {
            console.log(`\n📝 ${eventType === 'change' ? 'Modified' : 'Changed'}: ${filename}`)
            rebuild(filename)
          }
        })

        const cleanup = () => {
          console.log('\n👋 Stopping server and watch mode...')
          watcher.close()
          instance.close()
          process.exit(0)
        }

        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)

        console.log('\n🚀 Doing initial build...')
        rebuild('initial build')
      }
    } catch (err) {
      console.error('❌ Failed to start server:', err)
      process.exit(1)
    }
  }).catch(err => {
    console.error('❌ Failed to import servor:', err)
    process.exit(1)
  })
}

if (options.watch) {
  console.log('\n👀 Watching for changes...')
  console.log(`📁 Directory: ${pagesDir}`)

  let isProcessing = false

  const rebuild = async (filename) => {
    if (isProcessing) return

    try {
      isProcessing = true
      console.log(`\n🔄 Rebuilding due to changes in ${filename}`)

      setupBuildDirectory(buildDir)
      copyPublicDirectory(buildDir)
      processCSSXFiles(buildDir)

      console.log('✨ Build completed')
    } catch (error) {
      console.error('❌ Build failed:', error)
    } finally {
      isProcessing = false
    }
  }

  const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.cssx')) {
      console.log(`\n📝 ${eventType === 'change' ? 'Modified' : 'Changed'}: ${filename}`)
      rebuild(filename)
    }
  })

  const cleanup = () => {
    console.log('\n👋 Stopping server and watch mode...')
    watcher.close()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  console.log('\n🚀 Doing initial build...')
  rebuild('initial build')
}
