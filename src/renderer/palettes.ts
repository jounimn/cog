// Terminal colour palettes. Base colours come from the --pal-* tokens of the
// Drafting board identity; this and themes.ts are the only files with hex literals.
import type { PaletteId } from './terminal-appearance'

export interface Palette {
  id: PaletteId
  label: string
  bg: string
  fg: string
  cursor: string
  /** fg at ~25% over bg, pre-mixed */
  selection: string
  /** 16 entries: black..white then brightBlack..brightWhite */
  ansi: string[]
}

export const PALETTES: Palette[] = [
  {
    id: 'graphite',
    label: 'Graphite',
    bg: '#10151e',
    fg: '#d8e0ea',
    cursor: '#80aedc',
    selection: '#424851',
    ansi: [
      '#3b3f47', '#f47066', '#7acc98', '#e8c05c', '#80aedc', '#be96dc', '#78c8d2', '#b0b7c1',
      '#5c6066', '#f68a82', '#92d5ab', '#eccb79', '#97bde2', '#caa9e2', '#90d2da', '#d8e0ea'
    ]
  },
  {
    id: 'paper',
    label: 'Paper',
    bg: '#f4f1ea',
    fg: '#262a32',
    cursor: '#1e589c',
    selection: '#c1bfbc',
    ansi: [
      '#3d3c3b', '#b02626', '#1a7442', '#8c5c00', '#1e589c', '#783c96', '#0a6a78', '#585e6a',
      '#585e6a', '#8d1e1e', '#155d35', '#704a00', '#18467d', '#603078', '#085560', '#262a32'
    ]
  },
  {
    id: 'phosphor',
    label: 'Phosphor',
    bg: '#070e09',
    fg: '#8cec96',
    cursor: '#c4ffb8',
    selection: '#28462c',
    ansi: [
      '#343935', '#ff7c68', '#8cec96', '#dee878', '#78bef0', '#c8aaf0', '#78e2d0', '#71c07a',
      '#565b58', '#ff9483', '#a1efa9', '#e4ec90', '#90caf3', '#d2b9f3', '#90e7d8', '#8cec96'
    ]
  },
  {
    id: 'harbor',
    label: 'Harbor',
    bg: '#0d1e2d',
    fg: '#d4e6f0',
    cursor: '#70cce0',
    selection: '#3f505e',
    ansi: [
      '#394753', '#fa847a', '#7ad4ac', '#f0ca70', '#78acf0', '#baa0e8', '#70cce0', '#acbec9',
      '#5a6670', '#fb9a92', '#92dcbb', '#f3d48a', '#90bbf3', '#c6b1ec', '#8ad5e6', '#d4e6f0'
    ]
  },
  {
    id: 'ember',
    label: 'Ember',
    bg: '#1e1410',
    fg: '#f0deca',
    cursor: '#f2a460',
    selection: '#53473f',
    ansi: [
      '#473e3b', '#ff7c68', '#accc7c', '#facc68', '#82aadc', '#d696be', '#82c8be', '#c6b6a5',
      '#665f5c', '#ff9483', '#bbd594', '#fbd583', '#99b9e2', '#dda9ca', '#99d2ca', '#f0deca'
    ]
  },
  {
    id: 'moss',
    label: 'Moss',
    bg: '#171e15',
    fg: '#dee6ca',
    cursor: '#aecc7c',
    selection: '#495042',
    ansi: [
      '#41473f', '#f27c68', '#98d484', '#e8ca70', '#84b0d8', '#c89cc8', '#7cceb4', '#b6bea6',
      '#616660', '#f49483', '#abdc9a', '#ecd48a', '#9abedf', '#d2aed2', '#94d7c2', '#dee6ca'
    ]
  }
]
