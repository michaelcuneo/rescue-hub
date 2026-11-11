import { putSeedItem } from "./seed";
import { buildHunterDemoStory } from "../core/demo-rescue-stories";

const HUNTER_ORG = "native-animal-trust-fund";
const S = (value: string) => ({ S: value });
const N = (value: number) => ({ N: String(value) });
const B = (value: boolean) => ({ BOOL: value });
const L = (values: string[]) => ({ L: values.map(S) });

// Pulumi TableItem takes DynamoDB AttributeValues rather than document values.
// Keep fixture conversion local and never convert arbitrary application data.
const demoAttribute = (value: string | number | boolean) =>
  typeof value === "string" ? S(value) : typeof value === "number" ? N(value) : B(value);
const demoItem = (value: Record<string, string | number | boolean>) =>
  Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, demoAttribute(entry)]));

const put = putSeedItem;

const demoMembership: Record<string, { membershipTypeId: string; teamIds: string[]; availabilityStatus: string }> = {
  "demo-hunter-priya-shah": { membershipTypeId: "active-rescuer", teamIds: ["bird", "possum-glider"], availabilityStatus: "AVAILABLE" },
  "demo-hunter-alex-mercer": { membershipTypeId: "support-member", teamIds: ["transport"], availabilityStatus: "AVAILABLE" },
  "demo-hunter-jordan-blake": { membershipTypeId: "active-rescuer", teamIds: ["macropod", "reptile-non-venomous"], availabilityStatus: "AVAILABLE" },
  "demo-hunter-sam-nguyen": { membershipTypeId: "active-rescuer", teamIds: ["bird", "bat-flying-fox"], availabilityStatus: "AVAILABLE" },
  "demo-hunter-casey-morgan": { membershipTypeId: "active-rescuer", teamIds: ["bird", "possum-glider", "transport"], availabilityStatus: "AVAILABLE" },
  "demo-hunter-taylor-brooks": { membershipTypeId: "active-rescuer", teamIds: ["macropod"], availabilityStatus: "BUSY" },
  "demo-hunter-riley-chen": { membershipTypeId: "active-rescuer", teamIds: ["reptile-non-venomous", "reptile-venomous", "bird"], availabilityStatus: "AVAILABLE" },
  "demo-hunter-jamie-foster": { membershipTypeId: "active-rescuer", teamIds: ["macropod", "possum-glider"], availabilityStatus: "AVAILABLE" },
  "demo-hunter-erin-walsh": { membershipTypeId: "carer", teamIds: ["possum-glider", "bird"], availabilityStatus: "OFFLINE" },
  "demo-hunter-dana-price": { membershipTypeId: "support-member", teamIds: [], availabilityStatus: "OFFLINE" }
};

const people = [
  ["demo-hunter-priya-shah", "Priya Shah", ["ORG_ADMIN","DISPATCHER"], "Merewether"],
  ["demo-hunter-alex-mercer", "Alex Mercer", ["DISPATCHER"], "Newcastle"],
  ["demo-hunter-jordan-blake", "Jordan Blake", ["RESCUER"], "Wallsend"],
  ["demo-hunter-sam-nguyen", "Sam Nguyen", ["RESCUER"], "Charlestown"],
  ["demo-hunter-casey-morgan", "Casey Morgan", ["RESCUER","CARER"], "Belmont"],
  ["demo-hunter-taylor-brooks", "Taylor Brooks", ["RESCUER"], "Maitland"],
  ["demo-hunter-riley-chen", "Riley Chen", ["RESCUER"], "Cardiff"],
  ["demo-hunter-jamie-foster", "Jamie Foster", ["RESCUER"], "Cessnock"],
  ["demo-hunter-erin-walsh", "Erin Walsh", ["CARER"], "Toronto"],
  ["demo-hunter-dana-price", "Dana Price", ["DATA_STEWARD"], "Lambton"],
] as const;

for (const [id, name, roles, suburb] of people) {
  const dispatch = demoMembership[id] ?? { membershipTypeId: "support-member", teamIds: [], availabilityStatus: "OFFLINE" };
  put(`DemoUser-${id}`, {
    pk: S(`USER#${id}`),
    sk: S("PROFILE"),
    entity: S("user"),
    id: S(id),
    email: S(`${id}@demo.rescuehub.example`),
    name: S(name),
    enabled: B(true),
    status: S("ACTIVE"),
    emailVerified: B(true),
    authEpoch: N(0),
    organisationId: S(HUNTER_ORG),
    roles: L([...roles]),
    membershipTypeId: S(dispatch.membershipTypeId),
    teamIds: L(dispatch.teamIds),
    availabilityStatus: S(dispatch.availabilityStatus),
    demo: B(true),
    suburb: S(suburb),
    createdAt: S("2026-09-01T00:00:00.000Z"),
    updatedAt: S("2026-09-21T03:00:00.000Z"),
    gsi1pk: S(`ORG#${HUNTER_ORG}#USERS`),
    gsi1sk: S(`${name.toLowerCase()}#${id}`),
    gsi2pk: S("USERS"),
    gsi2sk: S(`${name.toLowerCase()}#${id}`),
  });

  put(`DemoMembership-${id}`, {
    pk: S(`USER#${id}`),
    sk: S("MEMBERSHIP"),
    entity: S("membership"),
    userId: S(id),
    organisationId: S(HUNTER_ORG),
    roles: L([...roles]),
    membershipTypeId: S(dispatch.membershipTypeId),
    teamIds: L(dispatch.teamIds),
    availabilityStatus: S(dispatch.availabilityStatus),
    status: S("ACTIVE"),
    demo: B(true),
    createdAt: S("2026-09-01T00:00:00.000Z"),
    updatedAt: S("2026-09-21T03:00:00.000Z")
  });
}

const rescues = [
  ["001","Magpie","Australian magpie","Broadmeadow",-32.9239,151.7343,"Unable to fly after suspected window strike","PENDING",""],
  ["002","Possum","Common brushtail","Mayfield",-32.8971,151.7368,"Adult found beside road, moving slowly","PENDING",""],
  ["003","Lorikeet","Rainbow lorikeet","Adamstown",-32.9382,151.7254,"Possible wing injury, grounded in backyard","PENDING",""],
  ["004","Blue-tongue lizard","Eastern blue-tongue","Lambton",-32.9136,151.7069,"Caught in garden netting","PENDING",""],
  ["005","Kangaroo","Eastern grey","Kurri Kurri",-32.8194,151.4801,"Juvenile separated from mob near roadside","PENDING",""],
  ["006","Kookaburra","Laughing kookaburra","Charlestown",-32.9686,151.6932,"Fishing line tangled around leg","ASSIGNED","demo-hunter-sam-nguyen"],
  ["007","Flying fox","Grey-headed flying fox","Carrington",-32.9152,151.7668,"Hanging low in tree, possible wing injury","ASSIGNED","demo-hunter-sam-nguyen"],
  ["008","Kangaroo","Eastern grey","Cessnock",-32.8391,151.3517,"Vehicle strike, conscious and stationary","ASSIGNED","demo-hunter-jamie-foster"],
  ["009","Possum","Common ringtail","Cardiff",-32.9418,151.6554,"Cat attack, minor visible wounds","ASSIGNED","demo-hunter-riley-chen"],
  ["010","Echidna","Short-beaked echidna","East Maitland",-32.7519,151.5885,"Disoriented near busy road","ASSIGNED","demo-hunter-jordan-blake"],
  ["011","Pelican","Australian pelican","Swansea",-33.0872,151.6374,"Fishing hook removed; transported for assessment","COMPLETED","demo-hunter-casey-morgan"],
  ["012","Magpie","Australian magpie","Wallsend",-32.9019,151.6727,"Juvenile found grounded; parents located nearby","COMPLETED","demo-hunter-jordan-blake"],
  ["013","Possum","Common brushtail","Belmont",-33.0332,151.6609,"Found in garage after overnight entrapment","COMPLETED","demo-hunter-casey-morgan"],
  ["014","Tawny frogmouth","Tawny frogmouth","Merewether",-32.9471,151.7461,"Stunned after collision with glass balustrade","COMPLETED","demo-hunter-sam-nguyen"],
  ["015","Water dragon","Eastern water dragon","Toronto",-33.0133,151.5921,"Minor tail injury after dog encounter","COMPLETED","demo-hunter-riley-chen"],
] as const;

// Additional fictional cases give the demonstration a realistic, varied dispatch workload.
// All identities, incidents, locations and outcomes below are synthetic.
const extraCases = [
  ["016","Koala","Koala","Blackbutt",-32.942,151.700,"Found at base of eucalyptus, lethargic","PENDING",""],
  ["017","Tawny frogmouth","Tawny frogmouth","Hamilton",-32.925,151.749,"Possible vehicle strike near roundabout","PENDING",""],
  ["018","Microbat","Little bent-winged bat","New Lambton",-32.929,151.711,"Bat found indoors; specialist handling required","PENDING",""],
  ["019","Wombat","Common wombat","Beresfield",-32.802,151.658,"Wombat near roadside, possible injury","PENDING",""],
  ["020","Sea turtle","Green turtle","Stockton",-32.907,151.784,"Stranded animal reported on beach","PENDING",""],
  ["021","Eastern water dragon","Eastern water dragon","Warners Bay",-32.973,151.645,"Entangled in discarded fishing line","PENDING",""],
  ["022","Australian magpie","Australian magpie","Islington",-32.915,151.744,"Adult bird unable to stand after collision","PENDING",""],
  ["023","Ringtail possum","Common ringtail possum","Kotara",-32.944,151.695,"Juvenile discovered on ground without adult","PENDING",""],
  ["024","Pelican","Australian pelican","Speers Point",-32.964,151.627,"Fishing tackle visible near beak","PENDING",""],
  ["025","Echidna","Short-beaked echidna","Jesmond",-32.904,151.692,"Animal trapped in drainage channel","PENDING",""],
  ["026","Grey-headed flying fox","Grey-headed flying fox","Newcastle East",-32.930,151.786,"Flying fox caught in backyard netting; specialist required","ASSIGNED","demo-hunter-sam-nguyen"],
  ["027","Rainbow lorikeet","Rainbow lorikeet","Merewether",-32.949,151.750,"Wing injury following window strike","ASSIGNED","demo-hunter-priya-shah"],
  ["028","Eastern grey kangaroo","Eastern grey kangaroo","Thornton",-32.780,151.642,"Roadside rescue with joey reported","ASSIGNED","demo-hunter-jordan-blake"],
  ["029","Blue-tongue skink","Eastern blue-tongued skink","Cardiff",-32.942,151.655,"Caught beneath garden fencing","ASSIGNED","demo-hunter-riley-chen"],
  ["030","Common brushtail possum","Common brushtail possum","Lambton",-32.913,151.707,"Adult possum found in roof cavity","ASSIGNED","demo-hunter-casey-morgan"],
  ["031","Kookaburra","Laughing kookaburra","Wallsend",-32.902,151.673,"Bird with suspected leg fracture","ASSIGNED","demo-hunter-priya-shah"],
  ["032","Australian wood duck","Australian wood duck","Maitland",-32.733,151.558,"Duckling separated from family group","ASSIGNED","demo-hunter-jamie-foster"],
  ["033","Sugar glider","Sugar glider","Charlestown",-32.968,151.693,"Small glider rescued from garage","ASSIGNED","demo-hunter-casey-morgan"],
  ["034","Sulphur-crested cockatoo","Sulphur-crested cockatoo","Belmont",-33.033,151.660,"Suspected beak trauma","ASSIGNED","demo-hunter-sam-nguyen"],
  ["035","Eastern long-necked turtle","Eastern long-necked turtle","Edgeworth",-32.925,151.621,"Animal found crossing busy road","ASSIGNED","demo-hunter-riley-chen"],
  ["036","Australian magpie","Australian magpie","Mayfield",-32.897,151.736,"Reunited fledgling with nearby parents","COMPLETED","demo-hunter-priya-shah"],
  ["037","Common brushtail possum","Common brushtail possum","Hamilton South",-32.940,151.750,"Assessed and transferred to licensed carer","COMPLETED","demo-hunter-casey-morgan"],
  ["038","Rainbow lorikeet","Rainbow lorikeet","New Lambton",-32.929,151.711,"Transported to wildlife veterinarian","COMPLETED","demo-hunter-sam-nguyen"],
  ["039","Eastern water dragon","Eastern water dragon","Toronto",-33.013,151.592,"Released at safe habitat after assessment","COMPLETED","demo-hunter-riley-chen"],
  ["040","Short-beaked echidna","Short-beaked echidna","Cessnock",-32.839,151.352,"Moved away from roadside hazard","COMPLETED","demo-hunter-jamie-foster"],
  ["041","Tawny frogmouth","Tawny frogmouth","The Junction",-32.938,151.758,"Transferred to rehabilitation for observation","COMPLETED","demo-hunter-priya-shah"],
  ["042","Eastern grey kangaroo","Eastern grey kangaroo","Kurri Kurri",-32.819,151.480,"Joey safely transferred into specialist care","COMPLETED","demo-hunter-jordan-blake"],
  ["043","Laughing kookaburra","Laughing kookaburra","Adamstown",-32.938,151.725,"Recovered from temporary entanglement","COMPLETED","demo-hunter-sam-nguyen"],
  ["044","Common ringtail possum","Common ringtail possum","Birmingham Gardens",-32.894,151.691,"Orphaned juvenile admitted into care","COMPLETED","demo-hunter-casey-morgan"],
  ["045","Australian pelican","Australian pelican","Swansea",-33.087,151.637,"Hook removed and animal transported for assessment","COMPLETED","demo-hunter-riley-chen"]
] as const;

const allDemoRescues = [...rescues, ...extraCases];

allDemoRescues.forEach((r, index) => {
  const [n,type,breed,location,latitude,longitude,injury,status,assignedUserId] = r;
  const id = `demo-hunter-rescue-${n}`;
  const at = new Date(Date.UTC(2026, 10, 5, 9, 0) - index * 17 * 60_000).toISOString();

  // The detailed care histories belong to the demo stack ONLY. Do not add
  // synthetic treatment, custody or outcomes to non-demo deployments.
  const story = $app.stage === "demo" && (status === "ASSIGNED" || status === "COMPLETED")
    ? buildHunterDemoStory({ id, type, breed, location, assignedUserId, status })
    : null;
  const createdAt = story?.createdAt ?? at;
  const updatedAt = story?.updatedAt ?? at;
  const item: Record<string, unknown> = {
    pk: S(`RESCUE#${id}`), sk: S("META"), entity: S("rescue"), id: S(id),
    organisationId: S(HUNTER_ORG), type: S(type), breed: S(breed), location: S(location),
    latitude: N(latitude), longitude: N(longitude), injury: S(injury), status: S(status),
    demo: B(true), intakeSource: S("PHONE"), createdAt: S(createdAt), updatedAt: S(updatedAt),
    gsi1pk: S(`STATUS#${status}`), gsi1sk: S(`${updatedAt}#${id}`),
    gsi2pk: S("RESCUES"), gsi2sk: S(`${updatedAt}#${id}`),
  };
  if (assignedUserId) item.assignedUserId = S(assignedUserId);
  if (story?.pickedUpAt) item.pickedUpAt = S(story.pickedUpAt);
  if (story) {
    item.animalCount = N(1);
    item.animalStatus = S(String(story.animal.status));
  }
  put(`DemoRescue-${id}`, item);

  if (story) {
    put(`DemoStoryAnimal-${n}`, demoItem(story.animal));
    for (const [i, event] of story.events.entries()) {
      put(`DemoStoryEvent-${n}-${String(i).padStart(2, "0")}`, demoItem(event));
    }
  }
});


const auditEvents = [
  ["001","RESCUE_CREATED","Magpie rescue reported in Broadmeadow","demo-hunter-alex-mercer","2026-09-21T03:17:00.000Z"],
  ["002","RESCUE_CREATED","Possum rescue reported in Mayfield","demo-hunter-priya-shah","2026-09-21T03:06:00.000Z"],
  ["003","RESCUE_ASSIGNED","Kookaburra rescue assigned to Sam Nguyen","demo-hunter-priya-shah","2026-09-21T03:03:00.000Z"],
  ["004","RESCUE_ASSIGNED","Flying fox rescue assigned to Sam Nguyen","demo-hunter-alex-mercer","2026-09-21T02:46:00.000Z"],
  ["005","RESCUE_ASSIGNED","Kangaroo rescue assigned to Jamie Foster","demo-hunter-priya-shah","2026-09-21T02:22:00.000Z"],
  ["006","RESCUE_COMPLETED","Pelican rescue completed and transferred for observation","demo-hunter-casey-morgan","2026-09-21T02:18:00.000Z"],
  ["007","RESCUE_ASSIGNED","Possum rescue assigned to Riley Chen","demo-hunter-alex-mercer","2026-09-21T02:09:00.000Z"],
  ["008","RESCUE_ASSIGNED","Echidna rescue assigned to Jordan Blake","demo-hunter-priya-shah","2026-09-21T01:55:00.000Z"],
  ["009","RESCUE_COMPLETED","Magpie juvenile reunited with parents","demo-hunter-jordan-blake","2026-09-21T01:37:00.000Z"],
  ["010","AVAILABILITY_CHANGED","Sam Nguyen marked available for rescue dispatch","demo-hunter-sam-nguyen","2026-09-21T01:18:00.000Z"],
] as const;

for (const [n, action, summary, actorUserId, createdAt] of auditEvents) {
  const id = `demo-hunter-audit-${n}`;
  put(`DemoAudit-${id}`, {
    pk: S(`AUDIT#${id}`),
    sk: S("EVENT"),
    entity: S("audit_event"),
    id: S(id),
    organisationId: S(HUNTER_ORG),
    action: S(action),
    summary: S(summary),
    actorUserId: S(actorUserId),
    demo: B(true),
    createdAt: S(createdAt),
    gsi2pk: S("AUDIT"),
    gsi2sk: S(`${createdAt}#${id}`),
  });
}


const hunterMembershipTypes = [
  ["active-rescuer","Active rescuer","Field rescuer eligible for team dispatch"],
  ["probationary-rescuer","Probationary rescuer","Field rescuer operating with organisation restrictions"],
  ["carer","Carer","Wildlife carer receiving animals after rescue"],
  ["transport-volunteer","Transport volunteer","Volunteer transporting wildlife between rescue, vet and care"],
  ["support-member","Support member","Organisation member without routine rescue dispatch"]
] as const;

for (const [id, name, description] of hunterMembershipTypes) {
  put(`DemoHunterMembershipType-${id}`, {
    pk: S(`ORG#${HUNTER_ORG}`),
    sk: S(`MEMBERSHIP_TYPE#${id}`),
    entity: S("membership_type"),
    id: S(id),
    name: S(name),
    description: S(description),
    active: B(true),
    updatedAt: S("2026-09-21T03:00:00.000Z")
  });
}

const hunterTeams = [
  ["bird","Bird team","BIRD",false],
  ["raptor","Raptor team","RAPTOR",false],
  ["macropod","Macropod team","MACROPOD",false],
  ["possum-glider","Possum & glider team","POSSUM_GLIDER",false],
  ["wombat","Wombat team","WOMBAT",false],
  ["reptile-non-venomous","Reptile — non-venomous","REPTILE_NON_VENOMOUS",false],
  ["reptile-venomous","Reptile — venomous","REPTILE_VENOMOUS",false],
  ["bat-flying-fox","Bat & flying fox team","BAT_FLYING_FOX",false],
  ["amphibian","Native amphibian rescue team","AMPHIBIAN",false],
  ["invasive","Authorised invasive species response","INVASIVE",false],
  ["mammal","Native mammal rescue team","MAMMAL",false],
  ["invertebrate","Invertebrate rescue team","INVERTEBRATE",false],
  ["non-native","Introduced and domestic animal referral","NON_NATIVE",false],
  ["transport","Transport team","",true]
] as const;

for (const [id, name, capabilityCode, receivesAllRescues] of hunterTeams) {
  put(`DemoHunterTeam-${id}`, {
    pk: S(`ORG#${HUNTER_ORG}`),
    sk: S(`TEAM#${id}`),
    entity: S("dispatch_team"),
    id: S(id),
    name: S(name),
    description: S(receivesAllRescues ? "Receives every rescue for transport availability" : `${name} dispatch capability`),
    capabilityCode: S(capabilityCode),
    receivesAllRescues: B(receivesAllRescues),
    active: B(true),
    updatedAt: S("2026-09-21T03:00:00.000Z")
  });
}

// Additional clearly synthetic, open reptile rescues for the demo mobile map.
// Stable IDs/timestamps make repeated deployments idempotent. Never seed these
// extra demo incidents into production.
if ($app.stage === "demo") {
  const reptileDemoRescues = [
    ["blue-tongue-new-lambton", "Blue-tongue lizard", "Eastern blue-tongue", "New Lambton", -32.9272, 151.7121, "Caught in garden netting; alert and responsive"],
    ["python-kotara", "Diamond python", "Diamond python", "Kotara", -32.9441, 151.6963, "Snake reported inside a backyard shed; requires safe relocation"],
    ["water-dragon-warners-bay", "Eastern water dragon", "Eastern water dragon", "Warners Bay", -32.9719, 151.6474, "Tail tangled in discarded fishing line"],
    ["garden-skink-hamilton", "Garden skink", "Garden skink", "Hamilton", -32.9247, 151.7452, "Small lizard trapped in a window well"],
    ["bearded-dragon-waratah", "Bearded dragon", "Bearded dragon", "Waratah", -32.9064, 151.7234, "Found in a netted vegetable patch"],
    ["blue-tongue-mayfield", "Blue-tongue lizard", "Eastern blue-tongue", "Mayfield", -32.8963, 151.7364, "Possible minor foot injury near a driveway"],
  ] as const;

  reptileDemoRescues.forEach(([suffix, type, breed, location, latitude, longitude, injury], index) => {
    const id = `demo-natf-mobile-${suffix}`;
    const at = new Date(Date.UTC(2026, 10, 10, 3, 0) - index * 12 * 60_000).toISOString();
    put(`DemoMobileRescue-${suffix}`, {
      pk: S(`RESCUE#${id}`),
      sk: S("META"),
      entity: S("rescue"),
      id: S(id),
      organisationId: S(HUNTER_ORG),
      type: S(type),
      breed: S(breed),
      location: S(location),
      latitude: N(latitude),
      longitude: N(longitude),
      injury: S(injury),
      status: S("PENDING"),
      demo: B(true),
      createdAt: S(at),
      updatedAt: S(at),
      gsi1pk: S("STATUS#PENDING"),
      gsi1sk: S(`${at}#${id}`),
      gsi2pk: S("RESCUES"),
      gsi2sk: S(`${at}#${id}`),
    });
  });
}
