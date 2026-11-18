# Rescue archive search and historical map

## Scope

**Operations → Rescue Queue** is a live operational worklist, not a
historical search tool. It has no date selector and no rescue text search:

- **Pending** includes every visible unresolved Pending case in the user's organisation, regardless of report date.
- **Assigned** includes every Assigned case in that organisation, regardless of report date.
- **Completed** includes only cases completed on the **current NSW calendar day**; this is determined by `completedAt` (or `updatedAt` for older records). Server-rendered and real-time feed responses enforce this, rather than hiding other days only in the browser.
- The existing authorisation to *claim* or *manage* an animal remains independent of what the operational worklist can display.

**Administration → Rescues → List** uses a separate authenticated server-side
full archive search and retains its existing search and filters.

**Administration → Rescues → Map** can load **All rescues (any dates)**,
**one NSW calendar day**, or an **inclusive From/To date range**. Its
clustered Mapbox markers show all reported rescue locations, including
Completed and Cancelled records. The map loads official NSW operating-area
geometry separately and continues displaying its basemap when archive
requests are still in progress.

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


## Historical map API and rendering

`GET /api/admin/rescues/map?period=all&organisation=all`

Supported `period` values: `all`, `selected_day`, `range`.

- `date=YYYY-MM-DD`: required when `period=selected_day`; calendar day in Australia/Sydney.
- `from=YYYY-MM-DD&to=YYYY-MM-DD`: inclusive when `period=range`; both dates use Australia/Sydney calendar-day bounds. Ranges where `from > to` or `to` is in the future are rejected.
- `organisation`: same permission rules as the List.
- `cursor`: server-issued, filter-bound continuation token.

The map endpoint returns up to **250** matching rescues per request, followed
by a cursor while further records exist. The UI continuously follows this
cursor, combines results by case ID, and shows live loading progress; there is
no arbitrary 200-record map cap. Invalid/missing coordinates (including 0,0)
are excluded from pins but remain counted in loaded records.

A separate call to `/api/operating-areas` loads official boundary geometry
and overlays translucent polygons, outlines and labels. The map uses
Mapbox native GeoJSON clustering rather than thousands of separate HTML marker
nodes. Clicking a cluster zooms in; clicking a point opens the case summary.
Clusters display report locations with the case's **current** status, not
reconstructed status at a point in the past.

**Performance caveat:** an `All rescues` query may read the entire indexed
archive, potentially incurring many requests and DynamoDB read units.
Follow-up index refinements and optional load limits/aggregations are advisable
before full national-scale deployment. The feed's current-day completion
retrieval also scans the Completed status index until a purpose-built
completion-date index is added. The current implementation prioritises
correct results over optimal historical index efficiency.
