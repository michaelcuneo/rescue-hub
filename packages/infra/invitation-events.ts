import type { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { canApplyDeliveryEvent, deliveryEventState, type InvitationEmailStatus } from '../../core/invitation-delivery';

const db=DynamoDBDocumentClient.from(new DynamoDBClient({}));
type SesDetail={eventType?:string;mail?:{destination?:string[];tags?:Record<string,string[]>;messageId?:string};bounce?:{bouncedRecipients?:Array<{emailAddress:string;diagnosticCode?:string}>};deliveryDelay?:{delayedRecipients?:Array<{emailAddress:string}>}};
const firstTag=(detail:SesDetail,name:string)=>detail.mail?.tags?.[name]?.[0] ?? '';
/** SES EventBridge events are trusted only after matching user, active attempt,
 * original email and SES message ID. Never log the secure invitation URL.
 */
export async function handler(event:EventBridgeEvent<string,SesDetail>) {
  const detail=event.detail;
  const state=deliveryEventState(detail?.eventType??'');
  if (!state || firstTag(detail,'rescueHubPurpose')!=='organisation-invitation')return;
  const userId=firstTag(detail,'rescueHubUserId');
  const attempt=firstTag(detail,'rescueHubAttempt');
  if(!/^[a-f0-9-]{36}$/i.test(userId)||!/^[a-f0-9-]{36}$/i.test(attempt))return;
  const table=Resource.RescueHubData.name;
  const pk=`USER#${userId}`;
  const profile=(await db.send(new GetCommand({TableName:table,Key:{pk,sk:'PROFILE'},ConsistentRead:true}))).Item;
  if(!profile||profile.status!=='INVITED'||profile.invitationAttemptId!==attempt||!profile.enabled)return;
  const email=String(profile.email??'').toLowerCase();
  if(!(detail.mail?.destination??[]).some(v=>v.toLowerCase()===email))return;
  const latest=String(profile.invitationEmailStatus??'SENDING') as InvitationEmailStatus;
  if(!canApplyDeliveryEvent(latest,state))return;
  const messageId=detail.mail?.messageId;
  if(profile.invitationMessageId && messageId && profile.invitationMessageId!==messageId)return;
  const diagnostic=state==='BOUNCED'
    ? detail.bounce?.bouncedRecipients?.find(v=>v.emailAddress?.toLowerCase()===email)?.diagnosticCode
    : undefined;
  try{
    await db.send(new UpdateCommand({
      TableName:table,Key:{pk,sk:'PROFILE'},
      UpdateExpression:'SET invitationEmailStatus=:next, invitationEmailUpdatedAt=:at, invitationEmailDetail=:detail',
      ConditionExpression:'invitationAttemptId=:attempt AND #account=:invited AND email=:email AND enabled=:yes AND invitationEmailStatus=:previous',
      ExpressionAttributeNames:{'#account':'status'},
      ExpressionAttributeValues:{
        ':next':state,':at':new Date().toISOString(),':detail':(diagnostic??state).slice(0,240),
        ':attempt':attempt,':invited':'INVITED',':email':email,':yes':true,':previous':latest
      }
    }));
  }catch(err) {
    if(err instanceof Error&&err.name==='ConditionalCheckFailedException')return;
    throw err;
  }
}
