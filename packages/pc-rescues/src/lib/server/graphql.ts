import { Resource } from "sst";

export type RescueStatus = "PENDING" | "ASSIGNED" | "COMPLETED" | "CANCELLED";

export type Rescue = {
  id: string;
  organisationId?: string | null;
  type: string;
  breed?: string | null;
  location?: string | null;
  latitude: number;
  longitude: number;
  injury?: string | null;
  status: RescueStatus;
  assignedUserId?: string | null;
  createdAt: string;
  updatedAt: string;
};

type RescueConnection = {
  items: Rescue[];
  nextToken?: string | null;
};

const RESCUE_FIELDS =
  "id organisationId type breed location latitude longitude injury status assignedUserId createdAt updatedAt";

async function request<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(Resource.RescueHubGraphQL.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Resource.RescueHubGraphQL.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`AppSync request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  if (!payload.data) {
    throw new Error("AppSync returned no data");
  }

  return payload.data;
}

export async function getRescues(
  status?: RescueStatus,
  limit = 50,
  nextToken?: string,
): Promise<RescueConnection> {
  const query = `query Rescues($status: RescueStatus, $limit: Int, $nextToken: String) {
    rescues(status: $status, limit: $limit, nextToken: $nextToken) {
      nextToken
      items { ${RESCUE_FIELDS} }
    }
  }`;

  const data = await request<{ rescues: RescueConnection }>(query, {
    status,
    limit,
    nextToken,
  });

  return data.rescues;
}

export async function getRescue(id: string): Promise<Rescue | null> {
  const query = `query Rescue($id: ID!) { rescue(id: $id) { ${RESCUE_FIELDS} } }`;
  const data = await request<{ rescue: Rescue | null }>(query, { id });
  return data.rescue;
}

export async function createRescue(input: {
  id: string;
  type: string;
  breed?: string;
  location?: string;
  latitude: number;
  longitude: number;
  injury?: string;
  status?: RescueStatus;
  assignedUserId?: string;
}): Promise<Rescue> {
  const mutation = `mutation CreateRescue($input: CreateRescueInput!) {
    createRescue(input: $input) { ${RESCUE_FIELDS} }
  }`;
  const data = await request<{ createRescue: Rescue }>(mutation, { input });
  return data.createRescue;
}

export async function updateRescueStatus(
  id: string,
  status: RescueStatus,
): Promise<Rescue> {
  const mutation = `mutation UpdateRescueStatus($input: UpdateRescueStatusInput!) {
    updateRescueStatus(input: $input) { ${RESCUE_FIELDS} }
  }`;
  const data = await request<{ updateRescueStatus: Rescue }>(mutation, {
    input: { id, status },
  });
  return data.updateRescueStatus;
}

export async function assignRescue(id: string, userId: string): Promise<Rescue> {
  const mutation = `mutation AssignRescue($input: AssignRescueInput!) {
    assignRescue(input: $input) { ${RESCUE_FIELDS} }
  }`;
  const data = await request<{ assignRescue: Rescue }>(mutation, {
    input: { id, userId },
  });
  return data.assignRescue;
}


export type OrganisationDirectoryEntry = {
  id: string;
  authorityId: string;
  jurisdiction: string;
  officialName: string;
  displayName: string;
  areaDescription: string;
  speciesSpeciality: string;
  boundaryStatus: string;
  aliases: string[];
  sourceType: string;
  sourceUrl: string;
  sourceUpdatedAt: string;
};

type OrganisationConnection = {
  items: OrganisationDirectoryEntry[];
  nextToken?: string | null;
};

const ORGANISATION_FIELDS =
  "id authorityId jurisdiction officialName displayName areaDescription speciesSpeciality boundaryStatus aliases sourceType sourceUrl sourceUpdatedAt";

export async function getOrganisations(
  limit = 100,
  nextToken?: string,
): Promise<OrganisationConnection> {
  const query = `query Organisations($limit: Int, $nextToken: String) {
    organisations(limit: $limit, nextToken: $nextToken) {
      nextToken
      items { ${ORGANISATION_FIELDS} }
    }
  }`;

  const data = await request<{ organisations: OrganisationConnection }>(query, {
    limit,
    nextToken,
  });

  return data.organisations;
}

export async function getOrganisation(
  id: string,
): Promise<OrganisationDirectoryEntry | null> {
  const query = `query Organisation($id: ID!) {
    organisation(id: $id) { ${ORGANISATION_FIELDS} }
  }`;

  const data = await request<{ organisation: OrganisationDirectoryEntry | null }>(
    query,
    { id },
  );

  return data.organisation;
}
