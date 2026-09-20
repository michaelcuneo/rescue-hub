import { dynamodb } from "@pulumi/aws";
import { data } from "./data";
import {
  NSW_DIRECTORY_SOURCE,
  NSW_DIRECTORY_SOURCE_UPDATED_AT,
  nswOrganisationDirectory,
} from "../core/nsw-organisations";

const S = (value: string) => ({ S: value });
const L = (values: string[]) => ({ L: values.map(S) });

function put(name: string, value: Record<string, unknown>) {
  new dynamodb.TableItem(name, {
    tableName: data.name,
    hashKey: "pk",
    rangeKey: "sk",
    item: JSON.stringify(value),
  });
}

put("NswAuthorityDirectory", {
  pk: S("AUTHORITY#NSW-DCCEEW-BHR"),
  sk: S("DIRECTORY"),
  entity: S("authority-directory"),
  id: S("NSW-DCCEEW-BHR"),
  name: S("Biodiversity and Heritage Regulator"),
  department: S("NSW Department of Climate Change, Energy, the Environment and Water"),
  jurisdiction: S("NSW"),
});

for (const organisation of nswOrganisationDirectory) {
  put(`NswOrganisation-${organisation.id}`, {
    pk: S(`ORG#${organisation.id}`),
    sk: S("DIRECTORY"),
    entity: S("organisation-directory"),
    id: S(organisation.id),
    authorityId: S("NSW-DCCEEW-BHR"),
    jurisdiction: S("NSW"),
    officialName: S(organisation.officialName),
    displayName: S(organisation.displayName),
    areaDescription: S(organisation.areaDescription),
    speciesSpeciality: S(organisation.speciesSpeciality),
    boundaryStatus: S(organisation.boundaryStatus),
    aliases: L(organisation.aliases),
    sourceType: S("NSW_DCCEEW_PUBLIC_DIRECTORY"),
    sourceUrl: S(NSW_DIRECTORY_SOURCE),
    sourceUpdatedAt: S(NSW_DIRECTORY_SOURCE_UPDATED_AT),
    gsi2pk: S("ORGANISATIONS#NSW"),
    gsi2sk: S(`${organisation.displayName.toLowerCase()}#${organisation.id}`),
  });
}
