# Organisation chats — coordination beside operational records

Rescue Hub includes persistent, permissioned group messaging for organisation members on both desktop (`/chats`) and Expo (`Rescues · Chats · Account` bottom navigation). This is separate from the opt-in public reporter ↔ assigned rescuer messaging.

## Channels and membership
- **Administration**: org coordinators, dispatchers and authority/platform admins
- **Q&A**: active members of the organisation
- **Trading Post**: active members of the organisation
- **Care groups**: Reptiles, Birds, Raptors, Possums & Gliders and others, derived from the organisation's active team definitions. A care group can combine relevant teams such as venomous and non-venomous Reptiles. Any other active team gets its own channel.
- Users only see channels for which they have current membership; inactive, removed and PUBLIC_REPORTER users are denied. Channel access is checked on every list, read, post and read-receipt request, not just in navigation.

## Features
Messages are permanent in DynamoDB under an organisation/channel partition, with channel-scoped, time-ordered 40-message pages. The messenger supports pagination, sender names, timestamps, messages up to 2,000 characters, read markers and channel previews. Web and Expo share the same API. Their existing AppSync websocket carries **only opaque change revisions**; clients re-fetch authorised content and fall back to polling if a websocket is disconnected. Chat contents, message bodies and private locations never go over the public invalidation stream.

## Example
1. A rescuer collects a reptile and takes it to AREC; its original job pin is removed after pickup, but animal records persist.
2. AREC rings dispatch: the animal is ready for care. The vet call is logged on the permanent animal record, with a pickup offer created at the **vet clinic coordinates**.
3. Michael and other eligible members discuss availability in **Reptiles**: one has too many animals, another is at work, and another offers to transport later. Chat is conversational coordination, not a custody change.
4. A carer formally claims the animal in **Care offers → Transport to me** and chooses current GPS, workplace or another address. Rescue Hub announces in the matching care group (or Q&A if the carer is not permitted in the specialist channel) that a transport job can now be claimed. The announcement only includes the animal, vet pickup place and an animal ID reference; it never includes delivery GPS or a home/workplace address.
5. An eligible volunteer formally self-claims transport, sees the private destination only after assignment, collects the animal, and delivers it. The receiving carer acknowledges custody. The permanent animal record and NPWS-reportable history remain separate from the chat.

## Invariants and verification
- **Chat messages never assign carers, change animal states, mark collection, close jobs or transfer custody.** Those actions remain authenticated, atomic workflow operations and their events remain on the permanent animal record.
- Chat is not emergency dispatch, verified veterinary instructions, or a substitute for phone contact when necessary.
- All messages stay in the originating organisation. No unaffiliated public reporter has group-channel access.
- Current channel membership is evaluated server-side for every request. Chat links referencing animals must be checked against the requesting organisation.
- API and UI are committed and CI checked, but AWS deployment and real-world iOS/Android/desktop cross-device testing are outstanding. Retention/deletion governance, moderation and explicit NPWS reporting requirements should be agreed with participating organisations before production adoption.
