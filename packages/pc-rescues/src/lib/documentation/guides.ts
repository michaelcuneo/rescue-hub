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
          "Veterinary clinic staff: receive linked animal handovers and record clinical observations, ready-for-care decisions and confirmed outcomes in a restricted clinic workspace.",
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
            "detail": "The rescuer physically hands over the animal at an approved veterinary clinic, selecting its registered entry in the mobile form. The animal enters that clinic's /vet queue, with its existing identity and history retained."
          },
          {
            "title": "Decision",
            "detail": "Authorised clinic staff can record veterinary assessments, mark the animal ready for care or document confirmed death/euthanasia. Verified telephone callbacks remain available for clinics without accounts."
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
        "title": "Coverage and integrations",
        "intro": "Rescue Hub currently supports NSW operating-area routing using a mapped geographic boundary snapshot. Licensing, organisation coverage and overlap rules require validation for operational adoption. National coverage and regulator-approved exports are planned integrations."
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
            "detail": "In People & access → People, create an invitation and deliberately select independent system permissions, approved specialist rescue training, optional transport permission and management positions. Invitations start without any of these selected; the link takes each user to confirm a new password."
          },
          {
            "title": "Verify access",
            "detail": "Ask each person to sign in, review their assigned chat channels and verify their rescue/transport eligibility."
          },
          {
            "title": "Verify incident routing",
            "detail": "Submit a report and confirm that geographic routing offers the rescue to eligible volunteers in the responsible organisation."
          }
        ]
      },
      {
        "id": "manage",
        "title": "People and access",
        "points": [
          "Invite new users with the correct role and organisation.",
          "Assign independent Rescuer/Carer permissions, verified specialist team qualifications and optional transport permission; trained areas only permit rescue claims when Rescuer access is granted.",
          "Enable or disable users and initiate password reset from the portal; revoke access when someone leaves.",
          "Use audit records to review significant account and operational actions.",
          "Keep platform and authority privileges narrowly assigned to verified administrators.",
          "Volunteers cannot update their own specialist training qualifications. Verify completed training and then assign approved species teams and Rescuer permissions in People & access → People.",
          "Review Invited users in the People directory; authorised administrators can correct addresses and resend invitation links when needed.",
          "People & access separates People, Organisation Positions and Veterinary Clinics. Committee positions do not confer operational access."
        ]
      },
      {
        "id": "clinic-admin",
        "title": "Register clinics and manage clinic staff",
        "steps": [
          {
            "title": "Approve the clinic",
            "detail": "Open Administration → People & access → Veterinary Clinics and register the name, verified full pickup address and geographic coordinates."
          },
          {
            "title": "Invite staff with clinic-only access",
            "detail": "From People, invite Veterinary clinic staff as their only system role and link the account to the specific approved clinic."
          },
          {
            "title": "Verify a physical handover",
            "detail": "The rescuer must select that clinic in their mobile veterinary drop-off form; typing a clinic name alone does not create the animal-to-clinic permission link."
          },
          {
            "title": "Check the restricted workspace",
            "detail": "Have the staff member sign in to /vet and confirm they see only animals currently in that clinic's custody, and can record assessments, ready-for-care updates and confirmed final outcomes."
          }
        ],
        "note": "A veterinary-only account is not a dispatcher, rescuer or general chat member. Clinic identity, address and staff must be independently verified before live use."
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
          "Use training records without real personal information for practice.",
          "Protect caller and reporter contact details when sharing screens or messages.",
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
            "detail": "Submit the pending Phone Report. Online Report is the separate source category for public web/mobile reports; avoid inventing a third public report category."
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
        ],
        "points": [
          "Verified clinics can directly record assessments and decisions through the restricted /vet workspace after a formally linked physical handover.",
          "Organisation dispatchers can continue to record an attributed telephone update for clinics without a portal account, checking existing veterinary records to avoid duplicating the decision."
        ]
      },
      {
        "id": "transport",
        "title": "When AREC calls to arrange collection",
        "steps": [
          {
            "title": "Record the vet's report",
            "detail": "Confirm the correct registered animal and exact physical clinic location. Check whether clinic staff have already recorded the ready-for-care action in /vet before adding a separate telephone update."
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
    "id": "veterinary",
    "title": "Veterinary clinics",
    "audience": "Approved veterinary clinic staff and rescue coordinators",
    "minutes": 8,
    "description": "How approved clinics receive animal handovers, record veterinary assessments and arrange onward care.",
    "sections": [
      {
        "id": "access",
        "title": "Get access to your clinic workspace",
        "intro": "Veterinary clinic accounts use a restricted workspace at /vet, not the general rescue operations dashboard. The responsible rescue organisation must approve the clinic and invite staff first.",
        "steps": [
          {
            "title": "Have your clinic approved",
            "detail": "An organisation administrator opens Administration → People & access → Veterinary Clinics, registers the clinic and verifies its full pickup address and GPS coordinates."
          },
          {
            "title": "Receive your staff invitation",
            "detail": "The administrator invites you through People & access → People with Veterinary clinic staff as the only system role, linked to that one approved clinic."
          },
          {
            "title": "Activate your account",
            "detail": "Follow the secure email invitation, enter and confirm a new password, then sign in. Rescue Hub directs veterinary-only accounts to /vet."
          },
          {
            "title": "Review the clinic queue",
            "detail": "Animals in your care lists only the animals formally handed over to your clinic that are still in its veterinary custody."
          }
        ],
        "note": "Clinic-only staff cannot browse the rescue map, volunteer jobs, organisation chats or other clinics' animal records. A person who also volunteers needs separately approved access through an appropriate account."
      },
      {
        "id": "handover",
        "title": "How an animal reaches the clinic queue",
        "points": [
          "A rescuer identifies the animal in the existing permanent animal record, then records physical transport and drop-off at the clinic.",
          "At handover, the rescuer must select the actual approved veterinary clinic in the mobile form. Merely typing its name as a free-text destination does not grant portal access.",
          "A successful clinic-linked handover records veterinary custody. The original rescue organisation remains responsible for ongoing coordination, with no duplicate animal identity.",
          "Historical or unlinked veterinary drop-offs will not automatically appear to clinic staff.",
          "Once an animal leaves veterinary custody, it leaves the active clinic list; its attributed assessments remain part of the original animal history."
        ]
      },
      {
        "id": "clinical-notes",
        "title": "Record an assessment or treatment",
        "steps": [
          {
            "title": "Choose the correct animal",
            "detail": "From /vet, select the animal under Animals in your care and verify its identity and current information."
          },
          {
            "title": "Open the assessment",
            "detail": "Expand Record veterinary assessment or treatment and enter clinical findings, treatment and relevant care instructions."
          },
          {
            "title": "Save to animal history",
            "detail": "Submit Save assessment to animal history. The update is permanently attributed to the signed-in veterinary staff member and the VET_PORTAL source."
          },
          {
            "title": "Check confirmation",
            "detail": "If the server reports an error or conflicting update, refresh the record and confirm whether your change saved before trying again."
          }
        ],
        "note": "Notes require 3 to 4,000 characters. Rescue Hub is a coordination and audit tool, not a substitute for the clinic's clinical patient-management system."
      },
      {
        "id": "ready",
        "title": "Mark the animal ready for care and collection",
        "steps": [
          {
            "title": "Confirm the clinical decision",
            "detail": "Check that the animal is fit to leave the clinic; note relevant medication, handling restrictions, welfare concerns and pickup instructions."
          },
          {
            "title": "Record ready for care",
            "detail": "Expand Mark ready for care and collection, enter the clinical notes and choose Confirm ready for care."
          },
          {
            "title": "Care offer and pickup request",
            "detail": "The system creates the carer offer and a held transport pickup job at the approved clinic's registered coordinates, linked to the same animal."
          },
          {
            "title": "Wait for formal claims",
            "detail": "A carer formally accepts the animal before a transport-authorised volunteer can self-claim collection. Ready for care does not assign a transporter or transfer physical custody."
          }
        ]
      },
      {
        "id": "outcomes",
        "title": "Record confirmed death or euthanasia",
        "steps": [
          {
            "title": "Verify the outcome",
            "detail": "Only use this for a death or euthanasia that has actually been confirmed by a veterinarian, never as a shortcut to close the case."
          },
          {
            "title": "Choose the outcome",
            "detail": "Expand Record confirmed death or euthanasia and choose Deceased or Euthanised."
          },
          {
            "title": "Document and explicitly confirm",
            "detail": "Provide clinical confirmation and notes, then tick the final-outcome confirmation checkbox before submitting."
          },
          {
            "title": "Review the permanent history",
            "detail": "The final outcome is attributed to clinic staff and cancels outstanding collection work. The animal record is retained for authorised historical review."
          }
        ]
      },
      {
        "id": "privacy",
        "title": "Access boundaries, troubleshooting and emergencies",
        "points": [
          "In the initial implementation, each clinic-only account belongs to exactly one approved clinic within one responsible rescue organisation.",
          "If an expected animal is missing, confirm that the rescuer physically handed it over, selected the registered clinic, and recorded it as At vet; an unlinked free-text destination is not enough.",
          "If a clinical update fails, refresh before retrying. A change in animal custody, a concurrent update or an inactive staff account can prevent the save.",
          "Coordinators can still document verified veterinary telephone callbacks for clinics without portal logins.",
          "Clinical attachments, lab results, signatures, self-service clinic registration, multi-organisation clinic tenancy and formal regulatory integration are not implemented.",
          "For urgent wildlife incidents use established clinical or organisational telephone escalation; do not depend on a portal update or chat notification."
        ]
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
            "detail": "Check your approved Rescuer permission and specialist training teams with your administrator. You cannot add your own qualifications; they can be updated after completing the required training."
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
            "detail": "Confirm pickup only after physically collecting the animal. The original map job disappears but its permanent record remains. Where an initial pickup was recorded in error and the animal was never collected, use the audited correction path instead of leaving a false custody record."
          },
          {
            "title": "Register and update",
            "detail": "Register the animal where needed, correct its identifying information, and record transport and veterinary drop-off milestones."
          }
        ]
      },
      {
        "id": "colours-training",
        "title": "Map colours and training notices",
        "points": [
          "Desktop and Expo map markers share animal-group colours; a smaller dot distinguishes Pending or Assigned status. Colour alone does not prove eligibility.",
          "If a claim requires a species qualification you do not hold, Expo shows a centred, dismissible Training required notice without resizing the map.",
          "Once you have completed additional training, ask your organisation administrator to update your species team and system permissions.",
          "The server checks your active role, availability, training and organisation before accepting a self-claim."
        ]
      },
      {
        "id": "vets",
        "title": "Transport to a vet and follow-up",
        "points": [
          "When handing an animal over, select the actual approved clinic from the mobile list to make it visible in that clinic's restricted workspace. Free-text clinic names alone do not grant access.",
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
          "Transport requires an active organisation account, current availability and explicit transport authorisation granted by an administrator. Neither a specialist rescue team nor the Carer role automatically grants transport permission; safe handling policy still applies.",
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
            "title": "Select an organisation where permitted",
            "detail": "Users with access to multiple organisations can switch their scope. On Expo, Viewing organisation is a compact dropdown opening a dismissible modal, leaving more room for the conversation list."
          },
          {
            "title": "Select a channel",
            "detail": "Choose Conversations or People, then open a permitted organisation channel or start a direct chat with an available organisation member."
          },
          {
            "title": "Talk to the team",
            "detail": "Messages retain sender identity and timestamps. Members show Available, Busy or Offline; busy members do not receive new private messages. Desktop supports Enter to send and Shift+Enter for a new line."
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
          "Chat-specific push alerts, comprehensive moderation and formal retention governance are not yet implemented.",
          "Veterinary-only staff do not appear in the general chats directory and cannot browse organisation channels; record clinical findings through /vet."
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
          "Subsequent transport work references the original animal; it does not create a second animal for the same case.",
          "Approved veterinary drop-off links the existing animal record to a restricted clinic queue; signed-in clinic assessments and decisions use attributed VET_PORTAL provenance."
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
            "detail": "Authorised clinic staff can mark ready for care or record confirmed outcomes directly at /vet. Verified telephone updates remain an alternative for clinics that have not been onboarded."
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
    "description": "Implemented capabilities, operational checks and planned integrations.",
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
          "Existing AppSync/DynamoDB realtime update infrastructure and server-side push notification pathways.",
          "Approved veterinary clinics, restricted vet-only identities, recorded handovers and clinical assessments, care offers and confirmed outcomes at /vet.",
          "Shared desktop/mobile animal-group map colours and workflow markers, mobile training-required claim modals and a compact organisation selector in Expo Chats.",
          "Administration separates People, Organisation Positions and Veterinary Clinics; invites start without permissions, training or transport authorisation, with resend and correction actions."
        ]
      },
      {
        "id": "requires-test",
        "title": "Needs deployment or real-world verification",
        "points": [
          "Source changes are committed but do not prove the AWS stage or Expo Metro bundle currently contains them. Verify deployed revisions before demonstrating new features.",
          "End-to-end physical-device testing of maps, keyboard behaviour, claims, vet callbacks, pickup, custody handover and chat sync is still required.",
          "SES email delivery and social identity provider credentials must be verified in the deployed environment.",
          "Apple/Android native builds, device registration and actual remote push delivery must be tested separately from compilation.",
          "Geographic licensing/coverage boundaries, special-area overlap rules, and the proposed organisation model require real operational sign-off.",
          "Test clinic-only sign-in, clinic A/B isolation, documented handover, assessment, ready-for-care and confirmed outcomes in AWS, including competing updates."
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
          "Production onboarding, reliability testing, operational support and agency/organisation acceptance.",
          "Multi-organisation veterinary clinic tenancy, clinic self-registration, clinical attachments and laboratory results."
        ]
      },
      {
        "id": "walkthrough",
        "title": "Workflow walkthrough",
        "steps": [
          {
            "title": "Start at the overview",
            "detail": "Explain the connected workflow, roles and difference between a map job and an animal record."
          },
          {
            "title": "Create a wildlife report",
            "detail": "Place an incident pin, enter an observation and follow the report into the responsible organisation. Avoid entering unnecessary personal information."
          },
          {
            "title": "Show self-claim and pickup",
            "detail": "Follow an eligible volunteer accepting a rescue and confirming physical collection."
          },
          {
            "title": "Show veterinary follow-up",
            "detail": "Use a registered clinic and vet-only staff account to demonstrate handover, clinical assessment, ready for care and onward transport; use the established phone-call fallback for non-portal clinics."
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
        "intro": "These guides describe the implemented source workflows as at 16 November 2026; deployment and real-device validation remain separate requirements. They are not clinical wildlife-care advice. For critical incidents follow established emergency and organisational procedures."
      }
    ]
  }
];

export const documentationGuideById = new Map(documentationGuides.map(guide => [guide.id, guide]));
