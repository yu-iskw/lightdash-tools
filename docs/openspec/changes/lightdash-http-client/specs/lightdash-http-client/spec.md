# Spec: Lightdash HTTP client

## ADDED Requirements

### Requirement: Client configuration

The client SHALL accept configuration with a base URL and an API key. The base URL SHALL be the Lightdash instance root (e.g. `https://app.lightdash.cloud`). The API key SHALL be a Personal Access Token used for authentication.

#### Scenario: Client created with valid config

- **WHEN** the client is created with `baseUrl` and `apiKey`
- **THEN** subsequent API requests use that base URL and send the API key in the Authorization header

#### Scenario: Request URL construction

- **WHEN** the client issues a request to an endpoint path (e.g. `/org`)
- **THEN** the request URL SHALL be `{baseUrl}/api/v1{path}`

### Requirement: Authentication

The client SHALL authenticate every request using the configured API key. The Authorization header SHALL be set to `ApiKey ldpat_{apiKey}`. The client SHALL NOT use session cookies for API calls.

#### Scenario: Authorization header present

- **WHEN** the client sends any request to the Lightdash API
- **THEN** the request SHALL include the header `Authorization: ApiKey ldpat_{token}`

### Requirement: Transport

The client SHALL use HTTP with JSON for request and response bodies. The client SHALL use a single internal request path for all API calls so that auth and error handling are consistent. The implementation SHALL target Node 18+ or modern runtimes and MAY use native `fetch`.

#### Scenario: JSON request and response

- **WHEN** the client calls an endpoint that accepts a body (e.g. PATCH /org)
- **THEN** the request SHALL have `Content-Type: application/json` and the body SHALL be JSON-serialized

#### Scenario: JSON response parsing

- **WHEN** the server returns a 2xx response with a JSON body
- **THEN** the client SHALL parse the body as JSON and return the typed result to the caller

### Requirement: Error handling

The client SHALL treat any non-2xx HTTP response as an error. When the response body is JSON that matches the Lightdash ApiErrorPayload shape (status, error with message, name, statusCode), the client SHALL expose that payload to the caller (e.g. via a thrown error or returned result type). When the body does not match ApiErrorPayload, the client SHALL surface a generic error with the HTTP status and body if available.

#### Scenario: API error payload

- **WHEN** the server returns 4xx or 5xx with a JSON body containing `status: "error"` and `error: { message, name, statusCode }`
- **THEN** the client SHALL expose the error message and status code to the caller

#### Scenario: Non-JSON or unexpected error body

- **WHEN** the server returns 4xx or 5xx with a non-JSON body or a body that does not match ApiErrorPayload
- **THEN** the client SHALL surface a generic error indicating the request failed

### Requirement: Organizations API — get current organization

The client SHALL provide a method to get the current user's organization. It SHALL call `GET /api/v1/org` and return the organization object from the response (e.g. `Organization` with name, organizationUuid, and other fields from the Lightdash API).

#### Scenario: Get organization success

- **WHEN** the caller invokes get current organization and the server returns 200 with a valid organization payload
- **THEN** the client SHALL return the organization object (e.g. name, organizationUuid, defaultProjectUuid, chartColors, etc.)

### Requirement: Organizations API — update and create organization

The client SHALL provide a method to update the current organization (PATCH /api/v1/org) with a partial organization payload. The client SHALL provide a method to create a new organization (PUT /api/v1/org) with a body containing at least `name`; this is only valid when the user is not already in an organization.

#### Scenario: Update organization success

- **WHEN** the caller invokes update organization with a valid partial payload (e.g. name, defaultProjectUuid)
- **THEN** the client SHALL send PATCH /api/v1/org with the JSON body and return success on 200

#### Scenario: Create organization success

- **WHEN** the caller invokes create organization with `{ name: string }` and the server accepts
- **THEN** the client SHALL send PUT /api/v1/org with the body and return success on 200

### Requirement: Organizations API — list members, projects, and groups

The client SHALL provide methods to list organization members (GET /api/v1/org/users), organization projects (GET /api/v1/org/projects), and organization groups (GET /api/v1/org/groups). List members SHALL accept optional query parameters (e.g. page, pageSize, searchQuery, projectUuid, includeGroups, googleOidcOnly). List groups SHALL accept optional query parameters (e.g. page, pageSize, searchQuery, includeMembers). List projects SHALL require no parameters. Responses SHALL be typed according to the Lightdash API (e.g. paginated members, array of projects, paginated groups).

#### Scenario: List members with pagination

- **WHEN** the caller invokes list organization members with optional page and pageSize
- **THEN** the client SHALL send GET /api/v1/org/users with the corresponding query parameters and return the paginated list of member profiles

#### Scenario: List projects

- **WHEN** the caller invokes list organization projects
- **THEN** the client SHALL send GET /api/v1/org/projects and return the array of organization projects

#### Scenario: List groups with optional params

- **WHEN** the caller invokes list organization groups with optional searchQuery or includeMembers
- **THEN** the client SHALL send GET /api/v1/org/groups with the corresponding query parameters and return the paginated list of groups

### Requirement: Organizations API — delete organization member

The client SHALL provide a method to delete a user from the current organization. It SHALL call `DELETE /api/v1/org/user/{userUuid}` with the given user UUID.

#### Scenario: Delete member success

- **WHEN** the caller invokes delete organization member with a valid user UUID and the server returns 200
- **THEN** the client SHALL return success

### Requirement: Types aligned to Lightdash API

The client SHALL expose types that align with the Lightdash OpenAPI spec and discovery research for the Organizations area. At least the following SHALL be represented: Organization; OrganizationMemberProfile and paginated member list; OrganizationProject; Group (and GroupWithMembers where applicable); ApiErrorPayload. Types MAY be defined in the client package or a shared types package.

#### Scenario: Typed organization response

- **WHEN** the caller receives the result of get current organization
- **THEN** the result SHALL be typed (e.g. Organization with name, organizationUuid, and other known fields)

#### Scenario: Typed error

- **WHEN** the server returns an ApiErrorPayload
- **THEN** the client SHALL expose it in a typed form (e.g. error.message, error.statusCode, error.name)

### Requirement: Optional — list allowed organizations (My Account)

The client MAY provide a method to list organizations the current user can join. If provided, it SHALL call GET /api/v1/user/me/allowedOrganizations and SHALL return a list of organizations (e.g. organizationUuid, name, membersCount). This is part of the My Account surface and MAY be namespaced (e.g. under user or myAccount).

#### Scenario: List allowed organizations success

- **WHEN** the caller invokes list allowed organizations and the server returns 200
- **THEN** the client SHALL return the list of organizations the user can join (by email domain)
