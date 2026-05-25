/**
 * Smoke test: every API endpoint and library file must parse without
 * syntax errors. Catches the simplest regressions in CI.
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

function walk(dir) {
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(p))
    else if (ent.isFile() && p.endsWith('.js')) out.push(p)
  }
  return out
}

const targets = [
  ...walk(path.join(__dirname, '..', 'api')),
  ...walk(path.join(__dirname, '..', 'lib')),
]

for (const file of targets) {
  test(`parses: ${path.relative(path.join(__dirname, '..'), file)}`, () => {
    assert.doesNotThrow(() => {
      execSync(`node --check ${JSON.stringify(file)}`, { stdio: 'pipe' })
    })
  })
}
