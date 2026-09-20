# Rescue Hub Product Vision

## Purpose

Rescue Hub is a software-as-a-service platform for wildlife rescue operations.

Its purpose is to give independent wildlife rescue organisations a common operational system without removing the geographic and organisational boundaries under which those organisations work.

A rescue should be able to move from a phone call to a mapped, assigned and fully recorded case in seconds.

At the same time, the appropriate government wildlife authority should be able to see an auditable record of wildlife rescue activity across all participating organisations within its jurisdiction.

## The problem

Wildlife rescue organisations operate within defined geographic areas.

A local organisation is responsible for wildlife incidents inside its authorised region. Other organisations may operate immediately beside it, but their rescuers should not simply cross organisational boundaries and take cases from another organisation's area.

For example, Rescue Hub is being developed with organisations such as Hunter Wildlife Rescue in mind, alongside neighbouring rescue organisations such as WIRES and organisations operating in other regions.

The operational rules are substantially derived from the same government wildlife policy and permit framework. The software therefore should not create a completely different system for every organisation. Instead, Rescue Hub should provide one common platform with:

- shared policy and case structures;
- separate organisational authority;
- explicit geographic coverage boundaries;
- common rescue and outcome records;
- central oversight by the appropriate wildlife authority.

For the NSW implementation and demonstration, the regulatory model is the NSW Department of Climate Change, Energy, the Environment and Water (DCCEEW), particularly its Biodiversity and Heritage Regulator and Wildlife Team. The NSW National Parks and Wildlife Service (NPWS) is a NSW state service within DCCEEW; despite the word “National” in its name, it is not an Australia-wide federal wildlife authority. An Australia-wide deployment must therefore represent the relevant state or territory authority for each jurisdiction.

## Product model

Rescue Hub is a multi-tenant enterprise SaaS.

There are two main operational layers.

### Governing authority

An authorised governing body can view activity across all participating organisations in its jurisdiction.

This view is intended to provide a complete operational and historical record, including:

- what animal was reported;
- when the rescue was reported;
- where the animal was located;
- which organisation owned the rescue;
- which rescuer accepted or was assigned to it;
- significant case events;
- the final outcome;
- whether an animal was released, transferred, entered care, died or was euthanised;
- where applicable, who performed or authorised euthanasia;
- timestamps and audit history for material changes.

The governing layer is oversight, not a mechanism for silently collapsing all organisations into one unrestricted tenant.

### Regional rescue organisation

Each rescue organisation has its own:

- identity;
- authorised geographic coverage;
- members;
- dispatchers;
- rescuers/carers;
- operational configuration;
- rescue cases;
- availability roster.

Organisation users must only have access to data their role and organisation permit, except where an explicit inter-organisation workflow is later introduced.

The baseline rules and regulations should be centrally represented wherever possible rather than copied and independently maintained for every organisation.

## Core experience

### Dispatcher

A dispatcher may be sitting at a desktop computer answering rescue calls.

A caller might say that an injured possum is at a particular address.

The dispatcher should be able to:

1. find the address or position on the map;
2. drop or adjust a rescue pin;
3. enter the animal and incident details;
4. submit the rescue;
5. immediately make that rescue visible to eligible rescuers in the responsible region.

Creating a rescue should be extremely fast. The dispatcher should not need to navigate a large administrative form to create the initial incident.

Information can be enriched as the case progresses.

### Rescuer/carer

An eligible rescuer in the responsible organisation should be able to see new rescues relevant to their region and availability.

The interaction should feel closer to dispatch or ride-sharing software than a traditional case-management database:

- a rescue appears at its mapped location;
- eligible available rescuers can see it quickly;
- a rescuer can accept/claim the rescue;
- the assignment becomes visible to other users immediately;
- duplicate responders are prevented;
- the case progresses through a defined lifecycle.

### Availability

Users must be able to declare when they are available.

Availability may include:

- recurring days or times;
- temporary unavailability;
- holidays;
- manually going on/off duty.

A person who is unavailable should not receive normal rescue notifications during that period.

Availability affects notification and dispatch eligibility. It does not delete the person's membership or historical involvement in previous cases.

## Regional boundaries

Geographic jurisdiction is a first-class domain concept.

A rescue location must resolve to an organisation/coverage region before normal dispatch.

The platform must be able to model coverage areas as geographic boundaries rather than relying on human memory or a free-text suburb field.

The system should prevent accidental dispatch into another organisation's area and make boundary conflicts explicit.

Future versions may support formal handoff or cross-border cooperation, but that must be an intentional workflow with an audit trail rather than an unrestricted visibility bypass.

## National record

A long-term objective is to create a consistent digital record of wildlife rescue activity.

With appropriate government participation and permissions, Rescue Hub should make it possible to understand:

- rescue volumes by region and species;
- location and time trends;
- outcomes;
- mortality and euthanasia;
- transfers and care;
- responder activity;
- operational demand;
- recurring wildlife hazards or hotspots.

This dataset is operationally sensitive. Access must therefore be governed by role, organisation, jurisdiction and legitimate purpose.

## Government-system integration

The current product should not depend on an external government API in order to demonstrate the core workflow.

However, the architecture must leave a clean integration boundary for existing government wildlife systems.

The intended sequence is:

1. demonstrate Rescue Hub as a functioning independent system;
2. validate the workflow with wildlife rescue organisations and relevant government colleagues;
3. identify the authoritative NSW DCCEEW/Biodiversity and Heritage Regulator system or integration mechanism for the NSW implementation;
4. map Rescue Hub identifiers and case fields to the government system;
5. add synchronisation without coupling the user interface directly to the external API.

Integration should occur server-side through a dedicated adapter/service layer.

## Product principles

1. **Region is authority.** Geographic responsibility cannot be treated as a cosmetic filter.
2. **Tenant boundaries are enforced server-side.** Hiding data in the UI is not access control.
3. **Dispatch must be fast.** A rescue call should become an actionable map event with minimal friction.
4. **Availability is respected.** Off-duty carers should not be unnecessarily interrupted.
5. **The case history is durable.** Material actions and outcomes need an audit trail.
6. **Government oversight is broader than organisation access, not equivalent to a global super-user UI.**
7. **Shared rules should be centralised.** Common regulatory requirements should not drift between tenant copies.
8. **Sensitive information is minimised.** Rescue, caller, address and user data should only be exposed where operationally necessary.
9. **External integrations are adapters.** Rescue Hub remains usable if a third-party government service is temporarily unavailable.
10. **The product remains operationally simple.** Complexity belongs in the platform rules, not in the dispatcher's workflow.


## Verified NSW regulatory context

As of September 2026, the current NSW operating context relevant to Rescue Hub is:

- NSW National Parks and Wildlife Service (NPWS) is a NSW state service within DCCEEW, not a national Australian agency.
- Wildlife rehabilitation in NSW is regulated primarily through the Biodiversity Conservation Act 2016 and Biodiversity Conservation Regulation 2017.
- The Biodiversity and Heritage Regulator administers wildlife licensing and management functions.
- Current wildlife rehabilitation licence conditions recognise an allocated geographic zone of operation for rehabilitation groups.
- Wildlife rehabilitation providers must maintain records of animals they rescue and submit prescribed records annually to the Biodiversity and Heritage Regulator.
- Species-specific and general codes of practice set minimum standards for rescue, rehabilitation and release.

These requirements strongly support Rescue Hub's proposed regional-tenancy, audit-history and central-reporting model.

Primary references:

- https://www.nationalparks.nsw.gov.au/about-npws
- https://www.environment.nsw.gov.au/about-us/policy-and-law/biodiversity-and-heritage-regulator
- https://www.environment.nsw.gov.au/topics/animals-and-plants/native-animals/rehabilitating-native-animals/wildlife-rehabilitation-licences
- https://www.environment.nsw.gov.au/topics/animals-and-plants/native-animals/rehabilitating-native-animals/wildlife-rehabilitation-data-and-reporting/reporting
