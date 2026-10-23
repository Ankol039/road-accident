/**
 * Converts a returned HTML mockup back into a reviewable JSX file.
 *
 * This is a review helper, not a code generator you ship. It keeps the layout
 * and static markup, translates the mockup annotations into JSX, and lists
 * everything it could not work out in a `.report.md` next to the output. State,
 * event handlers, data fetching and router wiring stay a manual integration
 * step.
 *
 * USAGE
 *   npm run mock:convert -- --in html-mockups/_screens/reports/index.html
 *   npm run mock:convert -- \
 *     --in html-mockups/_screens/reports/index.html \
 *     --out src/pages/Reports.mock.jsx \
 *     --component ReportsView \
 *     --router
 *
 * Options
 *   --in <file>          returned mockup (required)
 *   --out <file>         JSX destination (default: <screen>.mock.jsx beside input)
 *   --component <Name>   exported component name (default: <Screen>Mock)
 *   --router             use react-router <Link to="..."> for data-rr-href links
 *   --check              exit non-zero when the report contains warnings
 *   --force              overwrite an existing .mock.jsx output
 *
 * The converter refuses to overwrite a file that is not named `*.mock.jsx`
 * unless --force is passed. Real pages are never overwritten by accident.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, resolve, relative } from 'node:path'
import { parse } from 'node-html-parser'
import prettier from 'prettier'

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const BOOLEAN_ATTRS = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
])

const ATTR_ALIASES = {
  class: 'className',
  for: 'htmlFor',
  charset: 'charSet',
  crossorigin: 'crossOrigin',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  colspan: 'colSpan',
  contenteditable: 'contentEditable',
  enctype: 'encType',
  formaction: 'formAction',
  frameborder: 'frameBorder',
  hreflang: 'hrefLang',
  inputmode: 'inputMode',
  maxlength: 'maxLength',
  minlength: 'minLength',
  novalidate: 'noValidate',
  playsinline: 'playsInline',
  readonly: 'readOnly',
  rowspan: 'rowSpan',
  spellcheck: 'spellCheck',
  srcset: 'srcSet',
  tabindex: 'tabIndex',
  usemap: 'useMap',
}

const DROP_ATTRS = new Set([
  'data-component',
  'data-if',
  'data-key',
  'data-repeat',
  'data-rr-component',
  'data-rr-href',
  'data-rr-region',
  'data-rr-repeat',
  'data-rr-screen',
  'data-rr-source',
  'data-rr-static',
  'data-status',
  'data-user-name',
])

const warnings = []
const usedComponents = new Set()
const usedRouter = { value: false }
const usedMockAssets = { value: false }

/* ---------------------------------------------------------------- *
 * CLI
 * ---------------------------------------------------------------- */
const argv = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1] ?? fallback
}
const has = (name) => argv.includes(`--${name}`)

const input = arg('in')
if (!input) {
  console.error('Missing --in <file>. Run with --help for usage.')
  process.exit(1)
}
const inputPath = resolve(process.cwd(), input)
if (!existsSync(inputPath)) {
  console.error(`No such file: ${inputPath}`)
  process.exit(1)
}
const ROOT = process.cwd()
const MOCK_DIR = dirname(inputPath)

const screenId = basename(dirname(inputPath)) || 'screen'
const defaultOut = resolve(dirname(inputPath), `${screenId}.mock.jsx`)
const outputPath = resolve(process.cwd(), arg('out', defaultOut))
const rawComponentName = arg('component', `${pascal(screenId)}Mock`)
let componentName = rawComponentName
if (!/^[A-Z][A-Za-z0-9]*$/.test(componentName)) {
  componentName = pascal(componentName)
  warn(`Sanitised --component "${rawComponentName}" to "${componentName}".`)
}
const useRouter = has('router')
const checkOnly = has('check')
const force = has('force')

/* ---------------------------------------------------------------- *
 * Helpers
 * ---------------------------------------------------------------- */
function pascal(value) {
  return String(value)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}

function warn(message) {
  warnings.push(message)
}

function extractExpression(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^\s*\{\{\s*([\s\S]*?)\s*\}\}\s*$/)
  return match ? match[1].trim() : null
}

function escapeLiteral(text) {
  return text
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Turn "Total {{ n }} reports" into `Total {n} reports`. */
function convertText(raw) {
  if (!raw) return ''
  const parts = []
  let last = 0
  const pattern = /\{\{\s*([\s\S]*?)\s*\}\}/g
  let match
  while ((match = pattern.exec(raw))) {
    if (match.index > last) parts.push(escapeLiteral(raw.slice(last, match.index)))
    parts.push(`{${match[1].trim()}}`)
    last = pattern.lastIndex
  }
  if (last < raw.length) parts.push(escapeLiteral(raw.slice(last)))
  return parts.join('')
}

function convertAttrValue(value) {
  const expression = extractExpression(value)
  if (expression) return `{${expression}}`

  if (value.includes('{{')) {
    const template = convertText(value)
      .replace(/\{([^{}]+)\}/g, '${$1}')
      .replace(/`/g, '\\`')
    return `{` + '`' + template + '`' + `}`
  }

  return JSON.stringify(value)
}

function convertStyle(value) {
  const declarations = []
  for (const chunk of value.split(';')) {
    const text = chunk.trim()
    if (!text) continue
    const index = text.indexOf(':')
    if (index === -1) continue
    const rawName = text.slice(0, index).trim()
    const rawValue = text.slice(index + 1).trim()
    if (!rawName) continue

    let name = rawName
    if (!name.startsWith('--')) {
      name = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      if (name.startsWith('-')) name = name.slice(1)
      if (name.startsWith('ms')) name = 'ms' + name.slice(2)
    }

    const expression = extractExpression(rawValue)
    const renderedValue = expression ? expression : JSON.stringify(rawValue)
    declarations.push(`${name.startsWith('--') ? `'${name}'` : name}: ${renderedValue}`)
  }

  if (!declarations.length) return null
  return `{{ ${declarations.join(', ')} }}`
}

function convertAttributeName(name) {
  if (name.startsWith('data-') || name.startsWith('aria-')) return name
  if (ATTR_ALIASES[name]) return ATTR_ALIASES[name]

  /* Generic SVG/HTML hyphenated attributes: stroke-width -> strokeWidth. */
  if (name.includes('-')) {
    return name
      .split('-')
      .map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1)))
      .join('')
  }
  return name
}

function stripExpression(value) {
  const expression = extractExpression(value)
  return expression ?? value
}

/**
 * Charts, maps and the photo placeholder live beside the mockup, outside src/.
 * Point them at a dev-server URL so the JSX can be pasted anywhere for review.
 * They are mockup-only and must be replaced before shipping.
 */
function rewriteLocalAsset(value) {
  if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value) || value.startsWith('/')) return value
  if (!/^(?:\.{0,2}\/)?assets\//.test(value) && !value.startsWith('../')) return value

  const absolute = resolve(MOCK_DIR, value)
  if (!existsSync(absolute)) {
    warn(`Static asset not found next to the mockup: ${value}`)
    return value
  }
  const relativePath = relative(ROOT, absolute)
  if (relativePath.startsWith('..')) return value

  usedMockAssets.value = true
  return '/' + relativePath.split(/[\\/]/).join('/')
}

function convertAttributes(node, { skip = new Set(), extra = [] } = {}) {
  const attrs = []
  for (const [name, value] of Object.entries(node.attributes || {})) {
    if (skip.has(name) || DROP_ATTRS.has(name)) continue
    if (name.startsWith('on') && !['one', 'only'].includes(name)) {
      warn(`Dropped inline event handler ${name} on <${node.rawTagName}>; re-wire it in React.`)
      continue
    }
    if (name === 'style') {
      const style = convertStyle(value)
      if (style) attrs.push(`style=${style}`)
      continue
    }

    const jsxName = convertAttributeName(name)
    const jsxValue = ['src', 'poster'].includes(name) ? rewriteLocalAsset(value) : value
    if (BOOLEAN_ATTRS.has(name)) {
      attrs.push(jsxValue === 'false' ? `${jsxName}={false}` : jsxName)
      continue
    }
    attrs.push(`${jsxName}=${convertAttrValue(jsxValue)}`)
  }
  return [...attrs, ...extra]
}

function serializeChildren(node) {
  const children = []
  for (const child of node.childNodes || []) {
    if (child.nodeType === 3) {
      if (!child.rawText || !child.rawText.trim()) continue
      children.push(convertText(child.rawText.replace(/\s+/g, ' ')))
      continue
    }
    if (child.nodeType === 8) {
      const comment = child.rawText.trim()
      if (comment) children.push(`{/* ${comment} */}`)
      continue
    }
    if (child.nodeType !== 1) continue
    const rendered = serializeElement(child)
    if (rendered) children.push(rendered)
  }
  return children.join('')
}

function componentFor(node) {
  const name = node.getAttribute('data-component') || node.getAttribute('data-rr-component')
  return name || null
}

function serializeComponent(node, name) {
  usedComponents.add(name)

  if (name === 'StatusBadge') {
    const status = node.getAttribute('data-status')
    if (!status) {
      warn('StatusBadge without data-status; defaulted to "submitted".')
      return '<StatusBadge status="submitted" />'
    }
    return `<StatusBadge status=${convertAttrValue(status)} />`
  }

  if (name === 'Brand') {
    const attrs = convertAttributes(node, { skip: new Set(['data-component', 'data-rr-component']) })
    return `<Brand${attrs.length ? ' ' + attrs.join(' ') : ''} />`
  }

  if (name === 'Link') {
    usedRouter.value = true
    const to = node.getAttribute('data-to') || node.getAttribute('data-rr-href') || node.getAttribute('href')
    const attrs = convertAttributes(node, { skip: new Set(['data-to', 'href']) })
    return `<Link to=${convertAttrValue(to || '#')}${attrs.length ? ' ' + attrs.join(' ') : ''}>${serializeChildren(node)}</Link>`
  }

  warn(`Unknown data-component "${name}" on <${node.rawTagName}>; left as plain markup.`)
  return null
}

function serializeElement(node) {
  const tag = (node.rawTagName || '').toLowerCase()

  if (['script', 'style', 'noscript', 'template'].includes(tag)) {
    warn(`Dropped <${tag}> element from the mockup.`)
    return ''
  }

  const component = componentFor(node)
  if (component) {
    const rendered = serializeComponent(node, component)
    if (rendered) return rendered
  }

  const repeat = node.getAttribute('data-repeat')
  const condition = node.getAttribute('data-if')
  const key = node.getAttribute('data-key')

  let element = serializePlainElement(node, tag, { repeat, key })

  if (repeat) {
    const expression = repeatExpression(repeat, element, key)
    if (expression) {
      element = condition ? `{${stripExpression(condition)} && (${expression})}` : `{${expression}}`
    } else if (condition) {
      element = `{${stripExpression(condition)} && (${element})}`
    }
  } else if (condition) {
    element = `{${stripExpression(condition)} && (${element})}`
  }

  return element
}

function repeatExpression(spec, element, key) {
  const match = spec.trim().match(/^(.+?)\s+in\s+(.+)$/)
  if (!match) {
    warn(`Could not parse data-repeat="${spec}"; expected "item in items".`)
    return null
  }
  const params = match[1].trim()
  const collection = match[2].trim()
  if (!/^\(?[\w\s,]+\)?$/.test(params)) {
    warn(`Unusual data-repeat parameters "${params}"; left inline.`)
  }
  return `${collection}.map((${params}) => (${element}))`
}

function serializePlainElement(node, tag, { repeat, key } = {}) {
  const skip = new Set()
  if (repeat) skip.add('data-repeat').add('data-rr-repeat')
  if (key) skip.add('data-key')

  const extra = []
  if (repeat && key) extra.push(`key={${stripExpression(key)}}`)

  /* Links keep the real SPA route in data-rr-href. */
  const rrHref = node.getAttribute('data-rr-href')
  if (tag === 'a' && rrHref) {
    skip.add('href')
    if (useRouter) {
      skip.add('data-rr-href')
      usedRouter.value = true
      return serializeWithTag(node, 'Link', { skip, extra: [`to=${convertAttrValue(rrHref)}`, ...extra] })
    }
    extra.push(`href=${convertAttrValue(rrHref)}`)
  }

  const attrs = convertAttributes(node, { skip, extra })
  const attrText = attrs.length ? ' ' + attrs.join(' ') : ''
  const children = serializeChildren(node)
  const voidTag = VOID_TAGS.has(tag)

  if (voidTag) {
    if (children.trim()) warn(`<${tag}> is a void element but had children; children were dropped.`)
    return `<${tag}${attrText} />`
  }

  if (!children) return `<${tag}${attrText} />`
  return `<${tag}${attrText}>${children}</${tag}>`
}

function serializeWithTag(node, tag, { skip, extra }) {
  const attrs = convertAttributes(node, { skip, extra })
  const attrText = attrs.length ? ' ' + attrs.join(' ') : ''
  return `<${tag}${attrText}>${serializeChildren(node)}</${tag}>`
}

/* ---------------------------------------------------------------- *
 * Parse and convert
 * ---------------------------------------------------------------- */
const source = readFileSync(inputPath, 'utf8')
const root = parse(source, { comment: true, blockTextElements: { script: true, style: true } })

const mockRoot = root.querySelector('#mock-root')
const scaffold = mockRoot || root.querySelector('body') || root
const markup = serializeChildren(scaffold)

if (!markup.trim()) {
  console.error('Nothing to convert: #mock-root/body is empty.')
  process.exit(1)
}

const imports = []
if (usedRouter.value) imports.push(`import { Link } from 'react-router-dom'`)
for (const name of [...usedComponents].sort()) {
  if (name === 'Link') continue
  imports.push(`import ${name} from '../components/${name}'`)
}

const header = `/**
 * Generated from ${relative(process.cwd(), inputPath)}
 *
 * This file is a REVIEW HELPER, not a finished page. Re-attach state, effects,
 * handlers and data before integrating. Check the matching .report.md for
 * anything the converter could not translate.
 *
 * Mockup edits belong in the HTML; the real page remains the source of truth.
 */`

const jsx = `${header}
${imports.length ? imports.join('\n') + '\n' : ''}
export default function ${componentName}() {
  return (
    <>
${indent(markup, 6)}
    </>
  )
}
`

let formatted = jsx
try {
  formatted = await prettier.format(jsx, {
    parser: 'babel',
    printWidth: 100,
    singleQuote: true,
    semi: false,
  })
} catch (error) {
  warn(`Prettier could not format the result (${error.message}); wrote the raw conversion.`)
}

/* ---------------------------------------------------------------- *
 * Report
 * ---------------------------------------------------------------- */
const report = buildReport()
const reportPath = outputPath.replace(/\.jsx$/, '.report.md')

if (!checkOnly) {
  if (existsSync(outputPath) && !force) {
    console.error(`Refusing to overwrite ${relative(process.cwd(), outputPath)}. Pass --force.`)
    process.exit(1)
  }
  if (!/\.mock\.jsx$/.test(outputPath) && existsSync(outputPath) && !force) {
    console.error(`Refusing to overwrite a real page (${relative(process.cwd(), outputPath)}).`)
    process.exit(1)
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, formatted)
  writeFileSync(reportPath, report)
  console.log(`Wrote ${relative(process.cwd(), outputPath)}`)
  console.log(`Wrote ${relative(process.cwd(), reportPath)}`)
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`)
  for (const item of warnings) console.log(`  - ${item}`)
} else {
  console.log('\nNo warnings.')
}

if (checkOnly && warnings.length) process.exit(1)

/* ---------------------------------------------------------------- *
 * Report builder
 * ---------------------------------------------------------------- */
function buildReport() {
  const lines = [
    `# Conversion report`,
    '',
    `- Input: \`${relative(process.cwd(), inputPath)}\``,
    `- Output: \`${relative(process.cwd(), outputPath)}\``,
    `- Component: \`${componentName}\``,
    `- Router links: ${useRouter ? 'yes (`<Link to>`)' : 'no (`<a href>`)'}`,
    `- Generated: ${new Date().toISOString()}`,
    '',
    '## Detected components',
    '',
  ]

  if (usedComponents.size) {
    for (const name of [...usedComponents].sort()) lines.push(`- \`${name}\``)
  } else {
    lines.push('_None. All markup was converted inline._')
  }

  lines.push('', '## Warnings', '')
  if (warnings.length) {
    warnings.forEach((item) => lines.push(`- ${item}`))
  } else {
    lines.push('_None._')
  }

  if (usedMockAssets.value) {
    lines.push(
      '',
      '## Mockup-only assets',
      '',
      'Chart/map screenshots and the photo placeholder are served from `html-mockups/`.',
      'They are review aids only: replace them with real chart/map components and photos before shipping.',
    )
  }

  lines.push(
    '',
    '## Manual integration checklist',
    '',
    '- [ ] Move the JSX into the real page (keep this file as a reference, then delete it).',
    '- [ ] Re-attach state, effects, handlers and Firestore/service calls.',
    '- [ ] Replace static sample text with the real data bindings.',
    '- [ ] Replace mockup chart/map images and the photo placeholder.',
    '- [ ] Fix component import paths.',
    '- [ ] Run `npm run check:browser` and compare against the PNG previews.',
    '- [ ] Check 1440, 1024, 768 and 390 px, keyboard focus and reduced motion.',
    '',
  )
  return lines.join('\n')
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n')
}
