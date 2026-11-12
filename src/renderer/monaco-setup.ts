// Load Monaco from the bundled package instead of @monaco-editor/react's default
// CDN loader: the app's CSP (script-src 'self') blocks cdn.jsdelivr.net, which left
// the Files editor stuck on "Loading…". Workers are bundled by Vite (?worker).
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import { channelsToHex } from './monaco-theme'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === 'json') return new JsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
    if (label === 'typescript' || label === 'javascript') return new TsWorker()
    return new EditorWorker()
  }
}

loader.config({ monaco })

/** Editor theme built from the app tokens so the Files editor sits on the same ground as the panels. */
export function defineCogTheme(m: typeof monaco = monaco): void {
  const css = getComputedStyle(document.documentElement)
  const tok = (name: string): string | null => channelsToHex(css.getPropertyValue(`--${name}`))
  const colors: Record<string, string> = {}
  const set = (key: string, token: string): void => { const v = tok(token); if (v) colors[key] = v }
  set('editor.background', 'surface-sunk')
  set('editor.foreground', 'ink')
  set('editorLineNumber.foreground', 'ink-subtle')
  set('editorLineNumber.activeForeground', 'ink')
  set('editor.lineHighlightBackground', 'surface')
  set('editor.selectionBackground', 'surface-muted')
  set('editorCursor.foreground', 'focus')
  set('editorIndentGuide.background1', 'line')
  set('editorWidget.background', 'surface')
  set('editorWidget.border', 'line')
  // Brackets: quiet ink, then steel, then focus (Monaco's default pair colours are yellow/pink/blue).
  set('editorBracketHighlight.foreground1', 'ink-muted')
  set('editorBracketHighlight.foreground2', 'steel')
  set('editorBracketHighlight.foreground3', 'focus')

  // Syntax: the same five hues the panels use for meaning, so code reads on the app's palette.
  const rules: Array<{ token: string; foreground?: string; fontStyle?: string }> = []
  const rule = (tokens: string[], token: string, fontStyle?: string): void => {
    const v = tok(token)
    if (!v) return
    for (const t of tokens) rules.push({ token: t, foreground: v.slice(1), ...(fontStyle ? { fontStyle } : {}) })
  }
  rule(['keyword', 'storage', 'storage.type', 'keyword.control', 'keyword.operator.new'], 'steel')
  rule(['string', 'string.escape', 'string.key.json', 'string.value.json'], 'success')
  rule(['number', 'constant', 'constant.language', 'constant.numeric'], 'warning')
  rule(['comment', 'comment.doc'], 'ink-subtle', 'italic')
  rule(['type', 'type.identifier', 'entity.name.type', 'entity.name.function', 'support.function', 'function'], 'focus')
  rule(['delimiter', 'delimiter.bracket', 'delimiter.parenthesis', 'delimiter.square', 'delimiter.curly', 'delimiter.angle'], 'ink-muted')

  m.editor.defineTheme('cog', { base: 'vs-dark', inherit: true, rules, colors })
}
