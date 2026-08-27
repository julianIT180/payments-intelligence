#!/usr/bin/env node
// Initial reproducible evaluation / validation harness.
//
// This does NOT call n8n. It compares recorded execution-result fixtures
// (evaluation/fixtures/<id>.result.json) against case expectations
// (evaluation/cases/<id>.json) and prints PASS / FAIL / INCOMPLETE per assertion.
//
//   node evaluation/validate.mjs            # lenient: INCOMPLETE does not fail
//   node evaluation/validate.mjs --strict   # INCOMPLETE also fails (use once fixtures are filled)
//
// Exit code: 0 if no FAIL (and, with --strict, no INCOMPLETE); 1 otherwise.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, 'cases');
const FIXTURES_DIR = join(HERE, 'fixtures');
const STRICT = process.argv.includes('--strict');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function check(op, actual, expected) {
  switch (op) {
    case 'eq': return actual === expected;
    case 'gte': return typeof actual === 'number' && actual >= expected;
    case 'lte': return typeof actual === 'number' && actual <= expected;
    case 'truthy': return Boolean(actual);
    case 'falsy': return !actual;
    case 'exists': return actual !== undefined && actual !== null && actual !== '';
    case 'startsWith': return typeof actual === 'string' && actual.startsWith(expected);
    default: throw new Error(`unknown op: ${op}`);
  }
}

const caseFiles = readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort();
let totalFail = 0;
let totalIncomplete = 0;
let totalPass = 0;

for (const cf of caseFiles) {
  const c = readJson(join(CASES_DIR, cf));
  const fixturePath = join(FIXTURES_DIR, `${c.id}.result.json`);
  let fx;
  try {
    fx = readJson(fixturePath);
  } catch {
    console.log(`\n${c.id}  (${c.title})`);
    console.log(`  FIXTURE MISSING: ${fixturePath}`);
    totalIncomplete += c.expect.length;
    continue;
  }

  const incompleteFields = new Set(fx._not_captured || fx._incomplete || []);
  console.log(`\n${c.id}  (${c.kind})  ${c.title}`);
  console.log(`  input: ${JSON.stringify(c.input)}${c.fabricated ? '   [fabricated subject]' : ''}`);

  for (const a of c.expect) {
    const actual = getPath(fx, a.field);
    const label = `${a.field} ${a.op}${a.value !== undefined ? ` ${JSON.stringify(a.value)}` : ''}`;
    const missing = actual === undefined || actual === null || incompleteFields.has(a.field);

    if (missing) {
      totalIncomplete++;
      console.log(`  NOT CAPTURED ${label}   (value not recorded for this run)`);
      continue;
    }
    if (check(a.op, actual, a.value)) {
      totalPass++;
      console.log(`  PASS        ${label}`);
    } else {
      totalFail++;
      console.log(`  FAIL        ${label}   got ${JSON.stringify(actual)}`);
    }
  }
}

console.log(
  `\n${caseFiles.length} case(s): ${totalPass} pass, ${totalFail} fail, ${totalIncomplete} not captured` +
    (STRICT ? '  (strict)' : ''),
);

const failed = totalFail > 0 || (STRICT && totalIncomplete > 0);
process.exit(failed ? 1 : 0);
