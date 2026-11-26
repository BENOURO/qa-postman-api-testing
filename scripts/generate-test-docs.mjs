// Writes docs/TEST-CASES.md from the Postman collection, so the list can never drift from what is executed.
// Run: npm run docs
import { readFileSync, writeFileSync } from 'node:fs';

const collection = JSON.parse(readFileSync('collections/restful-booker.postman_collection.json', 'utf8'));
const escape = (text) => text.replace(/\|/g, '\\|');
const lines = [
  '# Test cases',
  '',
  'Generated from `collections/restful-booker.postman_collection.json` by `npm run docs`.',
  'Each case is one request; the expected results are the assertions of its Postman test script.',
  '',
];
let total = 0;
for (const folder of collection.item) {
  lines.push(`## ${folder.name}`, '', folder.description, '', '| ID | Test case | Request | Expected results |', '|---|---|---|---|');
  for (const item of folder.item) {
    const [id, ...rest] = item.name.split(': ');
    const script = (item.event.find((e) => e.listen === 'test')?.script.exec ?? []).join('\n');
    const expected = [...script.matchAll(/pm\.test\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
    lines.push(`| ${id} | ${escape(rest.join(': '))} | \`${item.request.method} ${item.request.url.replace('{{baseUrl}}', '')}\` | ${escape(expected.join('; '))} |`);
    total += 1;
  }
  lines.push('');
}
lines.splice(4, 0, `${total} test cases.`, '');
writeFileSync('docs/TEST-CASES.md', lines.join('\n'));
console.log(`Wrote docs/TEST-CASES.md with ${total} test cases.`);
