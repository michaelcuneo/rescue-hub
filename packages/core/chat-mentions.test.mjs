import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mentionHandle, currentMentionQuery, insertChatMention, usableChatMentions, splitChatMentions } from './chat-mentions.ts';

const person = {kind:'person', id:'123e4567-e89b-12d3-a456-426614174000',
  label:'Michelle Smith', handle:'michelle-smith'};
const animal = {kind:'animal', id:'123e4567-e89b-12d3-a456-426614174001',
  label:'Bearded dragon', handle:'bearded-dragon', rescueId:'123e4567-e89b-12d3-a456-426614174002'};

test('handles normalise and recognise a trailing query', () => {
  assert.equal(mentionHandle('  Bearded   Dragon  '),'bearded-dragon');
  assert.equal(currentMentionQuery('Hey @mich'), 'mich');
  assert.equal(currentMentionQuery('hello@example.com'), null);
  assert.equal(currentMentionQuery('See @michelle!'), null);
  assert.equal(insertChatMention('Hey @mi',person),'Hey @michelle-smith ');
});
test('two linked references and surrounding punctuation render intact', () => {
  const text='Hey @michelle-smith, can you grab @bearded-dragon?';
  const mentions=usableChatMentions(text,[person,animal]);
  const segments=splitChatMentions(text, mentions);
  assert.equal(segments.map(part=>part.text).join(''),text);
  assert.deepEqual(segments.filter(p=>p.mention).map(p=>p.mention.kind),['person','animal']);
  assert.equal(splitChatMentions('Not @bearded-dragons', [animal]).length,1);
});
test('stale or forged plain text does not become a mention', () => {
  assert.deepEqual(usableChatMentions('@other', [person]),[]);
  assert.deepEqual(usableChatMentions('Hi @michelle-smith', [{...person, id:'bad'}]),[]);
  assert.deepEqual(splitChatMentions('@anyone',[]),[{text:'@anyone'}]);
});
