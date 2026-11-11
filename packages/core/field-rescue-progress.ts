export type FieldActor = { id:string; organisationId?:string|null; enabled:boolean; status:string };
export type FieldRescue = { organisationId?:string|null; assignedUserId?:string|null; status:string; transportAnimalId?:string|null };
export function canUpdateOwnRescue(user:FieldActor|null|undefined,rescue:FieldRescue|null|undefined):boolean {
  return Boolean(user && rescue && user.enabled && user.status==='ACTIVE' && user.organisationId &&
    user.organisationId===rescue.organisationId && rescue.assignedUserId===user.id &&
    rescue.status==='ASSIGNED' && !rescue.transportAnimalId);
}
export type QuickVetAction = 'GOING_TO_VET'|'HANDED_TO_VET';
export function validateQuickVetAction(raw:unknown):{kind:QuickVetAction;clinic:string;notes:string;animalId:string|null} {
  if (!raw || typeof raw!=='object') throw new Error('Choose a rescue update.');
  const data=raw as Record<string,unknown>;
  if (data.kind!=='GOING_TO_VET' && data.kind!=='HANDED_TO_VET') throw new Error('Choose going to vet or handed to vet.');
  const clinic=typeof data.clinic==='string'?data.clinic.trim():'';
  const notes=typeof data.notes==='string'?data.notes.trim():'';
  if (clinic.length>250 || notes.length>1000) throw new Error('Clinic and notes are too long.');
  if (data.kind==='HANDED_TO_VET' && !clinic) throw new Error('Enter the clinic or veterinarian receiving the animal.');
  if (data.animalId!==undefined && (typeof data.animalId!=='string'||data.animalId.length>120)) throw new Error('Choose a valid animal.');
  return { kind:data.kind,clinic,notes,animalId:typeof data.animalId==='string'&&data.animalId?data.animalId:null };
}
export function quickVetStep(status:string|null|undefined):'READY'|'TRAVELLING'|'AT_VET'|'OTHER' {
  if (status==='AT_VET') return 'AT_VET';
  if (status==='IN_TRANSIT') return 'TRAVELLING';
  if (!status || status==='IN_RESCUE') return 'READY';
  return 'OTHER';
}
