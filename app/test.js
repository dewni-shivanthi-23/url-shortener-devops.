// Minimal smoke test — no test framework needed, just enough for CI to have something real to run.
// In a real project you'd use Jest or Mocha; kept dependency-free here so beginners can read every line.

function assert(condition, message) {
  if (!condition) {
    console.error(`FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`PASSED: ${message}`);
}

// Test 1: URL validation regex used in server.js
const urlRegex = /^https?:\/\//;
assert(urlRegex.test('https://example.com'), 'valid https URL passes regex');
assert(urlRegex.test('http://example.com'), 'valid http URL passes regex');
assert(!urlRegex.test('ftp://example.com'), 'invalid protocol fails regex');
assert(!urlRegex.test('example.com'), 'missing protocol fails regex');

// Test 2: nanoid generates codes of expected length
const { nanoid } = require('nanoid');
const code = nanoid(7);
assert(code.length === 7, 'nanoid generates a 7-character code');

console.log('All tests passed.');
