/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Resolve one shell-independent pnpm subprocess invocation on POSIX and Windows.
 * 2. Preserve the pnpm-specific JavaScript entry optimization over the generic command owner.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import process from 'node:process'
import { resolveCommandInvocation, resolveWindowsCommandInvocation } from './command-invocation.mjs'

/** @typedef {{ args: string[], command: string, windowsVerbatimArguments?: boolean }} CommandInvocation */

/**
 * @param {readonly string[]} args
 * @param {readonly string[]} candidates
 * @param {readonly string[]} [corepackCandidates]
 * @returns {CommandInvocation}
 */
export function resolveWindowsPnpmInvocation(args, candidates, corepackCandidates = []) {
  return resolveWindowsCommandInvocation('pnpm', args, candidates, corepackCandidates)
}

/**
 * @param {readonly string[]} args
 * @returns {CommandInvocation}
 */
export function resolvePnpmInvocation(args) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath && /\.(?:c|m)?js$/i.test(npmExecPath)) {
    return { command: process.execPath, args: [npmExecPath, ...args] }
  }
  return resolveCommandInvocation('pnpm', args)
}
