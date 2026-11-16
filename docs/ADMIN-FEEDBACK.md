# Administrator and veterinary action feedback

## Expected interaction

- Forms in **Administration → People & access** use SvelteKit progressive enhancement:
  no full-page reload on supported browsers, the current administration section
  stays open, member details remain available, and successful actions refresh data.
- While saving, a visible pending indicator appears; repeated submissions are
  blocked until the server responds.
- After the response, a shared accessible modal blocks background interaction
  until dismissed via **Close**. It has a meaningful action-specific title,
  clear success/warning/error status and keyboard focus on Close.
- Failures preserve entered fields where possible; account AWS failures return
  an explicit server error rather than an uncaught failure page.
- Invitation success means the system accepted a delivery attempt, **not**
  that the recipient has received the email. The invitation delivery tracker
  is authoritative.
- Map boundary partial loads or failures are reported as acknowledged warnings
  or errors. The map's inline status remains available after closing the modal.
- The veterinary portal uses the same acknowledgements, including clinical
  assessments, readiness for carer/transport, and confirmed euthanasia/death.
  Terminal outcomes still require the signed-in clinician's explicit confirmation.

## Regression protection

- Organisation positions use the shared normalised title validator, not the
  previously incorrect regular expression that rejected ordinary titles.
  Tests cover President, Secretary, Raptor Leader and control-character input.
- Confirmed veterinary euthanasia/death closes pending transport work, clears
  care offers and linked carer reservations, and removes any private delivery
  destination in the same optimistic-concurrency transaction.
  The animal record and event history are **never** deleted.

## Manual acceptance checks

1. Add **Secretary** and **Raptor Leader** in the new position form.
   Verify no error and each appears immediately in the position list.
2. Invite a member. Verify **Invitation submitted** modal, delivery pending
   wording, and that the People section remains open.
3. Update a member's trained areas; verify the drawer remains open with the
   refreshed values and a **Member permissions saved** acknowledgement.
4. Deliberately enter an invalid clinic address; verify an error dialog and
   that the typed values stay available for correction.
5. Simulate operating-area loader failure; verify a blocking error modal.
6. Confirm a test animal's terminal **Euthanised** outcome, verify the
   confirmation requirement, surviving animal history, and no pending care
   reservation or transport pickup.
7. Test keyboard-only focus, responsive layouts, screen reader labels and
   duplicate clicking during slow submissions.

Production AWS and real-browser interaction checks remain required after CI.
