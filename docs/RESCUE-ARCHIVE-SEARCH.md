# Rescue archive search and historical map

## Scope

**Operations → Rescue Queue** is a day-based dispatch workspace and does not
provide historical free-text searching. Earlier unresolved cases remain
visible as carry-over work.

**Administration → Rescues → List** uses a separate authenticated server-side
archive search. **Map** displays the rescues reported on a selected NSW calendar
day, including completed records, at their originally reported coordinates.

## API

`GET /api/admin/rescues/search`

Supported query parameters:

| Parameter | Values | Default |
| --- | --- | --- |
| `q` | Search words (max 140 characters); case-insensitive | Empty |
| `status` | `all`, `active`, `PENDING`, `ASSIGNED`, `COMPLETED`, `CANCELLED` | `all` |
| `period` | `all`, `today`, `seven_days`, `older`, `selected_day` | `all` |
| `date` | `YYYY-MM-DD` (Australia/Sydney day, no future dates) | Today |
| `organisation` | `all` or organisation ID | `all` |
| `order` | `newest`, `oldest` | `newest` |
| `cursor` | Opaque continuation token from the preceding response | Absent |

Response:

```json
{
  "items": [],
  "nextToken": null,
  "hasMore": false,
  "examined": 0
}
```

Items have the standard Rescue record shape. Pages contain up to 25 matching
rescues. Continue with `cursor=<nextToken>` until `hasMore` is false.
Because the server caps work at 2,000 examined rescue records per HTTP request,
a sparse text search may yield zero matches **with hasMore true**. This
does **not** mean the archive has no matching cases: continue scanning.
The UI shows a **Continue searching history** action in this situation.

Multiple words are AND-matched across fields: e.g. `possum Newcastle`
matches a record containing both terms, even in different fields.
Search includes case ID (with or without a leading `#`), species, breed,
location, condition, rescue status, animal status, assigned user ID,
organisation ID and assigned responder name.

`GET /api/admin/rescues/day?date=YYYY-MM-DD&organisation=all` retrieves
all reports from that date for the historical map. Do not use the operational
`/api/rescues/feed` or its most-recent-200 snapshot for archive searches.

## Authorization

Both archive endpoints require an active administrative account.
Organisation administrators can search only their own organisation.
Platform/authority administrators may inspect all organisations or filter
to a specified one. The server applies this restriction *before returning
records*; client-side filters never define security boundaries.

Cursors are opaque, filter-specific continuation hints, **not authorization
credentials**. Every request authenticates and re-applies the viewer's current
role and organisational scope.

## Data model and performance

- Rescue creation sets `gsi2pk = RESCUES` and
  `gsi2sk = <createdAt>#<rescueId>`. This permits globally ordered
  full-history pagination without a table Scan.
- Single-status queries use `gsi1pk = STATUS#<status>` and the
  creation-based `gsi1sk`. Status changes move records between partitions,
  preserving the rescue's original report date.
- Date filters use the UTC bounds of NSW calendar days, accounting for daylight
  saving changes. Report-date grouping never uses `updatedAt`.
- Organisation and free-text matches are **evaluated after DynamoDB index
  reads**. This is a complete, progressively searchable archive but not a
  dedicated inverted full-text index. Broad text or organisation-specific
  searches across very large national histories may require several
  continuation requests and incur DynamoDB read costs.
- The archive service caps each request at 2,000 examined index records and
  returns a cursor rather than silently truncating search results.
- Filter-specific cursors preserve sort order and resume **after the last
  examined record**. They do not provide a frozen historical snapshot during
  concurrent updates.
- Responder-name lookup paginates through the user directory's index and
  caches each authorised name map briefly (60 seconds) in warm server processes.

## Verification checklist

Run `npm run check --workspace=website` and
`npm run build --workspace=website` locally before deployment.

Functional tests with real or seeded DynamoDB records should include:

1. More than 200 completed cases, with a case older than record 200 found by
   text search and by direct date selection.
2. More than 25 matching rescues: load additional pages; check no missing IDs
   or duplicates, in newest and oldest order.
3. Sparse query that examines 2,000 records without a match: cursor remains
   usable, and the UI can continue searching rather than claiming no results.
4. Single-status and active-status filters, all date periods, NSW DST switch
   days, and organisation filter combinations.
5. Organisation admin attempting another organisation ID, cursor reuse with
   changed filters, expired sessions and non-admin account access.
6. Search by assigned responder name when the user directory exceeds 1 MB.
7. Newly created or status-updated rescues while paging: no security leakage,
   and normal GSI eventual consistency is understood.
8. Historical **List → View pin → Map** selection and date changes.
9. Operations remains day-based and has no general archive search field.

## Future scale work

If daily national volumes become large, consider additional
organisation/status/date-specific GSIs and a dedicated search index for
instant keyword matching. These would improve performance but are **not
required for complete cursor-paginated archive coverage**.
