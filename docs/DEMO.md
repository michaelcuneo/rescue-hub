# NSW Demonstration Scope

## Scope

The initial Rescue Hub product and demonstration are NSW-only.

The platform should be designed to work correctly for the NSW wildlife rehabilitation sector before any attempt is made to generalise it nationally.

The public NSW DCCEEW wildlife rehabilitation provider directory is the source for the initial organisation registry.

As of the directory update dated 1 July 2026, Rescue Hub seeds 35 publicly listed providers/services.

The broader 2026 NSW wildlife rehabilitation review reports 43 licensed providers in total. The difference is intentional: Rescue Hub should not create public organisation tenants for private or independent licence holders who are not presented by DCCEEW as public provider organisations/services.

## Claiming an organisation

Seeded directory records are authoritative directory entries, not proof that an organisation has joined Rescue Hub.

Runtime ownership/claim state must be stored separately from the DCCEEW-sourced directory record.

The intended flow is:

1. find the existing organisation;
2. request to claim it;
3. verify that the applicant has authority to administer it;
4. create the organisation tenant/account;
5. grant the verified organisation administrator;
6. allow that administrator to invite users and delegate permissions.

An unclaimed directory record must never imply endorsement or participation.

## Hunter Wildlife Rescue demo

The NSW demo may use the official directory entry:

- Official name: Native Animal Trust Fund Inc
- Display name: Hunter Wildlife Rescue
- Area: Newcastle, Cessnock, Maitland and Lake Macquarie local government areas of the Hunter Region

For demonstrations, the operator may act as a simulated volunteer/user within that tenant because it is their familiar local workflow.

The demo must not state or imply that:

- Hunter Wildlife Rescue has adopted Rescue Hub;
- Hunter Wildlife Rescue requested the product;
- the demonstrator is authorised to speak on behalf of Hunter Wildlife Rescue;
- NSW DCCEEW endorses or operates Rescue Hub.

Recommended visible wording:

> Independent Rescue Hub prototype. Demonstration data and roles do not indicate endorsement by Hunter Wildlife Rescue or the NSW Government.

## Directory provenance

Every seeded organisation keeps:

- its official public-directory name;
- an optional display/trading name;
- jurisdiction;
- public area description;
- species speciality;
- aliases;
- source URL;
- source date;
- boundary-data status.

Directory data and tenant-owned operational data remain separate.

## Boundaries

Where DCCEEW GIS polygons are available, Rescue Hub records that an official GIS source is available.

The polygons should be imported and versioned separately from the organisation directory so boundary changes can be tracked without rewriting organisation identity.

Organisations for which only a textual operating area is currently available remain valid directory entries with `TEXT_ONLY` boundary status until a suitable authoritative geometry is obtained.
