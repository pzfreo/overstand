#!/usr/bin/env bun
/**
 * Entry point for standalone binary build (bun compile).
 * Calls main() unconditionally — no isMain guard needed.
 */
import { main } from './cli.ts'

main().catch((e) => {
  console.error(`Unexpected error: ${(e as Error).message}`)
  process.exit(1)
})
