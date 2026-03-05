/**
 * Unit tests for the PDF generation module.
 */

import { describe, test, expect } from 'vitest'

import { parseSvgDimensions, selectPaperSize, svgToPdfBuffer, dimensionsTableToPdfBuffer, fretPositionsToPdfBuffer } from '../cli/pdf'
import { generateViolin } from '../instrument_generator'
import { getDefaultValues } from '../parameter_registry'
import type { Params } from '../types'

// ---------------------------------------------------------------------------
// parseSvgDimensions
// ---------------------------------------------------------------------------

describe('parseSvgDimensions', () => {
  test('extracts width and height from mm attributes', () => {
    const svg = '<svg width="210mm" height="297mm" viewBox="0 0 210 297"></svg>'
    const dims = parseSvgDimensions(svg)
    expect(dims.width).toBeCloseTo(210)
    expect(dims.height).toBeCloseTo(297)
  })

  test('handles decimal dimensions', () => {
    const svg = '<svg width="567.78mm" height="193.48mm"></svg>'
    const dims = parseSvgDimensions(svg)
    expect(dims.width).toBeCloseTo(567.78)
    expect(dims.height).toBeCloseTo(193.48)
  })

  test('falls back to viewBox when no mm attributes', () => {
    const svg = '<svg viewBox="-10 -20 400 600"></svg>'
    const dims = parseSvgDimensions(svg)
    expect(dims.width).toBeCloseTo(400)
    expect(dims.height).toBeCloseTo(600)
  })

  test('defaults to A4 when nothing parseable', () => {
    const svg = '<svg></svg>'
    const dims = parseSvgDimensions(svg)
    expect(dims.width).toBe(210)
    expect(dims.height).toBe(297)
  })
})

// ---------------------------------------------------------------------------
// selectPaperSize
// ---------------------------------------------------------------------------

describe('selectPaperSize', () => {
  test('selects A4 portrait for small content', () => {
    const paper = selectPaperSize(100, 150)
    expect(paper.name).toBe('A4')
    expect(paper.orientation).toBe('portrait')
  })

  test('selects A4 landscape for wide small content', () => {
    const paper = selectPaperSize(250, 150)
    expect(paper.name).toBe('A4')
    expect(paper.orientation).toBe('landscape')
  })

  test('selects A3 for medium content', () => {
    // 250 + 40 = 290 < 297 (A3 portrait width ok), 350 + 40 = 390 < 420 (A3 portrait height ok)
    const paper = selectPaperSize(250, 350)
    expect(paper.name).toBe('A3')
    expect(paper.orientation).toBe('portrait')
  })

  test('selects A0 landscape as fallback for very large content', () => {
    const paper = selectPaperSize(1200, 900)
    expect(paper.name).toBe('A0')
    expect(paper.orientation).toBe('landscape')
  })

  test('accounts for 20mm margins on each side', () => {
    // 170mm + 40mm margin = 210mm, fits A4 portrait exactly
    const paper = selectPaperSize(170, 257)
    expect(paper.name).toBe('A4')
    expect(paper.orientation).toBe('portrait')
  })

  test('bumps to A3 when margins push past A4', () => {
    // 175mm + 40mm = 215mm, exceeds A4 width (210mm)
    const paper = selectPaperSize(175, 200)
    expect(paper.name).toBe('A3')
  })
})

// ---------------------------------------------------------------------------
// svgToPdfBuffer
// ---------------------------------------------------------------------------

describe('svgToPdfBuffer', () => {
  test('produces valid PDF from simple SVG', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>'
    const { buffer, paperSize } = await svgToPdfBuffer(svg)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(100)
    expect(paperSize).toBe('A4')
  })

  test('produces valid PDF from real violin side view', async () => {
    const params = { ...getDefaultValues(), instrument_family: 'VIOLIN' } as Params
    const result = generateViolin(params)
    expect(result.success).toBe(true)
    const { buffer, paperSize } = await svgToPdfBuffer(result.views!['side'])
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    expect(paperSize).toMatch(/^A\d$/)
  })
})

// ---------------------------------------------------------------------------
// dimensionsTableToPdfBuffer
// ---------------------------------------------------------------------------

describe('dimensionsTableToPdfBuffer', () => {
  test('produces valid PDF', async () => {
    const params = { ...getDefaultValues(), instrument_family: 'VIOLIN' } as Params
    const result = generateViolin(params)
    const buffer = await dimensionsTableToPdfBuffer(
      params,
      result.derived_values ?? {},
      result.derived_formatted ?? {},
      result.derived_metadata ?? {},
    )
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(100)
  })
})

// ---------------------------------------------------------------------------
// fretPositionsToPdfBuffer
// ---------------------------------------------------------------------------

describe('fretPositionsToPdfBuffer', () => {
  test('produces valid PDF for fretted instrument', async () => {
    const params = { ...getDefaultValues(), instrument_family: 'VIOL', no_frets: 7 } as Params
    const result = generateViolin(params)
    expect(result.fret_positions?.available).toBe(true)
    const buffer = await fretPositionsToPdfBuffer('Test Viol', result.fret_positions!)
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })

  test('handles unavailable fret positions', async () => {
    const buffer = await fretPositionsToPdfBuffer('Test Violin', { available: false })
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-')
  })
})
