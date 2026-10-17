import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StatusDetector } from '../../src/main/shell/status-detector'

describe('StatusDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in idle state', () => {
    const detector = new StatusDetector()
    expect(detector.status).toBe('idle')
  })

  it('transitions to working on data', () => {
    const detector = new StatusDetector()
    detector.onData('some output text')
    expect(detector.status).toBe('working')
  })

  it('transitions to active after prompt + silence', () => {
    const onChange = vi.fn()
    const detector = new StatusDetector({ promptRegex: />\s*$/, onChange })
    detector.onData('claude> ')
    expect(detector.status).toBe('working')

    vi.advanceTimersByTime(2500)
    expect(detector.status).toBe('active')
    expect(onChange).toHaveBeenCalledWith('active')
  })

  it('stays working if output continues after prompt-like text', () => {
    const detector = new StatusDetector({ promptRegex: />\s*$/ })
    detector.onData('value > 5 is valid')
    vi.advanceTimersByTime(1000)
    detector.onData('more output here')
    vi.advanceTimersByTime(2500)
    expect(detector.status).toBe('working')
  })

  it('strips ANSI codes before matching', () => {
    const onChange = vi.fn()
    const detector = new StatusDetector({ promptRegex: />\s*$/, onChange })
    detector.onData('\x1b[32mclaude>\x1b[0m ')
    vi.advanceTimersByTime(2500)
    expect(detector.status).toBe('active')
  })

  it('detects Codex prompt character U+203A', () => {
    const onChange = vi.fn()
    const detector = new StatusDetector({ onChange })
    detector.onData('\u203A ')
    vi.advanceTimersByTime(2500)
    expect(detector.status).toBe('active')
    expect(onChange).toHaveBeenCalledWith('active')
  })

  it('reaches active when the prompt line is followed by a status line in the same redraw (Claude Code TUI)', () => {
    const onChange = vi.fn()
    const detector = new StatusDetector({ onChange })
    detector.onData('❯ \n⏵⏵ bypass permissions on | worker-1 | ⎇ cog/worker-1 | ctx:8%')
    vi.advanceTimersByTime(2500)
    expect(detector.status).toBe('active')
    expect(onChange).toHaveBeenLastCalledWith('active')
  })

  it('remembers a prompt line seen in an earlier chunk when later chunks only repaint the status line', () => {
    const detector = new StatusDetector()
    detector.onData('❯ ')
    vi.advanceTimersByTime(500)
    detector.onData('Cooked for 19s · done 04:22')
    vi.advanceTimersByTime(2500)
    expect(detector.status).toBe('active')
  })

  it('treats cursor positioning as line breaks, so a repaint with the prompt mid-chunk still counts', () => {
    // Claude Code repaints with CUP/CHA moves instead of newlines: the prompt
    // and the status bar arrive as one "line" unless cursor moves are split on.
    const detector = new StatusDetector()
    detector.onData('\x1b[?25l\x1b[5;1H\x1b[2K❯ \x1b[6;1H⏵⏵ bypass permissions on (shift+tab to cycle)\x1b[7;1H▄ waiting | worker-1 | ctx:8%\x1b[?25h')
    vi.advanceTimersByTime(2500)
    expect(detector.status).toBe('active')
  })

  it('stays working when no prompt line is anywhere in the recent output', () => {
    const detector = new StatusDetector()
    for (let i = 0; i < 20; i++) detector.onData(`spinner frame ${i}\nstatus line ${i}`)
    vi.advanceTimersByTime(2500)
    expect(detector.status).toBe('working')
  })

  it('transitions to disconnected on exit', () => {
    const detector = new StatusDetector()
    detector.onExit()
    expect(detector.status).toBe('disconnected')
  })

  it('fires clear callback when /clear is followed by a fresh prompt', () => {
    const onClearDetected = vi.fn()
    const detector = new StatusDetector({ promptRegex: />\s*$/, onClearDetected })

    detector.onData('/clear\n')
    detector.onData('claude> ')
    vi.advanceTimersByTime(2500)

    expect(onClearDetected).toHaveBeenCalledTimes(1)
    expect(detector.status).toBe('active')
  })

  it("does not fire clear callback when /clear appears without a fresh prompt", () => {
    const onClearDetected = vi.fn()
    const detector = new StatusDetector({ promptRegex: />\s*$/, onClearDetected })

    detector.onData('/clear\n')
    detector.onData('normal output after clear')
    vi.advanceTimersByTime(2500)

    expect(onClearDetected).not.toHaveBeenCalled()
    expect(detector.status).toBe('working')
  })
})
