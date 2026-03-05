/**
 * CLI utility functions for filename handling and view configuration.
 */

import { existsSync } from 'node:fs'
import path from 'node:path'

/** Sanitize a string for use as a filename. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\s]+/g, '_').replace(/^_+|_+$/g, '')
}

/** Get a unique filename by appending _1, _2, etc. if file exists. */
export function getUniqueFilename(basePath: string): string {
  if (!existsSync(basePath)) return basePath

  const ext = path.extname(basePath)
  const stem = path.basename(basePath, ext)
  const dir = path.dirname(basePath)

  let counter = 1
  while (true) {
    const candidate = path.join(dir, `${stem}_${counter}${ext}`)
    if (!existsSync(candidate)) return candidate
    counter++
  }
}

/** Map from view key to filename-friendly name. */
export const VIEW_NAMES: Record<string, string> = {
  side: 'side-view',
  cross_section: 'cross-section',
  radius_template: 'radius-template',
  dimensions: 'dimensions',
  fret_positions: 'fret-positions',
}

/** Valid view names for CLI argument validation. */
export const VALID_VIEWS = Object.keys(VIEW_NAMES)
