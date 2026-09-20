# Rescue Hub

Rescue Hub is a multi-tenant wildlife rescue coordination platform for Australian wildlife rescue organisations and the government authorities that oversee them.

The product is intended to provide one shared operational system while preserving strict regional and organisational boundaries. A local rescue organisation can dispatch and manage rescues inside its authorised coverage area, while an authorised governing body can inspect the complete record across the organisations within its jurisdiction.

The immediate implementation contains two SvelteKit applications:

- `packages/pc-rescues` — the operational dispatch application used by rescue organisations.
- `packages/admin` — the governing/administrative application for cross-organisation oversight.

The backend is SST-native on AWS:

- SST v4
- SvelteKit
- AWS AppSync GraphQL
- Amazon DynamoDB
- SST linked resources

Amplify is not part of the backend architecture.

## Product documentation

The product direction is documented here:

- [Product vision and operating model](docs/PRODUCT.md)
- [Tenancy, roles and authorisation](docs/AUTHORIZATION.md)
- [Rescue lifecycle and dispatch workflow](docs/RESCUE-WORKFLOW.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Implementation roadmap](docs/ROADMAP.md)

These documents are the source of truth for the intended behaviour of Rescue Hub. Implementation decisions should preserve the tenancy, regional-authority and audit requirements described there.

## Development

Install dependencies:

```bash
npm install
```

Run the SST development environment:

```bash
npm run dev
```

Run checks for all workspaces:

```bash
npm run check
```

Build both SvelteKit applications:

```bash
npm run build
```

Deploy the current SST stage:

```bash
npm run deploy
```

Deploy the protected production stage:

```bash
npm run deploy:production
```

The AWS region is currently configured as `ap-southeast-2`.

## Current status

The current codebase is an evolving prototype. The UI already demonstrates the intended dispatcher/map interaction, but the product model described in `docs/` should now drive the next phase of implementation.
