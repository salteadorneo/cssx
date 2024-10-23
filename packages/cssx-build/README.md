# CSSX

Compile CSS as a programming language.

## Documentation

- [Getting Started](https://cssx.js.org/docs.html) - Learn how to get started with CSSX.
- [Reference](https://cssx.js.org/reference.html) - Learn about the CSSX syntax and features.

## Usage

Write your CSS in .cssx files in `src/pages` directory. Then run the following commands:

```bash
npx cssx-build
```

## Flags

- `--output` - Output directory for compiled CSS files. Default is `dist`.
- `--watch` - Watch for changes in the `src` directory and compile CSSX files to CSS.
- `--serve` - Serve the compiled CSS files on a local server.

## Structure

```
├── dist
    └── index.html
└── src
    └── pages
        └── index.cssx
```

This will compile your CSSX files to CSS in the `dist` directory.
