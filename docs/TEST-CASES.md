# Test cases

Generated from `collections/restful-booker.postman_collection.json` by `npm run docs`.
Each case is one request; the expected results are the assertions of its Postman test script.
31 test cases.


## 01 Read bookings

No login needed.

| ID | Test case | Request | Expected results |
|---|---|---|---|
| R-001 | Health check answers | `GET /ping` | Status is 201 (documented behavior of this API); Body says Created; Responds in under 3000 ms |
| R-002 | List bookings returns an array of ids | `GET /booking` | Status is 200; Body is a non-empty array; Every item has a numeric bookingid; Responds in under 3000 ms |
| R-003 | Get one booking: fields and types | `GET /booking/{{existingId}}` | Status is 200; Has the documented fields; Field types are correct; Dates look like YYYY-MM-DD; Content type is JSON |
| R-004 | A booking that does not exist returns 404 | `GET /booking/99999999` | Status is 404 |
| R-005 | A non-numeric id is a client error, not a server error | `GET /booking/abc` | Status is 4xx (not 5xx) |

## 02 Create and search

No login needed. Creates bookings with a unique name.

| ID | Test case | Request | Expected results |
|---|---|---|---|
| C-001 | Create a valid booking | `POST /booking` | Status is 200 (documented behavior of this API); Returns a numeric bookingid; The booking in the response equals what was sent |
| C-002 | The created booking can be read back | `GET /booking/{{createdId}}` | Status is 200; Name and price match what was created |
| C-003 | Search by first name finds the created booking | `GET /booking?firstname={{uniqueName}}` | Status is 200; The created booking is in the results |
| C-004 | Search by a name nobody has returns an empty list | `GET /booking?firstname=NoSuchPersonXyz123` | Status is 200; The list is empty |
| C-005 | Quotes and markup are stored as plain text | `POST /booking` | Not a server error; Text is returned exactly as sent |

## 03 Input validation and formats (known defects)

What a careful API should refuse or format correctly. These tests currently FAIL on purpose: each failure is a documented defect (see docs/BUG-REPORTS.md).

| ID | Test case | Request | Expected results |
|---|---|---|---|
| V-001 | A booking without a first name is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-002 | A booking without dates is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-003 | A total price written as text is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-004 | A negative total price is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-005 | A check-out date before the check-in date is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-006 | An impossible date (month 13) is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-007 | An empty body is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-008 | Malformed JSON is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-009 | A 5,000-character first name is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-010 | depositpaid written as text is rejected with 400 | `POST /booking` | Status is 400 (bad request); Never a 5xx server error |
| V-011 | An XML response carries an XML content type | `GET /booking/{{existingId}}` | Status is 200; The body is XML; Content-Type header says XML |

## 04 Login and changes

Needs the demo username and password from the API documentation (see README).

| ID | Test case | Request | Expected results |
|---|---|---|---|
| A-001 | Wrong credentials are refused with 401 | `POST /auth` | Status is 401 (unauthorized); No token is issued |
| A-002 | Valid credentials return a token | `POST /auth` | username and password are set in the environment; Status is 200; A token is returned |
| A-003 | Changing a booking without a token is forbidden | `PUT /booking/{{createdId}}` | Status is 403 |
| A-004 | Deleting a booking without a token is forbidden | `DELETE /booking/{{createdId}}` | Status is 403 |
| A-005 | A made-up token is forbidden | `PUT /booking/{{createdId}}` | Status is 403 |
| A-006 | Full update with a token | `PUT /booking/{{createdId}}` | Status is 200; The response shows the new values |
| A-007 | Partial update changes only the sent field | `PATCH /booking/{{createdId}}` | Status is 200; firstname changed, lastname and price kept |
| A-008 | Delete with a token succeeds | `DELETE /booking/{{createdId}}` | Status is 2xx |
| A-009 | A deleted booking is gone | `GET /booking/{{createdId}}` | Status is 404 |
| A-010 | Deleting a booking that does not exist returns 404 | `DELETE /booking/99999999` | Status is 404 (not found) |
