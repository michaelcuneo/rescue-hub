export type DocumentationStep = { title: string; detail: string };
export type DocumentationSection = {
  id: string;
  title: string;
  intro?: string;
  points?: string[];
  steps?: DocumentationStep[];
  note?: string;
};
export type DocumentationGuide = {
  id: string;
  title: string;
  audience: string;
  minutes: number;
  description: string;
  sections: DocumentationSection[];
};
/** Canonical presentation text for the portal guides. Keep statements about
 * production readiness conservative until AWS and real-device validation.
 */
export const documentationGuides: DocumentationGuide[] = [
  {
    "id": "overview",
    "title": "What Rescue Hub does",
    "audience": "Stakeholders and new teams",
    "minutes": 6,
    "description": "The purpose, experience and operating model, explained without technical jargon.",
    "sections": [
      {
        "id": "purpose",
        "title": "One connected rescue, from report to release",
        "intro": "Rescue Hub is an independent wildlife rescue coordination platform designed to connect the public, dispatchers, volunteer rescuers, transporters and wildlife carers. It combines an operational rescue map with a permanent, auditable record for each animal.",
        "points": [
          "Members of the public can report an injured animal without joining a rescue organisation.",
          "GPS coverage identifies the responsible participating organisation; exceptions go to review rather than guessing.",
          "Qualified, available volunteers claim rescue jobs themselves. Dispatch does not routinely assign rescuers.",
          "The rescue disappears from the operational map when the animal is physically collected—not when someone merely claims the job.",
          "The same animal record continues through transport, veterinary care, carer handovers and a final outcome."
        ]
      },
      {
        "id": "people",
        "title": "Who uses it",
        "points": [
          "Public reporters: drop an incident pin, describe what they see and optionally allow contact.",
          "Dispatchers: create incidents from telephone calls, review routing exceptions, record veterinary updates and monitor the rescue queue.",
          "Rescuers: see relevant jobs, self-claim, confirm pickup, correct animal details and document what happened.",
          "Carers: independently accept responsibility for an animal, request transport to their location, record care and final release/outcome.",
          "Transport volunteers: claim pickup and delivery jobs without becoming the long-term carer.",
          "Organisation administrators: manage people, membership, specialist teams and audit activity.",
          "Platform/authority administrators: inspect participating organisations and relevant historical records within authorised oversight scope."
        ]
      },
      {
        "id": "two-records",
        "title": "The distinction that makes the system work",
        "intro": "A rescue job is an action someone must perform. An animal record is the ongoing history of a living animal. They are linked, but they are not the same thing.",
        "points": [
          "Map pins represent current jobs awaiting attendance or collection, rather than every animal still undergoing care.",
          "An animal at a veterinary facility may have no map pin and still be actively registered in care.",
          "A new vet-to-carer transport request creates another map job linked to the same animal—not a second animal record.",
          "Messages coordinate people; formal claims, custody changes, veterinary notes and outcomes remain separately recorded and auditable."
        ]
      },
      {
        "id": "example",
        "title": "A real-world style example",
        "steps": [
          {
            "title": "Report",
            "detail": "A member of the public finds an injured water dragon and reports its location; the relevant organisation receives a pending rescue."
          },
          {
            "title": "Rescue",
            "detail": "An eligible rescuer claims the job, attends and records physical pickup. The original pin disappears."
          },
          {
            "title": "Vet",
            "detail": "The animal is logged as transporting to AREC and dropped off. Its permanent record remains active, off-map."
          },
          {
            "title": "Decision",
            "detail": "AREC calls later. A veterinary-reported euthanasia closes care, or a ready-for-care call creates an offer to carers."
          },
          {
            "title": "Care & transport",
            "detail": "A carer claims responsibility and chooses Transport to me. Another volunteer claims collection from AREC and delivers the animal."
          },
          {
            "title": "Release",
            "detail": "The carer acknowledges handover and continues care until release, death or euthanasia is recorded. The history remains available internally."
          }
        ]
      },
      {
        "id": "why",
        "title": "What this changes for organisations",
        "points": [
          "Less time spent relaying phone calls and manually finding available volunteers.",
          "Clearer visibility of outstanding rescue and transport work, without cluttering the map with animals already in care.",
          "Less ambiguity about who accepted care, who is transporting, and who currently has physical custody.",
          "Shared organisation communication through role- and team-restricted group chats.",
          "An underlying historical dataset that can support reporting and oversight as government requirements are agreed."
        ]
      },
      {
        "id": "scope",
        "title": "Current scope and independence",
        "intro": "Rescue Hub is an evolving independent NSW-oriented demonstration, not an official NPWS, DCCEEW or participating-organisation product. The current geographic routing is based on a demonstration snapshot and requires licensing/coverage validation before live operations. Nationwide support and official NPWS exports are goals, not finished integrations."
      }
    ]
  },
  {
    "id": "administrators",
    "title": "Administrators",
    "audience": "Platform and organisation administrators",
    "minutes": 8,
    "description": "Set up teams, membership, accounts, geographic responsibilities and oversight.",
    "sections": [
      {
        "id": "access",
        "title": "Platform versus organisation administration",
        "points": [
          "Platform administrators oversee participating organisations from the central Administration portal. They do not need to belong to every rescue organisation.",
          "Organisation administrators manage their own members, teams and access, not another organisation's records.",
          "Role, organisation membership, specialist team and current availability are different checks; giving someone the wrong role to make a screen work is not the solution.",
          "Specialist rescue eligibility is distinct from general transport eligibility.",
          "Platform oversight does not allow someone to pretend they performed a physical collection or an acknowledged custody handover."
        ]
      },
      {
        "id": "first-steps",
        "title": "Set up a new organisation",
        "steps": [
          {
            "title": "Check the organisation",
            "detail": "Open Administration → Organisations and verify the organisation entry, identity and correct coverage representation."
          },
          {
            "title": "Inspect operating areas",
            "detail": "Review the Operating areas view and flag missing, outdated or overlapping geographic boundaries before operational use."
          },
          {
            "title": "Invite staff and volunteers",
            "detail": "Use People & access to invite coordinators, dispatchers, rescuers and carers. Select the right organisation, role, membership type and specialist teams."
          },
          {
            "title": "Verify access",
            "detail": "Ask each person to sign in, review their assigned chat channels and verify their rescue/transport eligibility."
          },
          {
            "title": "Test operations",
            "detail": "Run a clearly marked fictional report and check the rescue appears for the appropriate volunteer; confirm no real animal or government data has been represented as live."
          }
        ]
      },
      {
        "id": "manage",
        "title": "People and access",
        "points": [
          "Invite new users with the correct role and organisation.",
          "Assign membership type and specialist team IDs; a reptile carer should see reptile channels and appropriately qualified rescue work.",
          "Enable or disable users and initiate password reset from the portal; revoke access when someone leaves.",
          "Use audit records to review significant account and operational actions.",
          "Keep platform and authority privileges narrowly assigned to verified administrators."
        ]
      },
      {
        "id": "boundaries",
        "title": "Operating areas and reporting",
        "intro": "Public reports are routed from GPS against the available NSW coverage dataset. An exception queue handles overlaps, uncovered locations and routing failures. Do not manually choose a convenient organisation if the polygon match is ambiguous. The existing portal includes a geographic directory view, not a general-purpose licensing-authority editor.",
        "points": [
          "Confirm responsible boundaries with the relevant authorised sources before relying on routing.",
          "Review rescue activity, people and audit information across only the organisations your role permits.",
          "Historical records are designed to support future NPWS reporting; an approved submission schema or government synchronisation is not yet in place."
        ]
      },
      {
        "id": "safety",
        "title": "Administration checklist",
        "points": [
          "Use demonstration-only cases for training.",
          "Keep real client/reporter contact details out of public presentations and chats.",
          "Check that user role, membership and species team are correct before inviting them into live work.",
          "Test actual iPhone/Android push delivery and native maps before operational rollout.",
          "Agree privacy, chat moderation, data retention, emergency escalation and government reporting requirements before production."
        ],
        "note": "A user should not receive unrestricted physical custody actions merely because they have a high-level oversight role."
      }
    ]
  },
  {
    "id": "dispatchers",
    "title": "Dispatchers and coordinators",
    "audience": "Desktop operators",
    "minutes": 7,
    "description": "Answer calls, create and monitor rescues, enter veterinary updates and arrange transport.",
    "sections": [
      {
        "id": "phone-intake",
        "title": "Create a rescue from a telephone call",
        "steps": [
          {
            "title": "Open the map",
            "detail": "On desktop Dispatch, choose New rescue. Search an address or select the exact map location."
          },
          {
            "title": "Describe what the caller knows",
            "detail": "Record the suspected species, injury, location and operational notes. Treat a caller's species or injury description as unverified."
          },
          {
            "title": "Submit",
            "detail": "Create the pending rescue. It appears on the relevant map and eligible available volunteers can receive rescue notifications."
          },
          {
            "title": "Monitor",
            "detail": "Watch pending and assigned work. The volunteer claims the rescue; dispatch does not normally assign a rescuer."
          }
        ]
      },
      {
        "id": "online-intake",
        "title": "Reports submitted by the public",
        "points": [
          "A reporter creates a personal account and drops an incident pin in the web or Expo app.",
          "The server routes the case to a responsible participating organisation using geographic coverage when there is a single valid match.",
          "Ambiguous, missing-coverage or failed dispatch cases remain in the separate exception triage queue at /reports.",
          "Check the original reporter observation before a qualified rescuer confirms the species or injury.",
          "Reporter-to-rescuer messaging and optional calls require the reporter's explicit permission."
        ]
      },
      {
        "id": "updates",
        "title": "Animal Records & Phone Updates",
        "steps": [
          {
            "title": "Open a selected rescue",
            "detail": "From the rescue details panel choose Animal Records & Phone Updates."
          },
          {
            "title": "Choose the registered animal",
            "detail": "Phone updates belong to the permanent animal record, not only to the original map pin."
          },
          {
            "title": "Record a call",
            "detail": "Enter who called, their role (such as veterinarian), the actual information provided, and any callback number only with permission."
          },
          {
            "title": "Take the next action",
            "detail": "A vet-ready animal can be offered to carers and subsequently for pickup; a confirmed veterinary-reported death or euthanasia can complete care."
          }
        ]
      },
      {
        "id": "transport",
        "title": "When AREC calls to arrange collection",
        "steps": [
          {
            "title": "Record the vet's report",
            "detail": "Confirm which registered animal is ready and where it physically is."
          },
          {
            "title": "Offer care",
            "detail": "Create the care offer with the verified veterinary pickup address and coordinates; don't reuse the original injury location."
          },
          {
            "title": "Let the carer claim",
            "detail": "A suitable carer chooses the animal and a private Transport to me destination. The pickup job then becomes visible to eligible transport volunteers."
          },
          {
            "title": "Watch the handover",
            "detail": "The transporter self-claims and confirms physical pickup. The nominated carer acknowledges delivery; the same animal record continues."
          }
        ]
      },
      {
        "id": "limits",
        "title": "What dispatch should not do",
        "points": [
          "Don't assign a rescuer in place of volunteer self-claim.",
          "Don't close an animal merely because the first rescue job or its map pin has disappeared.",
          "Don't treat a group-chat promise as a confirmed care claim or custody transfer.",
          "Don't overwrite a veterinary outcome with an unverified caller statement.",
          "Don't use the old injury location as the veterinary collection point."
        ],
        "note": "Telephone updates to a permanent animal require an existing registered animal. A full provisional phone-note workflow for unregistered sightings is still outstanding."
      }
    ]
  },
  {
    "id": "rescuers",
    "title": "Rescuers",
    "audience": "Volunteer responders on iPhone or Android",
    "minutes": 7,
    "description": "Become available, claim a rescue, record collection and keep the animal history accurate.",
    "sections": [
      {
        "id": "start",
        "title": "Get started",
        "steps": [
          {
            "title": "Sign in",
            "detail": "Use your organisation's invited account, not a public reporter account."
          },
          {
            "title": "Confirm membership",
            "detail": "Check your assigned rescue group and qualifications with your administrator."
          },
          {
            "title": "Set availability",
            "detail": "Open Account/Settings and set availability so normal rescue offers match when you can attend."
          },
          {
            "title": "Enable device location",
            "detail": "Allow foreground location access to view your position and use Mapbox's existing locate control."
          }
        ]
      },
      {
        "id": "claim",
        "title": "Claim and collect a rescue",
        "steps": [
          {
            "title": "Find the job",
            "detail": "Open Rescues → Map or List and read the location, species guess and incident notes."
          },
          {
            "title": "Self-claim",
            "detail": "Accept the job if you're authorised and available. The system prevents two volunteers claiming the same rescue simultaneously."
          },
          {
            "title": "Attend",
            "detail": "Travel to the incident and assess the actual animal and hazard; don't assume the member of the public identified it correctly."
          },
          {
            "title": "Confirm physical pickup",
            "detail": "Tap Animal picked up only after collection. The rescue pin then leaves the operational map, but the history is retained."
          },
          {
            "title": "Register and update",
            "detail": "Register the animal where needed, correct its identifying information, and record transport and veterinary drop-off milestones."
          }
        ]
      },
      {
        "id": "vets",
        "title": "Transport to a vet and follow-up",
        "points": [
          "Record Transporting to veterinary clinic, then Dropped off at veterinary clinic as separate milestones.",
          "An animal at a veterinary facility remains registered even though it is off the active rescue map.",
          "The original animal record continues when a carer or a different transport volunteer later takes over.",
          "Use Animal Records for care notes and acknowledge custody transitions; do not create a duplicate animal just because transport changes."
        ]
      },
      {
        "id": "messages",
        "title": "Coordinate without losing the official record",
        "points": [
          "Use Chats for Reptiles, Birds, Q&A, Trading Post or other channels permitted by your team membership.",
          "Talk with carers or transporters about timing, availability and practical arrangements.",
          "A chat message is not a rescue claim, physical pickup or custody transfer. Complete the formal app actions too.",
          "Public reporter messaging is separate and only available when the reporter opted into contact."
        ],
        "note": "Remote push alerts require a properly signed and configured native build. Keep normal phone escalation for urgent animal welfare incidents."
      }
    ]
  },
  {
    "id": "carers",
    "title": "Wildlife carers",
    "audience": "Carers receiving animals for rehabilitation",
    "minutes": 7,
    "description": "Accept future care without having to collect the animal yourself.",
    "sections": [
      {
        "id": "offer",
        "title": "Claim an animal for care",
        "steps": [
          {
            "title": "Open Care offers",
            "detail": "Look at the animals a veterinary clinic has declared ready for care."
          },
          {
            "title": "Assess capacity",
            "detail": "Only claim an animal if you can provide the appropriate care and facilities."
          },
          {
            "title": "Choose Transport to me",
            "detail": "Select current GPS, workplace, or another searched address for delivery."
          },
          {
            "title": "Confirm the care claim",
            "detail": "Rescue Hub reserves the animal for you, without claiming transport or altering the animal's physical custody."
          }
        ]
      },
      {
        "id": "destination",
        "title": "Choose where the transporter comes",
        "points": [
          "Your current location uses explicit foreground GPS permission; the app does not continuously track your movements.",
          "You can select a workplace or another location if you won't be at home.",
          "Delivery coordinates are not included in the public or general rescue map and aren't shared with everyone browsing group chats.",
          "Only the nominated carer, assigned transporter and authorised coordinators can retrieve the private destination.",
          "You can explicitly update your current GPS delivery position before the transporter physically collects the animal."
        ]
      },
      {
        "id": "handover",
        "title": "Receive and care for the animal",
        "steps": [
          {
            "title": "Wait for a transporter",
            "detail": "A qualified organisation volunteer claims the now-available vet pickup job."
          },
          {
            "title": "Receive the animal",
            "detail": "The transporter records delivery and requests a custody handover to you."
          },
          {
            "title": "Acknowledge",
            "detail": "Accept custody only after you physically receive the animal."
          },
          {
            "title": "Maintain care",
            "detail": "Add husbandry, treatment and progress notes to the same permanent animal record."
          },
          {
            "title": "Record final outcome",
            "detail": "When appropriate, document release back into the wild or another verified terminal outcome."
          }
        ]
      },
      {
        "id": "chats",
        "title": "Use your care-group chat",
        "intro": "Group conversations help coordinate the day-to-day work that can't be automated: who has room, who is working late, and who can collect from a clinic.",
        "points": [
          "Say when you're available or at capacity.",
          "Use Trading Post or Q&A for advice, equipment and practical requests.",
          "Confirm any actual care reservation and animal custody changes inside the structured workflow, not just in conversation."
        ]
      }
    ]
  },
  {
    "id": "transporters",
    "title": "Transport volunteers",
    "audience": "Members collecting and delivering animals",
    "minutes": 6,
    "description": "Deliver an animal to its nominated carer without becoming the carer yourself.",
    "sections": [
      {
        "id": "eligibility",
        "title": "Who can transport",
        "points": [
          "Transport is separate from specialist wildlife rescue qualification.",
          "Eligible active organisation volunteers can claim transport jobs even when they don't care for that species; local handling, safety and welfare policies still apply.",
          "Unaffiliated public reporter accounts cannot claim organisation transport jobs.",
          "The transport job becomes available once a carer has formally claimed the animal and chosen a destination."
        ]
      },
      {
        "id": "pickup",
        "title": "From clinic to carer",
        "steps": [
          {
            "title": "Claim the pickup",
            "detail": "Open Rescues, find the transport job and claim it yourself. The pickup pin is at the veterinary facility."
          },
          {
            "title": "Review delivery",
            "detail": "As the assigned transporter, open the private delivery instructions and directions to the carer."
          },
          {
            "title": "Collect physically",
            "detail": "At the clinic, confirm Animal picked up. Only then does custody move to you and the pickup pin disappear."
          },
          {
            "title": "Deliver",
            "detail": "Take the animal to the nominated address and initiate handover to the reserved carer."
          },
          {
            "title": "Obtain acknowledgement",
            "detail": "The carer accepts custody on actual receipt; this completes the transport job, while their care record remains active."
          }
        ]
      },
      {
        "id": "changes",
        "title": "If plans change",
        "points": [
          "Use the relevant care-group chat to coordinate delays or changes in plans.",
          "Before collection, the carer can refresh their GPS delivery location; refresh your instructions before travelling.",
          "Do not silently deliver to a new address after collecting if circumstances change—coordinate the destination and preserve an accurate transfer record.",
          "Do not register a second animal for a transport job; it points to the existing animal identity."
        ]
      },
      {
        "id": "map",
        "title": "Why the map pin disappears",
        "intro": "The rescue map is a queue of jobs awaiting attendance, not a live location tracker of animals and cars. A claimed job stays on the map until physical collection, then its pin disappears. The animal remains in its permanent record."
      }
    ]
  },
  {
    "id": "communications",
    "title": "Chats and communication",
    "audience": "All organisation members",
    "minutes": 5,
    "description": "Team channels, practical coordination and reporter contact permissions.",
    "sections": [
      {
        "id": "channels",
        "title": "Organisation channels",
        "points": [
          "Administration is for authorised coordinators and administrative roles.",
          "Q&A is a shared place to ask practical questions.",
          "Trading Post supports supplies, equipment and volunteer offers.",
          "Specialist channels such as Reptiles, Birds or other care groups are derived from active team membership.",
          "Platform/authority administrators can select an organisation and access its permitted channels for oversight."
        ]
      },
      {
        "id": "message",
        "title": "How the messenger works",
        "steps": [
          {
            "title": "Open Chats",
            "detail": "On the Expo rescuer app use the Chats tab in the bottom navigation; on desktop open /chats."
          },
          {
            "title": "Select a channel",
            "detail": "You only see channels permitted for your role and active team membership."
          },
          {
            "title": "Talk to the team",
            "detail": "Messages carry sender attribution and timestamps and remain available as channel history."
          },
          {
            "title": "Review updates",
            "detail": "Unread indicators and live-change refresh help the whole team stay coordinated."
          }
        ]
      },
      {
        "id": "example",
        "title": "Example: a reptile at AREC",
        "intro": "A carer can write 'I can care for this reptile, but I'm at work until late.' Another volunteer may offer to collect it. The carer then completes the separate formal care reservation and Transport to me request, and the transporter formally claims pickup.",
        "points": [
          "The automated transport notice can reference the animal and clinic without disclosing private delivery coordinates.",
          "Conversation is useful for timing and capacity but does not create a legal or operational custody change.",
          "For urgent welfare incidents use established emergency contact procedures; chat delivery alone is not guaranteed to be immediate."
        ]
      },
      {
        "id": "privacy",
        "title": "Privacy and moderation boundaries",
        "points": [
          "Organisation chats are not available to unaffiliated members of the public.",
          "Only the current assigned rescuer may communicate privately with a public reporter when the reporter opted into that contact.",
          "Do not share reporter phone numbers, residential addresses or sensitive animal information broadly in group channels.",
          "Chat-specific push alerts, comprehensive moderation and formal retention governance are not yet implemented."
        ]
      }
    ]
  },
  {
    "id": "records",
    "title": "Animal records and outcomes",
    "audience": "Dispatchers, rescuers, carers and oversight",
    "minutes": 7,
    "description": "Understand what stays on the map, what stays in history, and what must be recorded.",
    "sections": [
      {
        "id": "identity",
        "title": "One animal, one continuing history",
        "points": [
          "An initial report is an observation; the registered animal is the continuing record once a rescuer identifies it.",
          "A rescue response and each later transport pickup have their own operational job IDs.",
          "The animal record holds its ID, species and corrections, current status and custodian, call notes, progress milestones, transfers, outcomes and timestamps.",
          "Subsequent transport work references the original animal; it does not create a second animal for the same case."
        ]
      },
      {
        "id": "statuses",
        "title": "How the lifecycle works",
        "points": [
          "Pending rescue → self-claimed rescue → physically collected (off-map).",
          "In rescue or in transit → at veterinarian → assessed/awaiting transport.",
          "Carer reservation → new pending transport pickup at vet → transporter claimed and collected (off-map).",
          "Acknowledged delivery → in care with nominated carer.",
          "Final outcome → released, deceased or euthanised; this closes the animal's active care.",
          "The original incident with multiple registered animals is not finally closed until all relevant animal outcomes are complete."
        ]
      },
      {
        "id": "calls",
        "title": "Telephone updates belong in the animal record",
        "steps": [
          {
            "title": "Identify the animal",
            "detail": "Find the correct registered animal before recording a phone call."
          },
          {
            "title": "Record attribution",
            "detail": "Note who called, their role, the information they provided and the timestamp."
          },
          {
            "title": "Respect permission",
            "detail": "Retain callback details only with the caller's explicit permission."
          },
          {
            "title": "Record the outcome or action",
            "detail": "A veterinary ready-for-pickup call may lead to a care offer. A confirmed vet-reported euthanasia or death is a terminal outcome."
          }
        ]
      },
      {
        "id": "government",
        "title": "Reporting and oversight",
        "intro": "The record structure is being designed to give organisations and NSW wildlife regulators a reliable view of rescue volume, locations, species, care pathways and final outcomes.",
        "points": [
          "Material changes are recorded in the internal animal/event and audit history.",
          "The Administration portal shows organisation, rescue, user and audit information within authorised scope.",
          "An official NPWS/DCCEEW export, submission schema and integration have not yet been verified or implemented.",
          "Retention periods, consent and access policies must be agreed before presenting this as a compliant regulatory archive."
        ]
      },
      {
        "id": "warning",
        "title": "Do not confuse visible jobs with active care",
        "intro": "The absence of a map pin means there is no current response job at that location. It does not mean the animal was released, died or ceased to exist in the system."
      }
    ]
  },
  {
    "id": "readiness",
    "title": "What is built and what is next",
    "audience": "Reviewers, administrators and decision-makers",
    "minutes": 5,
    "description": "An accurate implementation and verification status for demonstrations and adoption planning.",
    "sections": [
      {
        "id": "implemented",
        "title": "Implemented in the codebase",
        "points": [
          "SvelteKit dispatch map, rescue list, basic intake and administration portal.",
          "Own-account public reporting with email verification and configurable Google, Apple and Facebook sign-in.",
          "NSW snapshot-based geographic routing with exceptions held for triage.",
          "Self-claimed rescues and independent carer/transport work offers, GPS destinations and acknowledged custody handovers.",
          "Permanent animal history, veterinary phone updates, recorded outcomes and multi-animal case handling.",
          "GeoJSON-rendered Mapbox rescue markers and mobile keyboard handling improvements.",
          "Organisation group chats across desktop and Expo, including channel permissions and chat history.",
          "Existing AppSync/DynamoDB realtime update infrastructure and server-side push notification pathways."
        ]
      },
      {
        "id": "requires-test",
        "title": "Needs deployment or real-world verification",
        "points": [
          "The latest source changes have passed GitHub CI but do not prove the running AWS stage has those changes deployed.",
          "End-to-end physical-device testing of maps, keyboard behaviour, claims, vet callbacks, pickup, custody handover and chat sync is still required.",
          "SES email delivery and social identity provider credentials must be verified in the deployed environment.",
          "Apple/Android native builds, device registration and actual remote push delivery must be tested separately from compilation.",
          "Geographic licensing/coverage boundaries, special-area overlap rules, and the proposed organisation model require real operational sign-off."
        ]
      },
      {
        "id": "planned",
        "title": "Not yet a finished production capability",
        "points": [
          "An NPWS/DCCEEW-approved reporting export or automated government system integration.",
          "National rollout and verified authoritative geographic coverage across Australian jurisdictions.",
          "Comprehensive chat moderation, chat push notifications and agreed data-retention policies.",
          "A complete provisional telephone-event workflow before an animal is registered.",
          "Production onboarding, reliability testing, operational support and agency/organisation acceptance."
        ]
      },
      {
        "id": "demo",
        "title": "How to demonstrate responsibly",
        "steps": [
          {
            "title": "Start at the overview",
            "detail": "Explain the connected workflow, roles and difference between a map job and an animal record."
          },
          {
            "title": "Use fictional animals",
            "detail": "Create a clearly labelled test report in the demonstration area. Avoid using real phone numbers, addresses or injured wildlife."
          },
          {
            "title": "Show self-claim and pickup",
            "detail": "Demonstrate an eligible volunteer accepting a rescue and confirming collection."
          },
          {
            "title": "Show veterinary follow-up",
            "detail": "Record a fictional AREC call, open a care offer and arrange independent transport to a carer."
          },
          {
            "title": "Finish with oversight",
            "detail": "Show the animal history, organisation channels, and audit information. Explain which regulatory exports remain future work."
          }
        ]
      },
      {
        "id": "support",
        "title": "Support and limitations",
        "intro": "The documentation describes the current codebase as at 11 November 2026. It is not clinical wildlife-care advice, a guarantee of push delivery, or proof of government approval. If a critical operation fails, use established emergency and organisational procedures rather than relying on a prototype."
      }
    ]
  }
];

export const documentationGuideById = new Map(documentationGuides.map(guide => [guide.id, guide]));
