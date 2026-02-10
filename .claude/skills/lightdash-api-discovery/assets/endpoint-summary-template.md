# Endpoint summary template

Fill this in for each endpoint the HTTP client will implement. Copy the block per endpoint.

---

## Endpoint: [OperationId or short name]

- **Method**: `GET` | `POST` | `PUT` | `PATCH` | `DELETE`
- **Path**: `/api/v1/...` (with path parameters in `{braces}`)

### Path parameters

| Name   | Type   | Required | Description   |
| ------ | ------ | -------- | ------------- |
| (name) | (type) | yes/no   | (description) |

### Query parameters

| Name   | Type   | Required | Description   |
| ------ | ------ | -------- | ------------- |
| (name) | (type) | yes/no   | (description) |

### Request body

- **Content-Type**: `application/json` (if applicable)
- **Schema**: (reference OpenAPI schema or describe shape)

### Response

- **200**: (success response schema or summary)
- **Other statuses**: (e.g. 400, 401, 404 and error shape)
- **Error payload**: When present, matches `ApiErrorPayload` (e.g. `status`, `error.message`, `error.statusCode`, `error.name`).

### OpenAPI / docs reference

- (Link or path in swagger, e.g. `#/paths/...` or docs URL)

---

Repeat the block above for each endpoint.
