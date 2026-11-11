export type InvitationEmailStatus =
  'NOT_SENT'|'SENDING'|'ACCEPTED'|'DELAYED'|'DELIVERED'|'BOUNCED'|'COMPLAINT'|'REJECTED'|'FAILED';
export function invitationEmailLabel(status:InvitationEmailStatus|null|undefined):string {
  switch(status) {
    case 'SENDING':return 'Sending';
    case 'ACCEPTED':return 'Accepted by email service';
    case 'DELAYED':return 'Delivery delayed';
    case 'DELIVERED':return 'Delivered to mail server';
    case 'BOUNCED':return 'Bounced — check email';
    case 'COMPLAINT':return 'Recipient reported spam';
    case 'REJECTED':return 'Rejected by mail service';
    case 'FAILED':return 'Send failed';
    default:return 'Not sent / unknown';
  }
}
export function deliveryEventState(eventType:string):InvitationEmailStatus|null {
  const k=eventType.replace(/([a-z])([A-Z])/g,'$1_$2').toUpperCase().replace(/[\s-]+/g,'_');
  switch(k) {
    case 'DELIVERY':return 'DELIVERED';
    case 'BOUNCE':return 'BOUNCED';
    case 'COMPLAINT':return 'COMPLAINT';
    case 'REJECT':case 'RENDERING_FAILURE':return 'REJECTED';
    case 'DELIVERY_DELAY':return 'DELAYED';
    default:return null;
  }
}
export function canApplyDeliveryEvent(current:InvitationEmailStatus,event:InvitationEmailStatus):boolean {
  if(current==='COMPLAINT')return false;
  if(event==='COMPLAINT')return true;
  if(event==='BOUNCED')return current!=='BOUNCED';
  if(event==='REJECTED')return !['DELIVERED','BOUNCED','REJECTED'].includes(current);
  if(event==='DELIVERED')return !['DELIVERED','BOUNCED','REJECTED'].includes(current);
  if(event==='DELAYED')return ['SENDING','ACCEPTED','DELAYED'].includes(current);
  return false;
}
export function invitationExpired(issuedAt:string|null|undefined, now=Date.now()):boolean {
  const issued=issuedAt?Date.parse(issuedAt):NaN;
  return Number.isFinite(issued)&&now-issued>7*24*60*60*1000;
}
