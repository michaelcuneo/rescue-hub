# AI agent instructions — Rescue Hub

**Read [docs/ANIMAL-LIFECYCLE.md](docs/ANIMAL-LIFECYCLE.md) before planning, editing or reviewing Rescue Hub workflows.** It is the authoritative product-owner clarification, recorded 10 November 2026, and takes precedence over older descriptions of manual dispatcher assignment or rescue closure at handover.

Rescue Hub is **animal-centred**, not merely a dispatch queue. Eligible rescuers **self-claim** available rescues; routine manual allocation is not the operating model. Each animal has a persistent record through collection, veterinary treatment, custody handovers, potentially prolonged rehabilitation, and explicit final outcome (release, euthanasia, death, etc.). A response completed or an animal delivered to a vet/carer is **not** the end of animal tracking. Track current custodian, current whereabouts, outstanding handovers and full history. A single incident may involve multiple animals.

Preserve multi-tenant organisation/jurisdiction boundaries, security, location privacy and auditable actions. Make claims atomic. Distinguish incident/response status from animal care/custody status and outcome. Backend serves SvelteKit desktop and React Native iOS/Android.

Read also [docs/PRODUCT.md](docs/PRODUCT.md), [docs/RESCUE-WORKFLOW.md](docs/RESCUE-WORKFLOW.md), [docs/AUTHORIZATION.md](docs/AUTHORIZATION.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/ROADMAP.md](docs/ROADMAP.md). Older documents may be inconsistent; do not revert to manual dispatch based on them. Update documentation alongside behavioural changes. Do not mark workflows tested without execution evidence.
