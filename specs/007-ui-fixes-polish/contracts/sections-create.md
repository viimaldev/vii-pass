# Contract: Create Section — duplicate-name rejection

**Route**: `POST /api/sections` (existing, session-protected)

This feature adds a uniqueness guard to the existing create-section endpoint. Request and
success shapes are unchanged; only a new failure case is introduced.

## Request (unchanged)

```http
POST /api/sections
Content-Type: application/json
Cookie: <session cookie>

{
  "name": "Work",
  "color": "#0b5cad"
}
```

- `name`: 1–50 chars (existing Zod rule). Server **trims** before storing/comparing.
- `color`: `#RRGGBB` (existing rule).

## Responses

### 201 Created (unchanged — name is unique for this user)

```json
{
  "id": "665f...",
  "name": "Work",
  "color": "#0b5cad",
  "position": 3,
  "isDefault": false
}
```

### 409 Conflict (new — duplicate name)

Returned when the user already owns a section whose name equals the requested name after
`trim()` + case-insensitive (`toLowerCase()`) comparison.

```json
{
  "error": "section_exists",
  "message": "A section with that name already exists."
}
```

- No document is created.
- Comparison examples that all conflict with an existing "Work": `"Work"`, `"work"`,
  `"  Work  "`, `"WORK"`.

### 401 Unauthorized (unchanged)

Returned when no valid session is present.

## Client behavior

- On `409 section_exists`, the create-section dialog shows the returned `message` inline and
  keeps the dialog open with the entered value so the user can correct it. No duplicate tab
  is added.
