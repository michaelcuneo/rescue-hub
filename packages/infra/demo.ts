import { dynamodb } from "@pulumi/aws";
import { data } from "./data";

const HUNTER_ORG = "native-animal-trust-fund";
const S = (value: string) => ({ S: value });
const N = (value: number) => ({ N: String(value) });
const B = (value: boolean) => ({ BOOL: value });
const L = (values: string[]) => ({ L: values.map(S) });

function put(name: string, value: Record<string, unknown>) {
  new dynamodb.TableItem(name, {
    tableName: data.name,
    hashKey: "pk",
    rangeKey: "sk",
    item: JSON.stringify(value),
  });
}

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
    demo: B(true),
    suburb: S(suburb),
    createdAt: S("2026-09-01T00:00:00.000Z"),
    updatedAt: S("2026-09-21T03:00:00.000Z"),
    gsi1pk: S(`ORG#${HUNTER_ORG}#USERS`),
    gsi1sk: S(`${name.toLowerCase()}#${id}`),
    gsi2pk: S("USERS"),
    gsi2sk: S(`${name.toLowerCase()}#${id}`),
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

rescues.forEach((r, index) => {
  const [n,type,breed,location,latitude,longitude,injury,status,assignedUserId] = r;
  const id = `demo-hunter-rescue-${n}`;
  const minute = String(55 - index * 3).padStart(2,"0");
  const at = `2026-09-21T02:${minute}:00.000Z`;
  const item: Record<string, unknown> = {
    pk: S(`RESCUE#${id}`), sk: S("META"), entity: S("rescue"), id: S(id),
    organisationId: S(HUNTER_ORG), type: S(type), breed: S(breed), location: S(location),
    latitude: N(latitude), longitude: N(longitude), injury: S(injury), status: S(status),
    demo: B(true), createdAt: S(at), updatedAt: S(at),
    gsi1pk: S(`STATUS#${status}`), gsi1sk: S(`${at}#${id}`),
    gsi2pk: S("RESCUES"), gsi2sk: S(`${at}#${id}`),
  };
  if (assignedUserId) item.assignedUserId = S(assignedUserId);
  put(`DemoRescue-${id}`, item);
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
