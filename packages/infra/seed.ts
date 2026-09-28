import { dynamodb } from "@pulumi/aws";
import { data } from "./data";

let previousSeedItem: dynamodb.TableItem | undefined;

export function putSeedItem(name: string, value: Record<string, unknown>) {
  const item = new dynamodb.TableItem(
    name,
    {
      tableName: data.name,
      hashKey: "pk",
      rangeKey: "sk",
      item: JSON.stringify(value),
    },
    previousSeedItem ? { dependsOn: [previousSeedItem] } : undefined
  );

  previousSeedItem = item;
  return item;
}
