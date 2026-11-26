# Bug reports: Restful-Booker practice API

Found by running the Postman collection in `collections/` against https://restful-booker.herokuapp.com on 2026-11-26.
Every report below was reproduced with a real request; the "Actual" lines are what the server returned.
Automated check: `npm run test:defects` (these tests are expected to fail until the API is fixed).

Severity: **High** = wrong or lost data, **Medium** = server error or missing validation, **Low** = wrong header or cosmetic.

Common request used in the steps (valid booking, accepted with 200):

```json
{
  "firstname": "Qa", "lastname": "Tester", "totalprice": 150, "depositpaid": true,
  "bookingdates": { "checkin": "2030-01-10", "checkout": "2030-01-15" },
  "additionalneeds": "Breakfast"
}
```

Send it as `POST https://restful-booker.herokuapp.com/booking` with headers `Content-Type: application/json` and `Accept: application/json`, changing only the field named in each report.

---

## BUG-001: Creating a booking without a first name returns 500 instead of 400

- **Severity:** Medium | **Test:** V-001
- **Steps:** POST the common request with the `firstname` field removed.
- **Expected:** `400 Bad Request` with a message saying `firstname` is required.
- **Actual:** `500 Internal Server Error`, body `Internal Server Error`.
- **Impact:** A client mistake crashes the request handler; clients cannot tell what to fix.

## BUG-002: Creating a booking without dates returns 500 instead of 400

- **Severity:** Medium | **Test:** V-002
- **Steps:** POST the common request with the whole `bookingdates` object removed.
- **Expected:** `400 Bad Request` naming the missing field.
- **Actual:** `500 Internal Server Error`.

## BUG-003: An empty request body returns 500 instead of 400

- **Severity:** Medium | **Test:** V-007
- **Steps:** POST to `/booking` with `Content-Type: application/json` and no body.
- **Expected:** `400 Bad Request`.
- **Actual:** `500 Internal Server Error`. (A malformed JSON body such as `{ this is not json` correctly returns `400`, so only the empty case is mishandled.)

## BUG-004: A non-numeric total price is accepted and silently saved as null

- **Severity:** High | **Test:** V-003
- **Steps:** POST the common request with `"totalprice": "one hundred"`.
- **Expected:** `400 Bad Request`: the price must be a number.
- **Actual:** `200 OK`, and the saved booking has `"totalprice": null`.
- **Impact:** The price is lost without any warning, so a booking can exist with no price.

## BUG-005: A negative total price is accepted

- **Severity:** Medium | **Test:** V-004
- **Steps:** POST the common request with `"totalprice": -50`.
- **Expected:** `400 Bad Request`.
- **Actual:** `200 OK`, booking saved with `"totalprice": -50`.

## BUG-006: A check-out date before the check-in date is accepted

- **Severity:** Medium | **Test:** V-005
- **Steps:** POST the common request with `checkin` `2030-02-10` and `checkout` `2030-02-01`.
- **Expected:** `400 Bad Request`: check-out must be after check-in.
- **Actual:** `200 OK`, booking saved with the impossible date range.

## BUG-007: Impossible dates are accepted and stored as corrupted text

- **Severity:** High | **Test:** V-006
- **Steps:** POST the common request with `checkin` `2030-13-45` and `checkout` `2030-13-46`.
- **Expected:** `400 Bad Request`: not valid dates.
- **Actual:** `200 OK`, and both dates are saved as `"0NaN-aN-aN"`.
- **Impact:** Corrupted data is stored and returned to every client that reads the booking.

## BUG-008: A text value for `depositpaid` is silently turned into `true`

- **Severity:** Medium | **Test:** V-010
- **Steps:** POST the common request with `"depositpaid": "maybe"`.
- **Expected:** `400 Bad Request`: must be true or false.
- **Actual:** `200 OK`, saved as `"depositpaid": true`.
- **Impact:** A deposit is recorded as paid when the client did not say so.

## BUG-009: A 5,000-character first name is accepted

- **Severity:** Low | **Test:** V-009
- **Steps:** POST the common request with a `firstname` of 5,000 letters `A`.
- **Expected:** `400` (or `413`): the name is too long.
- **Actual:** `200 OK`, the full 5,000 characters are saved and returned (response about 5 KB).
- **Impact:** No length limit; could be used to fill the database or break layouts.

## BUG-010: XML responses are sent with the wrong Content-Type

- **Severity:** Low | **Test:** V-011
- **Steps:** `GET /booking/<existing id>` with the header `Accept: application/xml`.
- **Expected:** `Content-Type: application/xml` (or `text/xml`).
- **Actual:** the body is correct XML (`<?xml version='1.0'?><booking>...`), but the header is `Content-Type: text/html; charset=utf-8`.
- **Impact:** Clients that trust the header will not parse the response as XML.

---

## Other observations (not logged as bugs)

- `GET /ping` answers `201 Created` and `POST /booking` answers `200 OK` instead of `201`. These are unusual choices for a REST API. The tests assert the actual behavior so they would notice a change.
- The Login and changes folder (`04`) was written but is not part of the evidence above: it needs the demo username and password from the API documentation, so its results are not reported here.
