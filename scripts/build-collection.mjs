// Builds collections/restful-booker.postman_collection.json from a compact list of test cases.
// Run: node scripts/build-collection.mjs
// The collection can be opened in Postman (Import) or run from the terminal with Newman (npm run test:api).
import { mkdirSync, writeFileSync } from 'node:fs';

const JSON_HEADERS = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Accept', value: 'application/json' },
];

/** Postman test script: an array of lines joined into the event script. */
const script = (...lines) => ({ type: 'text/javascript', exec: lines.flat() });

function request({ id, name, method = 'GET', path, headers = [], body, pre = [], tests }) {
  const item = {
    name: `${id}: ${name}`,
    request: {
      method,
      header: headers,
      url: `{{baseUrl}}${path}`,
      ...(body === undefined ? {} : { body: { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } }),
    },
    event: [{ listen: 'test', script: script(tests) }],
  };
  if (pre.length) item.event.unshift({ listen: 'prerequest', script: script(pre) });
  return item;
}

const validBooking = (firstname = '{{uniqueName}}') => ({
  firstname,
  lastname: 'Tester',
  totalprice: 150,
  depositpaid: true,
  bookingdates: { checkin: '2030-01-10', checkout: '2030-01-15' },
  additionalneeds: 'Breakfast',
});

const newName = ["pm.collectionVariables.set('uniqueName', 'Qa' + Date.now());"];
const responseTimeUnder = (ms) => `pm.test('Responds in under ${ms} ms', () => pm.expect(pm.response.responseTime).to.be.below(${ms}));`;

// ------------------------------------------------------------------ 1. Read (no login needed)
const read = [
  request({
    id: 'R-001', name: 'Health check answers', path: '/ping',
    tests: [
      "pm.test('Status is 201 (documented behavior of this API)', () => pm.response.to.have.status(201));",
      "pm.test('Body says Created', () => pm.expect(pm.response.text()).to.eql('Created'));",
      responseTimeUnder(3000),
    ],
  }),
  request({
    id: 'R-002', name: 'List bookings returns an array of ids', path: '/booking', headers: JSON_HEADERS,
    tests: [
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "const list = pm.response.json();",
      "pm.test('Body is a non-empty array', () => { pm.expect(list).to.be.an('array'); pm.expect(list.length).to.be.above(0); });",
      "pm.test('Every item has a numeric bookingid', () => list.forEach((b) => pm.expect(b.bookingid).to.be.a('number')));",
      "pm.collectionVariables.set('existingId', list[0].bookingid);",
      responseTimeUnder(3000),
    ],
  }),
  request({
    id: 'R-003', name: 'Get one booking: fields and types', path: '/booking/{{existingId}}', headers: JSON_HEADERS,
    tests: [
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "const b = pm.response.json();",
      "pm.test('Has the documented fields', () => pm.expect(b).to.have.all.keys('firstname', 'lastname', 'totalprice', 'depositpaid', 'bookingdates', 'additionalneeds'));",
      "pm.test('Field types are correct', () => { pm.expect(b.firstname).to.be.a('string'); pm.expect(b.lastname).to.be.a('string'); pm.expect(b.totalprice).to.be.a('number'); pm.expect(b.depositpaid).to.be.a('boolean'); });",
      "pm.test('Dates look like YYYY-MM-DD', () => { pm.expect(b.bookingdates.checkin).to.match(/^\\d{4}-\\d{2}-\\d{2}$/); pm.expect(b.bookingdates.checkout).to.match(/^\\d{4}-\\d{2}-\\d{2}$/); });",
      "pm.test('Content type is JSON', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json'));",
    ],
  }),
  request({
    id: 'R-004', name: 'A booking that does not exist returns 404', path: '/booking/99999999', headers: JSON_HEADERS,
    tests: ["pm.test('Status is 404', () => pm.response.to.have.status(404));"],
  }),
  request({
    id: 'R-005', name: 'A non-numeric id is a client error, not a server error', path: '/booking/abc', headers: JSON_HEADERS,
    tests: ["pm.test('Status is 4xx (not 5xx)', () => pm.expect(pm.response.code).to.be.within(400, 499));"],
  }),
];

// ------------------------------------------------------------------ 2. Create and search (no login needed)
const create = [
  request({
    id: 'C-001', name: 'Create a valid booking', method: 'POST', path: '/booking', headers: JSON_HEADERS, pre: newName, body: validBooking(),
    tests: [
      "pm.test('Status is 200 (documented behavior of this API)', () => pm.response.to.have.status(200));",
      "const r = pm.response.json();",
      "pm.test('Returns a numeric bookingid', () => pm.expect(r.bookingid).to.be.a('number'));",
      "pm.test('The booking in the response equals what was sent', () => pm.expect(r.booking).to.eql(JSON.parse(pm.request.body.raw)));",
      "pm.collectionVariables.set('createdId', r.bookingid);",
    ],
  }),
  request({
    id: 'C-002', name: 'The created booking can be read back', path: '/booking/{{createdId}}', headers: JSON_HEADERS,
    tests: [
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "const b = pm.response.json();",
      "pm.test('Name and price match what was created', () => { pm.expect(b.firstname).to.eql(pm.collectionVariables.get('uniqueName')); pm.expect(b.totalprice).to.eql(150); pm.expect(b.depositpaid).to.eql(true); });",
    ],
  }),
  request({
    id: 'C-003', name: 'Search by first name finds the created booking', path: '/booking?firstname={{uniqueName}}', headers: JSON_HEADERS,
    tests: [
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "pm.test('The created booking is in the results', () => pm.expect(pm.response.json().map((b) => b.bookingid)).to.include(Number(pm.collectionVariables.get('createdId'))));",
    ],
  }),
  request({
    id: 'C-004', name: 'Search by a name nobody has returns an empty list', path: '/booking?firstname=NoSuchPersonXyz123', headers: JSON_HEADERS,
    tests: [
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "pm.test('The list is empty', () => pm.expect(pm.response.json()).to.eql([]));",
    ],
  }),
  request({
    id: 'C-005', name: 'Quotes and markup are stored as plain text', method: 'POST', path: '/booking', headers: JSON_HEADERS,
    body: { ...validBooking("<script>alert('x')</script>"), additionalneeds: "Robert'); DROP TABLE bookings;--" },
    tests: [
      "pm.test('Not a server error', () => pm.expect(pm.response.code).to.be.below(500));",
      "pm.test('Text is returned exactly as sent', () => { const r = pm.response.json(); pm.expect(r.booking.firstname).to.eql(\"<script>alert('x')</script>\"); });",
    ],
  }),
];

// ------------------------------------------------------------------ 3. Input validation (what a careful API should refuse)
const rejects = (id, name, body, extra = []) =>
  request({
    id, name: `${name} is rejected with 400`, method: 'POST', path: '/booking', headers: JSON_HEADERS, body,
    tests: [
      "pm.test('Status is 400 (bad request)', () => pm.response.to.have.status(400));",
      "pm.test('Never a 5xx server error', () => pm.expect(pm.response.code).to.be.below(500));",
      ...extra,
    ],
  });
const validation = [
  rejects('V-001', 'A booking without a first name', (({ firstname, ...rest }) => rest)(validBooking('x'))),
  rejects('V-002', 'A booking without dates', (({ bookingdates, ...rest }) => rest)(validBooking('x'))),
  rejects('V-003', 'A total price written as text', { ...validBooking('x'), totalprice: 'one hundred' }),
  rejects('V-004', 'A negative total price', { ...validBooking('x'), totalprice: -50 }),
  rejects('V-005', 'A check-out date before the check-in date', { ...validBooking('x'), bookingdates: { checkin: '2030-02-10', checkout: '2030-02-01' } }),
  rejects('V-006', 'An impossible date (month 13)', { ...validBooking('x'), bookingdates: { checkin: '2030-13-45', checkout: '2030-13-46' } }),
  rejects('V-007', 'An empty body', ''),
  rejects('V-008', 'Malformed JSON', '{ this is not json'),
  rejects('V-009', 'A 5,000-character first name', validBooking('A'.repeat(5000))),
  rejects('V-010', 'depositpaid written as text', { ...validBooking('x'), depositpaid: 'maybe' }),
  request({
    id: 'V-011', name: 'An XML response carries an XML content type', path: '/booking/{{existingId}}', headers: [{ key: 'Accept', value: 'application/xml' }],
    tests: [
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "pm.test('The body is XML', () => pm.expect(pm.response.text()).to.include('<?xml'));",
      "pm.test('Content-Type header says XML', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('xml'));",
    ],
  }),
];

// ------------------------------------------------------------------ 4. Login and changes (needs the demo username and password)
const authHeaders = [...JSON_HEADERS, { key: 'Cookie', value: 'token={{token}}' }];
const auth = [
  request({
    id: 'A-001', name: 'Wrong credentials are refused with 401', method: 'POST', path: '/auth', headers: JSON_HEADERS,
    body: { username: 'nobody', password: 'wrong-password' },
    tests: [
      "pm.test('Status is 401 (unauthorized)', () => pm.response.to.have.status(401));",
      "pm.test('No token is issued', () => pm.expect(pm.response.json().token).to.be.undefined);",
    ],
  }),
  request({
    id: 'A-002', name: 'Valid credentials return a token', method: 'POST', path: '/auth', headers: JSON_HEADERS,
    body: '{ "username": "{{username}}", "password": "{{password}}" }',
    tests: [
      "pm.test('username and password are set in the environment', () => pm.expect(pm.environment.get('username'), 'fill in environments/restful-booker.postman_environment.json').to.be.ok);",
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "const t = pm.response.json().token;",
      "pm.test('A token is returned', () => pm.expect(t).to.be.a('string').and.not.empty);",
      "pm.collectionVariables.set('token', t);",
    ],
  }),
  request({
    id: 'A-003', name: 'Changing a booking without a token is forbidden', method: 'PUT', path: '/booking/{{createdId}}', headers: JSON_HEADERS, body: validBooking('Hacker'),
    tests: ["pm.test('Status is 403', () => pm.response.to.have.status(403));"],
  }),
  request({
    id: 'A-004', name: 'Deleting a booking without a token is forbidden', method: 'DELETE', path: '/booking/{{createdId}}', headers: JSON_HEADERS,
    tests: ["pm.test('Status is 403', () => pm.response.to.have.status(403));"],
  }),
  request({
    id: 'A-005', name: 'A made-up token is forbidden', method: 'PUT', path: '/booking/{{createdId}}', headers: [...JSON_HEADERS, { key: 'Cookie', value: 'token=notarealtoken' }], body: validBooking('Hacker'),
    tests: ["pm.test('Status is 403', () => pm.response.to.have.status(403));"],
  }),
  request({
    id: 'A-006', name: 'Full update with a token', method: 'PUT', path: '/booking/{{createdId}}', headers: authHeaders,
    body: { ...validBooking('{{uniqueName}}'), lastname: 'Updated', totalprice: 999 },
    tests: [
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "pm.test('The response shows the new values', () => { const b = pm.response.json(); pm.expect(b.lastname).to.eql('Updated'); pm.expect(b.totalprice).to.eql(999); });",
    ],
  }),
  request({
    id: 'A-007', name: 'Partial update changes only the sent field', method: 'PATCH', path: '/booking/{{createdId}}', headers: authHeaders,
    body: { firstname: 'PatchedName' },
    tests: [
      "pm.test('Status is 200', () => pm.response.to.have.status(200));",
      "pm.test('firstname changed, lastname and price kept', () => { const b = pm.response.json(); pm.expect(b.firstname).to.eql('PatchedName'); pm.expect(b.lastname).to.eql('Updated'); pm.expect(b.totalprice).to.eql(999); });",
    ],
  }),
  request({
    id: 'A-008', name: 'Delete with a token succeeds', method: 'DELETE', path: '/booking/{{createdId}}', headers: authHeaders,
    tests: ["pm.test('Status is 2xx', () => pm.expect(pm.response.code).to.be.within(200, 299));"],
  }),
  request({
    id: 'A-009', name: 'A deleted booking is gone', path: '/booking/{{createdId}}', headers: JSON_HEADERS,
    tests: ["pm.test('Status is 404', () => pm.response.to.have.status(404));"],
  }),
  request({
    id: 'A-010', name: 'Deleting a booking that does not exist returns 404', method: 'DELETE', path: '/booking/99999999', headers: authHeaders,
    tests: ["pm.test('Status is 404 (not found)', () => pm.response.to.have.status(404));"],
  }),
];

const folder = (name, description, item) => ({ name, description, item });
const collection = {
  info: {
    name: 'Restful-Booker API tests',
    description: 'Manual-style API test cases for the Restful-Booker practice API (https://restful-booker.herokuapp.com), automated with Postman tests. See README.md.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'https://restful-booker.herokuapp.com' },
    { key: 'existingId', value: '1' },
    { key: 'createdId', value: '1' },
    { key: 'uniqueName', value: 'Qa' },
    { key: 'token', value: '' },
  ],
  item: [
    folder('01 Read bookings', 'No login needed.', read),
    folder('02 Create and search', 'No login needed. Creates bookings with a unique name.', create),
    folder('03 Input validation and formats (known defects)', 'What a careful API should refuse or format correctly. These tests currently FAIL on purpose: each failure is a documented defect (see docs/BUG-REPORTS.md).', validation),
    folder('04 Login and changes', 'Needs the demo username and password from the API documentation (see README).', auth),
  ],
};

mkdirSync('collections', { recursive: true });
writeFileSync('collections/restful-booker.postman_collection.json', JSON.stringify(collection, null, 2) + '\n');
const count = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`Wrote collections/restful-booker.postman_collection.json with ${count} requests in ${collection.item.length} folders.`);
