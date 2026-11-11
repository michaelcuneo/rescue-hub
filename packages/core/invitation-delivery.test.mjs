import {test} from 'node:test';import assert from 'node:assert/strict';
import {deliveryEventState,canApplyDeliveryEvent,invitationEmailLabel,invitationExpired} from './invitation-delivery.ts';
test('SES transport states are distinct from inbox receipt',()=>{
 assert.equal(deliveryEventState('Delivery'),'DELIVERED');
 assert.equal(deliveryEventState('Bounce'),'BOUNCED');
 assert.equal(deliveryEventState('Reject'),'REJECTED');
 assert.equal(deliveryEventState('DeliveryDelay'),'DELAYED');
 assert.equal(deliveryEventState('DELIVERY_DELAY'),'DELAYED');
 assert.match(invitationEmailLabel('ACCEPTED'),/email service/);
 assert.match(invitationEmailLabel('DELIVERED'),/mail server/);
});
test('late SES events cannot undo final outcomes',()=>{
 assert.equal(canApplyDeliveryEvent('DELIVERED','DELAYED'),false);
 assert.equal(canApplyDeliveryEvent('BOUNCED','DELIVERED'),false);
 assert.equal(canApplyDeliveryEvent('ACCEPTED','BOUNCED'),true);
 assert.equal(canApplyDeliveryEvent('DELIVERED','BOUNCED'),true);
 assert.equal(canApplyDeliveryEvent('BOUNCED','COMPLAINT'),true);
});
test('invitation age is not mistaken for email delivery',()=>{
 assert.equal(invitationExpired(new Date(Date.now()-8*86400000).toISOString()),true);
 assert.equal(invitationExpired(new Date().toISOString()),false);
 assert.equal(invitationExpired(undefined),false);
});
