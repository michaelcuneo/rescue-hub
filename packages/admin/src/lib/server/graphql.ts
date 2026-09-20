import { Resource } from "sst";

export type RescueStatus = "PENDING" | "ASSIGNED" | "COMPLETED" | "CANCELLED";

export type Rescue = {
  id: string;
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
  "id type breed location latitude longitude injury status assignedUserId createdAt updatedAt";

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
