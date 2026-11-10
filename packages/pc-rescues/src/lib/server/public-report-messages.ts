import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getRescue } from './graphql';
import { getPublicReport } from './public-reports';
import type { RescueHubUser } from './auth';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const table = Resource.RescueHubData.name;
const WINDOW_MS = 10_000;

export type ReporterMessage = {
  id: string; reportId: string; senderUserId: string;
  senderRole: 'REPORTER' | 'RESCUER'; text: string; createdAt: string;
};

export class ReporterConversationError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

/** Only the reporter and the actively claimed rescue's assigned volunteer may participate.
 * The reporter must explicitly opt in. Neither side can inspect other cases.
 */
export async function authoriseReporterConversation(user: RescueHubUser | null | undefined, reportId: string) {
  if (!user?.enabled || user.status !== 'ACTIVE')
    throw new ReporterConversationError('An active session is required.', 403);
  if (!/^[a-f0-9-]{36}$/i.test(reportId))
    throw new ReporterConversationError('Invalid report ID.', 400);
  const report = await getPublicReport(reportId);
  if (!report) throw new ReporterConversationError('Report not found.', 404);
  if (!report.allowMessages)
    throw new ReporterConversationError('The reporter has not opted into messaging.', 403);
  if (report.reporterUserId === user.id && user.roles.includes('PUBLIC_REPORTER')) {
    return { report, role: 'REPORTER' as const };
  }
  if (!report.rescueId || !report.organisationId || user.organisationId !== report.organisationId ||
      !user.roles.some(role => role === 'RESCUER' || role === 'CARER')) {
    throw new ReporterConversationError('Access denied.', 403);
  }
  const rescue = await getRescue(report.rescueId);
  if (!rescue || rescue.organisationId !== user.organisationId || rescue.assignedUserId !== user.id ||
      rescue.status === 'CANCELLED') {
    throw new ReporterConversationError('Only the currently assigned rescuer may contact the reporter.', 403);
  }
  return { report, role: 'RESCUER' as const };
}

export async function listReporterMessages(reportId: string): Promise<ReporterMessage[]> {
  const result = await db.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':pk': `REPORT_CONVERSATION#${reportId}`, ':prefix': 'MESSAGE#' },
    ScanIndexForward: false, Limit: 100
  }));
  return (result.Items ?? []).reverse().map(item => ({
    id: String(item.id), reportId, senderUserId: String(item.senderUserId),
    senderRole: item.senderRole === 'RESCUER' ? 'RESCUER' : 'REPORTER',
    text: String(item.text), createdAt: String(item.createdAt)
  }));
}

export async function sendReporterMessage(user: RescueHubUser, reportId: string, text: string, senderRole: 'REPORTER' | 'RESCUER') {
  const value = text.trim();
  if (!value || value.length > 1500)
    throw new ReporterConversationError('Message must contain 1–1500 characters.', 400);
  const now = Date.now(), createdAt = new Date(now).toISOString(), id = crypto.randomUUID();
  const message: ReporterMessage = { id, reportId, senderUserId: user.id, senderRole, text: value, createdAt };
  await db.send(new TransactWriteCommand({ TransactItems: [
    { Update: {
      TableName: table,
      Key: { pk: `REPORT_MESSAGE_LIMIT#${reportId}#${user.id}`, sk: 'LATEST' },
      UpdateExpression: 'SET lastAt = :now, #ttl = :ttl',
      ConditionExpression: 'attribute_not_exists(lastAt) OR lastAt < :earliest',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':now': now, ':earliest': now - WINDOW_MS, ':ttl': Math.floor(now / 1000) + 3600 }
    }},
    { Put: {
      TableName: table,
      Item: { pk: `REPORT_CONVERSATION#${reportId}`, sk: `MESSAGE#${createdAt}#${id}`, entity: 'reporter_message', ...message },
      ConditionExpression: 'attribute_not_exists(pk)'
    }}
  ] })).catch(error => {
    if (error instanceof Error && error.name === 'TransactionCanceledException')
      throw new ReporterConversationError('Please wait 10 seconds before sending another message.', 429);
    throw error;
  });
  return message;
}
