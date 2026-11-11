<script lang="ts">
  import AdminOperatingAreas from '$lib/components/AdminOperatingAreas.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import type { PageData } from './$types';

  let { data, form }: { data: PageData; form?: any } = $props();

  type Section =
    | 'overview'
    | 'organisations'
    | 'rescues'
    | 'regions'
    | 'people'
    | 'audit';

  let section = $state<Section>('overview');
  let organisationSearch = $state('');
  let rescueSearch = $state('');

  let peopleSearch = $state('');
  let peopleFilter = $state<'all' | 'available' | 'admins' | 'disabled'>('all');
  let showInvite = $state(false);
  let selectedPersonId = $state<string | null>(null);
  let inviteOrganisationId = $state('');

  const visiblePeople = $derived(data.users.filter((user) => {
    const query = peopleSearch.trim().toLowerCase();
    const matches = !query || [user.name, user.email, organisationName(user.organisationId), user.roles.join(' '), ...teamNames(user)].join(' ').toLowerCase().includes(query);
    const filterMatches = peopleFilter === 'all' ||
      (peopleFilter === 'available' && user.enabled && user.availabilityStatus === 'AVAILABLE') ||
      (peopleFilter === 'admins' && user.roles.some((role) => role.includes('ADMIN'))) ||
      (peopleFilter === 'disabled' && !user.enabled);
    return matches && filterMatches;
  }));
  const selectedPerson = $derived(data.users.find((user) => user.id === selectedPersonId));
  const roleOptions = [
    { id: 'RESCUER', label: 'Rescuer — field rescue access' },
    { id: 'CARER', label: 'Carer — custody and care access' },
    { id: 'DISPATCHER', label: 'Dispatcher — coordinate organisation jobs' },
    { id: 'ORG_ADMIN', label: 'Organisation administrator' },
    { id: 'DATA_STEWARD', label: 'Data steward — records support' },
    { id: 'AUTHORITY_AUDITOR', label: 'Authority auditor' },
    { id: 'AUTHORITY_ADMIN', label: 'Authority administrator' },
    { id: 'PLATFORM_ADMIN', label: 'Platform administrator — full platform access' }
  ] as const;
  const inviteMembershipConfig = $derived(
    data.membershipConfigs[inviteOrganisationId || data.currentUser.organisationId || ''] ?? {
      membershipTypes: data.standardMembershipTypes,
      teams: data.standardTeams
    }
  );

  const openRescues = $derived(
    data.rescues.filter((rescue) => rescue.status === 'PENDING' || rescue.status === 'ASSIGNED')
  );

  const pendingRescues = $derived(
    data.rescues.filter((rescue) => rescue.status === 'PENDING')
  );

  const gisOrganisations = $derived(
    data.organisations.filter((organisation) => organisation.boundaryStatus === 'GIS_AVAILABLE')
  );

  const visibleOrganisations = $derived(
    data.organisations.filter((organisation) => {
      const query = organisationSearch.trim().toLowerCase();
      if (!query) return true;

      return [
        organisation.displayName,
        organisation.officialName,
        organisation.areaDescription,
        organisation.speciesSpeciality,
        ...organisation.aliases
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
  );

  const visibleRescues = $derived(
    data.rescues.filter((rescue) => {
      const query = rescueSearch.trim().toLowerCase();
      if (!query) return true;

      return [
        rescue.type,
        rescue.breed ?? '',
        rescue.location ?? '',
        rescue.status,
        rescue.assignedUserId ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    })
  );

  const navigation: Array<{ id: Section; label: string; short: string }> = [
    { id: 'overview', label: 'Overview', short: 'OV' },
    { id: 'organisations', label: 'Organisations', short: 'OR' },
    { id: 'rescues', label: 'Rescues', short: 'RE' },
    { id: 'regions', label: 'Operating areas', short: 'OA' },
    { id: 'people', label: 'People & access', short: 'PE' },
    { id: 'audit', label: 'Audit', short: 'AU' }
  ];

  const statusLabel = (status: string) =>
    status.charAt(0) + status.slice(1).toLowerCase();

  const organisationName = (id?: string) =>
    data.organisations.find((organisation) => organisation.id === id)?.displayName ??
    (id || 'No organisation');

  const membershipConfigFor = (user: { organisationId?: string }) =>
    (user.organisationId ? data.membershipConfigs[user.organisationId] : undefined) ?? {
      membershipTypes: data.standardMembershipTypes,
      teams: data.standardTeams
    };

  const membershipTypeName = (user: { organisationId?: string; membershipTypeId?: string }) =>
    membershipConfigFor(user).membershipTypes.find((type) => type.id === user.membershipTypeId)?.name ??
    user.membershipTypeId ??
    'Not set';

  const teamNames = (user: { organisationId?: string; teamIds: string[] }) => {
    const config = membershipConfigFor(user);
    const ids = new Set(user.teamIds ?? []);
    return config.teams.filter((team) => ids.has(team.id)).map((team) => team.name);
  };

  const canChooseOrganisation = $derived(
    data.currentUser.roles.includes('PLATFORM_ADMIN') ||
      data.currentUser.roles.includes('AUTHORITY_ADMIN')
  );

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
</script>

<div class="admin-shell">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">RH</div>
      <div>
        <strong>Rescue Hub</strong>
        <span>NSW Administration</span>
      </div>
    </div>

    <nav aria-label="Administration">
      {#each navigation as item}
        <button
          class:active={section === item.id}
          type="button"
          onclick={() => (section = item.id)}
        >
          <span class="nav-icon">{item.short}</span>
          <span>{item.label}</span>
        </button>
      {/each}
    </nav>
    <a class="documentation-link" href="/documentation">
      <span class="nav-icon" aria-hidden="true">DC</span>
      <span>Documentation &amp; guides</span>
    </a>

    <div class="sidebar-footer">
      <div class:online={data.backend.online} class="status-dot"></div>
      <div>
        <strong>{data.backend.online ? 'Services connected' : 'Services unavailable'}</strong>
        <span>{data.backend.online ? 'Rescue Hub services' : 'Backend data unavailable'}</span>
      </div>
    </div>
  </aside>

  <main>
    <header class="topbar">
      <div>
        <p class="eyebrow">NSW wildlife rehabilitation</p>
        <h1>
          {navigation.find((item) => item.id === section)?.label ?? 'Overview'}
        </h1>
      </div>

      <div class="admin-actions">
        <ThemeSwitcher compact />
        {#if canChooseOrganisation}
          <a class="demo-launch" href="/demo/hunter">Open Hunter workspace</a>
          <a class="demo-launch" href="/chats">Organisation chats</a>

        {/if}
      <div class="demo-identity">
        <span class="avatar" aria-hidden="true">{data.currentUser.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'}</span>
        <div>
          <strong>{data.currentUser.name}</strong>
          <span>{data.currentUser.roles.join(' · ')}</span>
        </div>
      </div>
      </div>
    </header>

    {#if !data.backend.online}
      <section class="backend-warning">
        <strong>Some Rescue Hub services are currently unavailable.</strong>
        <span>
          Try again shortly. If the problem continues, contact your platform administrator.
        </span>
        {#if data.backend.errors.length}
          <details>
            <summary>Backend diagnostics</summary>
            {#each data.backend.errors as error}
              <code>{error}</code>
            {/each}
          </details>
        {/if}
      </section>
    {/if}

    {#if section === 'overview'}
      <section class="metrics" aria-label="Operational summary">
        <article>
          <span class="metric-label">NSW organisations</span>
          <strong>{data.organisations.length || 35}</strong>
          <small>DCCEEW public directory</small>
        </article>
        <article>
          <span class="metric-label">Open rescues</span>
          <strong>{openRescues.length}</strong>
          <small>{pendingRescues.length} waiting for assignment</small>
        </article>
        <article>
          <span class="metric-label">GIS operating areas</span>
          <strong>{gisOrganisations.length}</strong>
          <small>authoritative geometry available</small>
        </article>
        <article>
          <span class="metric-label">Active accounts</span>
          <strong>{data.users.filter((member) => member.enabled && member.status === 'ACTIVE').length}</strong>
          <small>Enabled people with active access</small>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel wide">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Directory</p>
              <h2>NSW rescue organisations</h2>
            </div>
            <button class="text-button" type="button" onclick={() => (section = 'organisations')}>
              View all
            </button>
          </div>

          <div class="organisation-list">
            {#if data.organisations.length}
              {#each data.organisations.slice(0, 7) as organisation}
                <button
                  type="button"
                  class="organisation-row"
                  onclick={() => (section = 'organisations')}
                >
                  <span class="org-initials">
                    {organisation.displayName
                      .split(' ')
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join('')}
                  </span>
                  <span class="org-main">
                    <strong>{organisation.displayName}</strong>
                    <small>{organisation.areaDescription}</small>
                  </span>
                  <span class:gis={organisation.boundaryStatus === 'GIS_AVAILABLE'} class="boundary">
                    {organisation.boundaryStatus === 'GIS_AVAILABLE' ? 'GIS boundary' : 'Text area'}
                  </span>
                  <span class="claim">Unclaimed</span>
                </button>
              {/each}
            {:else}
              <div class="empty-state">
                <strong>Directory ready to load</strong>
                <span>The 35 seeded NSW organisations will appear once the SST stage is running.</span>
              </div>
            {/if}
          </div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Dispatch</p>
              <h2>Live rescue state</h2>
            </div>
          </div>

          <div class="rescue-summary">
            <div>
              <span>Pending</span>
              <strong>{pendingRescues.length}</strong>
            </div>
            <div>
              <span>Assigned</span>
              <strong>{data.rescues.filter((rescue) => rescue.status === 'ASSIGNED').length}</strong>
            </div>
            <div>
              <span>Completed</span>
              <strong>{data.rescues.filter((rescue) => rescue.status === 'COMPLETED').length}</strong>
            </div>
          </div>

          <button class="primary-action" type="button" onclick={() => (section = 'rescues')}>
            Open rescue register
          </button>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Coverage</p>
              <h2>Operating-area readiness</h2>
            </div>
          </div>

          <div class="coverage-figure">
            <div
              class="coverage-ring"
              style={`--coverage: ${data.organisations.length ? Math.round((gisOrganisations.length / data.organisations.length) * 100) : 0}%`}
            >
              <strong>
                {data.organisations.length
                  ? Math.round((gisOrganisations.length / data.organisations.length) * 100)
                  : 0}%
              </strong>
            </div>
            <p>
              {gisOrganisations.length} of {data.organisations.length || 35} public provider
              records currently identify an available GIS operating-area source.
            </p>
          </div>
        </article>
      </section>
    {:else if section === 'organisations'}
      <section class="panel page-panel">
        <div class="panel-heading table-heading">
          <div>
            <p class="eyebrow">NSW DCCEEW directory</p>
            <h2>Organisation registry</h2>
            <p class="intro">
              Public directory entries remain unclaimed until an authorised representative is verified.
            </p>
          </div>
          <label class="search">
            <span>Search organisations</span>
            <input bind:value={organisationSearch} placeholder="Name, region or species…" />
          </label>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Operating area</th>
                <th>Species scope</th>
                <th>Boundary</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {#each visibleOrganisations as organisation}
                <tr>
                  <td>
                    <strong>{organisation.displayName}</strong>
                    {#if organisation.officialName !== organisation.displayName}
                      <span>{organisation.officialName}</span>
                    {/if}
                  </td>
                  <td>{organisation.areaDescription}</td>
                  <td>{organisation.speciesSpeciality}</td>
                  <td>
                    <span
                      class:gis={organisation.boundaryStatus === 'GIS_AVAILABLE'}
                      class="boundary"
                    >
                      {organisation.boundaryStatus === 'GIS_AVAILABLE' ? 'GIS available' : 'Text only'}
                    </span>
                  </td>
                  <td><span class="claim">Unclaimed</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {:else if section === 'rescues'}
      <section class="panel page-panel">
        <div class="panel-heading table-heading">
          <div>
            <p class="eyebrow">Operational register</p>
            <h2>Wildlife rescues</h2>
            <p class="intro">All rescue activity visible to the governing NSW administration role.</p>
          </div>
          <label class="search">
            <span>Search rescues</span>
            <input bind:value={rescueSearch} placeholder="Animal, location or status…" />
          </label>
        </div>

        {#if visibleRescues.length}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Animal</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {#each visibleRescues as rescue}
                  <tr>
                    <td>
                      <strong>{rescue.type}</strong>
                      {#if rescue.breed}<span>{rescue.breed}</span>{/if}
                    </td>
                    <td>{rescue.location || 'Location not recorded'}</td>
                    <td><span class="rescue-status status-{rescue.status.toLowerCase()}">{statusLabel(rescue.status)}</span></td>
                    <td>{rescue.assignedUserId || 'Unassigned'}</td>
                    <td>{formatDate(rescue.updatedAt)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="empty-state large">
            <strong>No rescue records yet</strong>
            <span>New rescue reports will appear here as they are created.</span>
          </div>
        {/if}
      </section>
    {:else if section === 'regions'}
      <section class="feature-grid">
        <article class="panel page-panel feature-copy">
          <p class="eyebrow">Operating areas</p>
          <h2>NSW geographic authority</h2>
          <p>
            Official DCCEEW wildlife rehabilitation boundaries are rendered directly below and linked
            to the Rescue Hub organisation directory for dispatch routing.
          </p>
          <div class="readiness">
            <span><strong>{gisOrganisations.length}</strong> GIS sources identified</span>
            <span><strong>{Math.max(0, data.organisations.length - gisOrganisations.length)}</strong> text-only areas</span>
          </div>
        </article>
        <AdminOperatingAreas />
      </section>
    {:else if section === 'people'}
      <section class="people-workspace" aria-label="People and access management">
        <div class="people-head">
          <div>
            <p class="eyebrow">Identity & permissions</p>
            <h2>People & access</h2>
            <p class="intro">Manage organisation membership, dispatch capabilities and account access.</p>
          </div>
          <button class="primary-action" type="button" onclick={() => { inviteOrganisationId = data.currentUser.organisationId ?? data.organisations[0]?.id ?? ''; showInvite = true; }}>+ Invite person</button>
        </div>

        <div class="people-stats" aria-label="People summary">
          <div><span>Total people</span><strong>{data.users.length}</strong></div>
          <div><span>Available now</span><strong>{data.users.filter((user) => user.enabled && user.availabilityStatus === 'AVAILABLE').length}</strong></div>
          <div><span>Administrators</span><strong>{data.users.filter((user) => user.roles.some((role) => role.includes('ADMIN'))).length}</strong></div>
          <div><span>Access disabled</span><strong>{data.users.filter((user) => !user.enabled).length}</strong></div>
        </div>

        {#if form?.error}
          <div class="people-feedback error" role="alert">{form.error}</div>
        {:else if form?.success}
          <div class="people-feedback success" role="status">
            {['inviteUser', 'inviteDemoReviewer', 'resendInvitation'].includes(form.action) ? 'Invitation email sent. The recipient can use the secure link to set a password and enter their organisation.' : 'User updated.'}
            {#if form.action === 'resetPassword' && form.devCode}<code>Development reset code: {form.devCode}</code>{/if}
          </div>
        {/if}

        <div class="people-directory panel">
          <div class="directory-toolbar">
            <div><h3>People directory</h3><p>{visiblePeople.length} of {data.users.length} people</p></div>
            <label class="people-search"><span class="sr-only">Search people</span><input type="search" bind:value={peopleSearch} placeholder="Search people, organisations or teams…" /></label>
          </div>
          <div class="people-filters" aria-label="Filter people">
            {#each [{ id: 'all', label: 'Everyone' }, { id: 'available', label: 'Available' }, { id: 'admins', label: 'Administrators' }, { id: 'disabled', label: 'Disabled' }] as filter}
              <button type="button" class:chosen={peopleFilter === filter.id} onclick={() => (peopleFilter = filter.id as typeof peopleFilter)}>{filter.label}</button>
            {/each}
          </div>
          <div class="directory-list">
            {#each visiblePeople as user (user.id)}
              <button class="person-row" type="button" onclick={() => (selectedPersonId = user.id)} aria-label={`Manage ${user.name || user.email}`}>
                <span class="person-avatar" aria-hidden="true">{(user.name || user.email).split(' ').slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</span>
                <span class="person-identity"><strong>{user.name || user.email}</strong><small>{user.email}</small><small>{organisationName(user.organisationId)}</small></span>
                <span class="person-role"><strong>{user.roles.map((role) => role.replaceAll('_', ' ').toLowerCase()).join(' · ') || 'No role'}</strong><small>{membershipTypeName(user)}</small></span>
                <span class="person-teams">{teamNames(user).slice(0, 2).join(' · ') || 'No dispatch teams'}{teamNames(user).length > 2 ? ` +${teamNames(user).length - 2}` : ''}</span>
                <span class="person-status"><span class:available={user.enabled && user.availabilityStatus === 'AVAILABLE'} class="availability-state">{!user.enabled ? 'Disabled' : user.availabilityStatus === 'AVAILABLE' ? 'Available' : 'Offline'}</span></span>
                <span class="person-chevron" aria-hidden="true">›</span>
              </button>
            {:else}
              <div class="empty-state"><strong>No matching people</strong><span>Try a different search or filter.</span></div>
            {/each}
          </div>
        </div>
      </section>

      {#if showInvite}
        <div class="people-overlay" role="presentation">
          <div class="people-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div class="dialog-heading"><div><p class="eyebrow">New team member</p><h2 id="invite-title">Invite a person</h2></div><button class="dialog-close" type="button" aria-label="Close invitation" onclick={() => (showInvite = false)}>×</button></div>
            <form method="POST" action="?/inviteUser" class="person-form">
              {#if canChooseOrganisation}
                <div class="reviewer-note"><strong>Reviewer permissions</strong><p>Invitations grant operational access according to the selected role. Do not invite read-only reviewers until a restricted reviewer role is available.</p></div>
              {/if}
              <div class="form-pair"><label><span>Name</span><input name="name" required placeholder="Jane Smith" /></label><label><span>Email</span><input name="email" type="email" required placeholder="jane@example.org" /></label></div>
              <label><span>Organisation</span><select name="organisationId" bind:value={inviteOrganisationId} disabled={!canChooseOrganisation} required>{#each data.organisations as organisation}<option value={organisation.id}>{organisation.displayName}</option>{/each}</select>{#if !canChooseOrganisation}<input type="hidden" name="organisationId" value={inviteOrganisationId} />{/if}</label>
              <div class="access-group">
                <label><span>Account role — what they can do</span><select name="role" required>{#each roleOptions.filter(option => data.assignableRoles.includes(option.id)) as role}<option value={role.id}>{role.label}</option>{/each}</select></label>
                <p class="permission-help">Choose one access role. Platform administration is available only to existing platform administrators.</p>
              </div>
              <div class="access-group">
                <label><span>Operational membership — how they participate</span><select name="membershipTypeId" required>{#each inviteMembershipConfig.membershipTypes.filter(type => type.active) as type}<option value={type.id}>{type.name}</option>{/each}</select></label>
                <p class="permission-help">Membership controls field participation, not administrative rights. Choose Active rescuer for qualified rescue work, Transport volunteer for pickup work, or Support member for administration only.</p>
              </div>
              <fieldset class="capability-picker"><legend>Species and dispatch teams <small>Only active field rescuers receive matching species rescue offers. Transport volunteers can receive eligible transport offers.</small></legend><div class="capability-grid">{#each inviteMembershipConfig.teams.filter(team => team.active) as team}<label class="capability-option"><input type="checkbox" name="teamIds" value={team.id} /><span><strong>{team.name}</strong><small>{team.receivesAllRescues ? 'Transport team — eligibility is also checked by membership' : team.description}</small></span></label>{/each}</div></fieldset>
              <div class="dialog-actions"><button type="button" onclick={() => (showInvite = false)}>Cancel</button><button class="primary-action" type="submit">Send invitation</button></div>
            </form>
          </div>
        </div>
      {/if}

      {#if selectedPerson}
        <div class="people-overlay" role="presentation">
          <div class="people-dialog person-detail" role="dialog" aria-modal="true" aria-labelledby="person-detail-title">
            <div class="dialog-heading"><div><p class="eyebrow">Person details</p><h2 id="person-detail-title">{selectedPerson.name || selectedPerson.email}</h2><p class="intro">{selectedPerson.email} · {organisationName(selectedPerson.organisationId)}</p></div><button class="dialog-close" type="button" aria-label="Close person details" onclick={() => (selectedPersonId = null)}>×</button></div>
            <div class="person-detail-summary"><span class:available={selectedPerson.enabled && selectedPerson.availabilityStatus === 'AVAILABLE'} class="availability-state">{selectedPerson.enabled ? selectedPerson.availabilityStatus ?? 'Offline' : 'Disabled'}</span><span>{selectedPerson.roles.join(' · ')}</span><span>{selectedPerson.status}</span></div>
            {#if selectedPerson.status === 'INVITED' && selectedPerson.enabled}
              <div class="reviewer-note"><strong>Invitation pending</strong><p>They'll receive a link to set their password. No email address or invitation code needs to be entered again.</p>
                <form method="POST" action="?/resendInvitation"><input type="hidden" name="userId" value={selectedPerson.id} /><button type="submit">Resend invitation email</button></form>
              </div>
            {/if}
            <form method="POST" action="?/updateMemberAccess" class="person-form">
              <input type="hidden" name="userId" value={selectedPerson.id} />
              <div class="access-group">
                <label><span>Account role — permissions</span><select name="role" required disabled={selectedPerson.id === data.currentUser.id}>{#each roleOptions.filter(option => data.assignableRoles.includes(option.id)) as role}<option value={role.id} selected={selectedPerson.roles.includes(role.id)}>{role.label}</option>{/each}</select></label>
                <p class="permission-help">Controls access to platform, administration, dispatch and animal-care features. A platform administrator can change Chris to Platform administrator here. Changing roles signs the member out of existing sessions.</p>
              </div>
              <div class="access-group">
                <label><span>Operational membership — field participation</span><select name="membershipTypeId" required disabled={selectedPerson.id === data.currentUser.id}>{#each membershipConfigFor(selectedPerson).membershipTypes.filter(type => type.active) as type}<option value={type.id} selected={type.id === selectedPerson.membershipTypeId}>{type.name}</option>{/each}</select></label>
                <p class="permission-help">This does not grant administrator access. Active rescuer + suitable species teams enables rescue offers; Transport volunteer enables transport work.</p>
              </div>
              <fieldset class="capability-picker"><legend>Species and dispatch teams <small>Only matching pending cases appear for active field rescuers.</small></legend><div class="capability-grid">{#each membershipConfigFor(selectedPerson).teams.filter(team => team.active) as team}<label class="capability-option"><input type="checkbox" name="teamIds" value={team.id} checked={(selectedPerson.teamIds ?? []).includes(team.id)} disabled={selectedPerson.id === data.currentUser.id} /><span><strong>{team.name}</strong><small>{team.description}</small></span></label>{/each}</div></fieldset>
              <div class="dialog-actions"><button class="primary-action" type="submit" disabled={selectedPerson.id === data.currentUser.id}>Save access & eligibility</button></div>
            </form>
            <div class="account-management"><h3>Account access</h3><p>These actions affect sign-in access, not dispatch availability.</p><div class="account-actions"><form method="POST" action={selectedPerson.enabled ? '?/disableUser' : '?/enableUser'}><input type="hidden" name="userId" value={selectedPerson.id} /><button type="submit">{selectedPerson.enabled ? 'Disable access' : 'Enable access'}</button></form><form method="POST" action="?/resetPassword"><input type="hidden" name="userId" value={selectedPerson.id} /><button type="submit">Reset password</button></form><form method="POST" action="?/removeUser" onsubmit={(event) => { if (!confirm('Remove this person from Rescue Hub? This cannot be undone.')) event.preventDefault(); }}><input type="hidden" name="userId" value={selectedPerson.id} /><button class="danger" type="submit">Remove person</button></form></div></div>
          </div>
        </div>
      {/if}
    {:else}
      <section class="panel page-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Governance</p>
            <h2>Audit history</h2>
            <p class="intro">Presentation events show how operational changes become a regulator-visible timeline.</p>
          </div>
        </div>
        <div class="audit-list">
          {#each data.auditEvents as event}
            <article>
              <div>
                <strong>{event.action.replaceAll('_', ' ')}</strong>
                <span>{event.summary}</span>
              </div>
              <time>{formatDate(event.createdAt)}</time>
            </article>
          {:else}
            <div class="empty-state large">
              <strong>No audit events yet</strong>
              <span>Operational changes will appear here as immutable audit history.</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </main>
</div>

<style>
  .adam-invite { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border:1px solid var(--rh-t72, #a7c6b1); background:var(--rh-t73, #f2f8f3); border-radius: 12px; }
  
  @media (max-width: 700px) { .adam-invite { flex-direction: column; align-items: stretch; } }

  .reviewer-note { padding: 13px 16px; border:1px solid var(--rh-t74, #dfc995); border-radius: 9px; background:var(--rh-t75, #fff8e7); font-size: 12px; }
  .reviewer-note p { margin: 5px 0 0; line-height: 1.5; }

  .people-workspace { display: grid; gap: 22px; }
  .people-head, .directory-toolbar, .dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
  .people-head h2, .dialog-heading h2 { margin: 5px 0 8px; font-size: 27px; }
  .people-head .intro { max-width: 660px; }
  .people-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
  .people-stats > div { background:var(--rh-t6, white); border:1px solid var(--line); border-radius: 13px; padding: 18px; display: grid; gap: 8px; }
  .people-stats span { color:var(--muted); font-size: 12px; }
  .people-stats strong { font-size: 29px; line-height: 1; }
  .people-directory { overflow: hidden; padding: 0; }
  .directory-toolbar { padding: 22px 22px 12px; }
  .directory-toolbar h3 { margin: 0; font-size: 18px; }
  .directory-toolbar p { margin: 5px 0 0; font-size: 12px; color:var(--muted); }
  .people-search { min-width: min(100%, 330px); }
  .people-search input { width: 100%; padding: 11px 13px; border:1px solid var(--line); border-radius: 9px; background:var(--rh-t6, white); }
  .people-filters { display: flex; gap: 8px; padding: 4px 22px 18px; flex-wrap: wrap; }
  .people-filters button { border:1px solid var(--line); border-radius: 999px; background:var(--rh-t6, white); padding: 8px 14px; font: inherit; font-size: 12px; cursor: pointer; }
  .people-filters button.chosen { background:var(--forest); color:white; border-color:var(--forest); }
  .person-row { display: grid; grid-template-columns: 42px minmax(170px, 1.4fr) minmax(130px, 1fr) minmax(130px, 1fr) 90px 16px; gap: 15px; align-items: center; width: 100%; text-align: left; padding: 16px 22px; border:0; border-top:1px solid var(--line); background:var(--rh-t6, white); color:var(--ink); cursor: pointer; font: inherit; }
  .person-row:hover, .person-row:focus-visible { background:var(--surface-soft); }
  .person-avatar { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; background:var(--rh-t76, #e5eee7); color:var(--forest); font-size: 13px; font-weight: 750; }
  .person-identity, .person-role { display: grid; gap: 3px; min-width: 0; }
  .person-identity strong, .person-role strong { font-size: 13px; overflow-wrap: anywhere; }
  .person-identity small, .person-role small, .person-teams { color:var(--muted); font-size: 11px; overflow-wrap: anywhere; }
  .person-chevron { font-size: 25px; color:var(--muted); }
  .people-overlay { position: fixed; inset: 0; z-index: 100; background:rgba(10,27,18,.56); display: flex; justify-content: flex-end; }
  .people-dialog { width: min(100%, 690px); height: 100%; overflow-y: auto; padding: 28px; background:var(--rh-t6, white); box-shadow: -15px 0 50px rgba(0,0,0,.14); }
  .dialog-heading { align-items: flex-start; border-bottom:1px solid var(--line); padding-bottom: 18px; margin-bottom: 20px; }
  .dialog-close { border:1px solid var(--line); background:var(--rh-t6, white); border-radius: 9px; width: 36px; height: 36px; font-size: 25px; cursor: pointer; }
  .person-form { display: grid; gap: 18px; }
  .access-group { display: grid; gap: 6px; padding: 15px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); }
  .permission-help { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
  .person-form label:not(.capability-option) { display: grid; gap: 7px; font-size: 12px; font-weight: 700; }
  .person-form input:not([type='checkbox']), .person-form select { width: 100%; padding: 11px; border:1px solid var(--line); border-radius: 8px; background:var(--rh-t6, white); font: inherit; }
  .form-pair { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
  .capability-picker { border:0; padding: 0; margin: 0; min-width: 0; }
  .capability-picker legend { font-weight: 750; font-size: 14px; margin-bottom: 12px; }
  .capability-picker legend small { display: block; font-weight: 400; color:var(--muted); margin-top: 4px; }
  .capability-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 9px; }
  .capability-option { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border:1px solid var(--line); border-radius: 10px; cursor: pointer; }
  .capability-option:has(input:checked) { background:var(--rh-t77, #f0f7e7); border-color:var(--rh-t78, #91b58c); }
  .capability-option input { margin: 3px 0 0; flex-shrink: 0; accent-color: var(--forest); }
  .capability-option span { display: grid; gap: 4px; }
  .capability-option strong { font-size: 12px; }
  .capability-option small { font-size: 11px; font-weight: 400; color:var(--muted); line-height: 1.4; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 16px; border-top:1px solid var(--line); }
  .dialog-actions button, .account-actions button { padding: 10px 15px; border-radius: 8px; border:1px solid var(--line); cursor: pointer; font: inherit; }
  .person-detail-summary { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 22px; color:var(--muted); font-size: 12px; }
  .account-management { margin-top: 28px; padding-top: 20px; border-top:1px solid var(--line); }
  .account-management h3 { margin: 0 0 7px; }
  .account-management p { color:var(--muted); font-size: 12px; }
  .account-actions { display: flex; gap: 9px; flex-wrap: wrap; margin-top: 16px; }
  .account-actions .danger { color:var(--rh-t79, #a32929); border-color:var(--rh-t80, #e6b6b6); }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border:0; }
  @media (max-width: 1100px) { .person-row { grid-template-columns: 42px minmax(150px,1.5fr) minmax(110px,1fr) 90px 16px; } .person-teams { display: none; } }
  @media (max-width: 700px) { .people-head, .directory-toolbar { align-items: stretch; flex-direction: column; } .people-stats { grid-template-columns: repeat(2,minmax(0,1fr)); } .person-row { grid-template-columns: 38px minmax(0,1fr) 18px; gap: 10px; padding: 13px; } .person-role, .person-status { display: none; } .people-dialog { padding: 18px; } .form-pair, .capability-grid { grid-template-columns: 1fr; } }

  .admin-shell {
    --ink: #17211d;
    --muted: #66736c;
    --line: #d9e1dc;
    --surface: #ffffff;
    --surface-soft: #f5f8f6;
    --forest: #173d2c;
    --forest-2: #24583f;
    --lime: #c9f04a;
    --danger: #b13c3c;
    --amber: #966d10;
    min-height: 100vh;
    background:
      radial-gradient(circle at 80% 0%, rgba(201, 240, 74, 0.10), transparent 30rem),
      #edf1ee;
    display: grid;
    grid-template-columns: 244px minmax(0, 1fr);
  }

  .sidebar {
    min-height: 100vh;
    position: sticky;
    top: 0;
    align-self: start;
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    color:#eef7f0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 28%),
      var(--forest);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 8px 26px;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background:var(--lime);
    color:var(--rh-t3, #173d2c);
    font-weight: 900;
    letter-spacing: -0.05em;
  }

  .brand strong,
  .brand span,
  .sidebar-footer strong,
  .sidebar-footer span {
    display: block;
  }

  .brand strong {
    font-size: 19px;
  }

  .brand span {
    margin-top: 2px;
    color:var(--rh-t81, #9fbaa9);
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  nav {
    display: grid;
    gap: 5px;
  }

  nav button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    border:0;
    border-radius: 10px;
    background:transparent;
    color:var(--rh-t82, #bcd0c3);
    cursor: pointer;
    text-align: left;
  }

  nav button:hover,
  nav button.active {
    background:rgba(255, 255, 255, 0.075);
    color:white;
  }

  .nav-icon {
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    border-radius: 8px;
    background:rgba(255, 255, 255, 0.08);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  nav button.active .nav-icon {
    background:var(--lime);
    color:var(--forest);
  }

  .documentation-link {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px 12px;
    margin-top: 12px;
    color:#dceadd;
    font-weight: 650;
    font-size: 13px;
    text-decoration: none;
    border:1px solid rgba(255, 255, 255, .13);
    border-radius: 9px;
  }
  .documentation-link:hover,
  .documentation-link:focus-visible {
    background:rgba(255, 255, 255, .09);
    color:#fff;
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 18px 8px 2px;
    border-top:1px solid rgba(255, 255, 255, 0.1);
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .sidebar-footer strong {
    font-size: 14px;
  }

  .sidebar-footer span {
    margin-top: 2px;
    color:var(--rh-t83, #91aa9a);
    font-size: 13px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background:#ca7a60;
    box-shadow: 0 0 0 4px rgba(202, 122, 96, 0.11);
  }

  .status-dot.online {
    background:var(--rh-t84, #81db8d);
    box-shadow: 0 0 0 4px rgba(129, 219, 141, 0.11);
  }

  main {
    min-width: 0;
    padding: 0 30px 44px;
  }

  .topbar {
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 28px;
    border-bottom:1px solid var(--line);
  }

  .topbar h1,
  .panel h2 {
    margin: 0;
    color:var(--ink);
    letter-spacing: -0.035em;
  }

  .topbar h1 {
    font-size: clamp(25px, 3vw, 34px);
  }

  .eyebrow {
    margin: 0 0 5px;
    color:var(--rh-t85, #648074);
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.13em;
  }

  .admin-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .demo-launch {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 9px;
    background:var(--forest);
    color:white;
    font-size: 12px;
    font-weight: 800;
    text-decoration: none;
  }

  .demo-identity {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .demo-identity strong,
  .demo-identity > div > span {
    display: block;
    text-align: right;
  }

  .demo-identity strong {
    font-size: 15px;
  }

  .demo-identity > div > span {
    margin-top: 2px;
    color:var(--muted);
    font-size: 13px;
  }

  .avatar {
    order: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 38px;
    width: 38px;
    height: 38px;
    margin: 0;
    padding: 0;
    line-height: 1;
    border-radius: 50%;
    background:var(--rh-t86, #dce8df);
    color:var(--forest);
    font-size: 14px;
    font-weight: 800;
  }

  .backend-warning {
    margin-top: 22px;
    display: grid;
    gap: 5px;
    padding: 14px 16px;
    border:1px solid var(--rh-t87, #e4c986);
    border-radius: 12px;
    background:var(--rh-t88, #fff8e6);
    color:var(--rh-t89, #674f16);
    font-size: 15px;
  }

  .backend-warning span {
    color:var(--rh-t90, #806928);
  }

  .backend-warning details {
    margin-top: 5px;
  }

  .backend-warning details code {
    display: block;
    margin-top: 6px;
    white-space: normal;
    font-size: 13px;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 24px;
  }

  .metrics article {
    padding: 18px;
    min-height: 128px;
    border:1px solid var(--line);
    border-radius: 14px;
    background:rgba(255, 255, 255, 0.74);
    box-shadow: 0 10px 30px rgba(29, 55, 42, 0.035);
  }

  .metric-label,
  .metrics small {
    display: block;
    color:var(--muted);
  }

  .metric-label {
    font-size: 14px;
    font-weight: 700;
  }

  .metrics strong {
    display: block;
    margin: 15px 0 7px;
    color:var(--forest);
    font-size: 30px;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .metrics small {
    font-size: 13px;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(260px, 0.7fr);
    gap: 14px;
    margin-top: 14px;
  }

  .panel {
    min-width: 0;
    padding: 21px;
    border:1px solid var(--line);
    border-radius: 16px;
    background:rgba(255, 255, 255, 0.84);
    box-shadow: 0 12px 32px rgba(29, 55, 42, 0.04);
  }

  .panel.wide {
    grid-row: span 2;
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 17px;
  }

  .panel h2 {
    font-size: 22px;
  }

  .text-button {
    padding: 0;
    border:0;
    background:none;
    color:var(--forest-2);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .organisation-list {
    display: grid;
  }

  .organisation-row {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto auto;
    gap: 12px;
    align-items: center;
    width: 100%;
    padding: 10px 0;
    border:0;
    border-top:1px solid var(--rh-t91, #e8eeea);
    background:transparent;
    text-align: left;
    cursor: pointer;
  }

  .organisation-row:first-child {
    border-top:0;
  }

  .organisation-row:hover .org-main strong {
    color:var(--forest-2);
  }

  .org-initials {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background:var(--surface-soft);
    color:var(--forest);
    font-size: 12px;
    font-weight: 900;
  }

  .org-main {
    min-width: 0;
  }

  .org-main strong,
  .org-main small {
    display: block;
  }

  .org-main strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
  }

  .org-main small {
    margin-top: 3px;
    overflow: hidden;
    color:var(--muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .boundary,
  .claim,
  .rescue-status {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
  }

  .boundary {
    background:var(--rh-t92, #f1f3f2);
    color:var(--rh-t9, #66736c);
  }

  .boundary.gis {
    background:var(--rh-t93, #e7f5eb);
    color:var(--rh-t94, #29633e);
  }

  .claim {
    background:var(--rh-t95, #f5efe1);
    color:var(--rh-t96, #7c6329);
  }

  .rescue-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }

  .rescue-summary div {
    padding: 12px 8px;
    border-radius: 11px;
    background:var(--surface-soft);
    text-align: center;
  }

  .rescue-summary span,
  .rescue-summary strong {
    display: block;
  }

  .rescue-summary span {
    color:var(--muted);
    font-size: 12px;
  }

  .rescue-summary strong {
    margin-top: 5px;
    color:var(--forest);
    font-size: 21px;
  }

  .primary-action {
    width: 100%;
    margin-top: 14px;
    padding: 11px 14px;
    border:0;
    border-radius: 10px;
    background:var(--forest);
    color:white;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .primary-action:hover {
    background:var(--forest-2);
  }

  .coverage-figure {
    display: grid;
    grid-template-columns: 78px 1fr;
    gap: 16px;
    align-items: center;
  }

  .coverage-ring {
    --coverage: 0%;
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: conic-gradient(var(--forest-2) var(--coverage), #e8eeea 0);
    position: relative;
  }

  .coverage-ring::after {
    content: '';
    position: absolute;
    inset: 7px;
    border-radius: 50%;
    background:var(--rh-t6, white);
  }

  .coverage-ring strong {
    position: relative;
    z-index: 1;
    font-size: 19px;
  }

  .coverage-figure p {
    margin: 0;
    color:var(--muted);
    font-size: 14px;
    line-height: 1.55;
  }

  .page-panel,
  .feature-grid {
    margin-top: 24px;
  }

  .table-heading {
    align-items: end;
  }

  .intro {
    max-width: 660px;
    margin: 7px 0 0;
    color:var(--muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .search {
    display: grid;
    gap: 5px;
    min-width: min(310px, 100%);
    color:var(--muted);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search input {
    width: 100%;
    padding: 9px 11px;
    border:1px solid var(--rh-t97, #d4ddd7);
    border-radius: 9px;
    outline: none;
    background:var(--rh-t6, white);
    color:var(--ink);
    font-size: 14px;
    text-transform: none;
    letter-spacing: normal;
  }

  .search input:focus {
    border-color:#6e947e;
    box-shadow: 0 0 0 3px rgba(110, 148, 126, 0.12);
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th {
    padding: 9px 11px;
    border-bottom:1px solid var(--line);
    color:var(--rh-t11, #718078);
    font-size: 12px;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  td {
    max-width: 340px;
    padding: 12px 11px;
    border-bottom:1px solid var(--rh-t91, #e8eeea);
    vertical-align: top;
    color:var(--rh-t98, #4b5b52);
    line-height: 1.45;
  }

  td strong,
  td span {
    display: block;
  }

  td strong {
    color:var(--ink);
    font-size: 14px;
  }

  td span {
    margin-top: 2px;
    color:var(--muted);
    font-size: 12px;
  }

  td .boundary,
  td .claim {
    margin: 0;
  }

  .rescue-status {
    margin: 0;
    background:var(--rh-t99, #edf0ee);
  }

  .status-pending {
    background:var(--rh-t100, #fff1cd);
    color:var(--rh-t101, #7b5b0d);
  }

  .status-assigned {
    background:var(--rh-t102, #e8eefc);
    color:var(--rh-t103, #355a9a);
  }

  .status-completed {
    background:var(--rh-t104, #e2f3e8);
    color:var(--rh-t105, #27663e);
  }

  .feature-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(360px, 1.2fr);
    gap: 14px;
  }

  .feature-copy > p:not(.eyebrow) {
    color:var(--muted);
    font-size: 15px;
    line-height: 1.65;
  }

  .readiness {
    display: grid;
    gap: 8px;
    margin-top: 24px;
  }

  .readiness span {
    display: flex;
    justify-content: space-between;
    padding: 11px 0;
    border-top:1px solid var(--line);
    color:var(--muted);
    font-size: 14px;
  }

  .readiness strong {
    color:var(--forest);
  }

  .map-placeholder {
    min-height: 430px;
    display: grid;
    place-content: center;
    gap: 5px;
    border-radius: 16px;
    background:
      radial-gradient(circle at 30% 22%, rgba(201, 240, 74, 0.22), transparent 19%),
      linear-gradient(145deg, #214b37, #112f23);
    color:white;
    text-align: center;
  }

  

  

  

  .invite-user {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1.2fr 1fr 1fr;
    gap: 10px;
    align-items: end;
    padding: 15px;
    border:1px solid var(--line);
    border-radius: 12px;
    background:var(--surface-soft);
  }

  

  

  

  

  .invite-button {
    width: auto;
    margin: 0;
    min-height: 36px;
    align-self: end;
  }

  .invite-teams {
    grid-column: 1 / -1;
  }

  .team-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 12px;
    margin: 0;
    padding: 10px 12px;
    border:1px solid var(--line);
    border-radius: 9px;
  }

  

  

  

  .team-picker.compact {
    display: grid;
    max-width: 250px;
    margin: 8px 0;
  }

  

  .team-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  

  

  .availability-state {
    display: inline-flex;
    width: max-content;
    padding: 3px 7px;
    border-radius: 999px;
    background:var(--rh-t92, #f1f3f2);
    color:var(--rh-t106, #69766f);
    font-size: 12px;
    font-weight: 800;
  }

  .availability-state.available {
    background:var(--rh-t93, #e7f5eb);
    color:var(--rh-t94, #29633e);
  }

  .dispatch-editor {
    position: relative;
  }

  

  

  

  

  .people-feedback {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 9px;
    font-size: 12px;
  }

  .people-feedback.success {
    background:var(--rh-t93, #e7f5eb);
    color:var(--rh-t94, #29633e);
  }

  .people-feedback.error {
    background:var(--rh-t64, #fff0ed);
    color:var(--rh-t107, #9d3c34);
  }

  .people-feedback code {
    padding: 3px 6px;
    border-radius: 5px;
    background:rgb(255 255 255 / 0.7);
  }

  .people-table {
    margin-top: 18px;
  }

  .identity-status,
  .access-state {
    display: inline-flex;
    width: max-content;
    margin: 0;
    padding: 3px 7px;
    border-radius: 999px;
    background:var(--rh-t108, #f3efe4);
    color:var(--rh-t109, #755c20);
    font-size: 12px;
    font-weight: 800;
  }

  .access-state.enabled {
    background:var(--rh-t93, #e7f5eb);
    color:var(--rh-t94, #29633e);
  }

  .user-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  

  

  

  .broadcast-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 18px;
  }

  

  

  

  

  .audit-list {
    display: grid;
  }

  .audit-list article {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 12px 0;
    border-top:1px solid var(--line);
  }

  .audit-list article:first-child {
    border-top:0;
  }

  .audit-list strong,
  .audit-list span {
    display: block;
  }

  .audit-list strong {
    color:var(--ink);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .audit-list span {
    margin-top: 3px;
    color:var(--muted);
    font-size: 13px;
  }

  .audit-list time {
    flex: 0 0 auto;
    color:var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }

  .empty-state {
    display: grid;
    gap: 4px;
    padding: 28px 10px;
    color:var(--muted);
    text-align: center;
    font-size: 13px;
  }

  .empty-state strong {
    color:var(--ink);
    font-size: 15px;
  }

  .empty-state.large {
    min-height: 310px;
    place-content: center;
  }

  .empty-feature {
    min-height: 340px;
    display: grid;
    place-content: center;
    max-width: none;
    text-align: center;
  }

  

  @media (max-width: 1050px) {
    .metrics {
      grid-template-columns: repeat(2, 1fr);
    }

    .dashboard-grid,
    .feature-grid {
      grid-template-columns: 1fr;
    }

    .panel.wide {
      grid-row: auto;
    }
  }

  @media (max-width: 780px) {
    .admin-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      min-height: auto;
      position: static;
      padding: 14px;
    }

    .brand {
      padding-bottom: 12px;
    }

    nav {
      display: flex;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    nav button {
      width: auto;
      flex: 0 0 auto;
    }

    .sidebar-footer {
      display: none;
    }

    main {
      padding: 0 15px 28px;
    }

    .topbar {
      min-height: 88px;
    }

    .demo-identity div {
      display: none;
    }

    .table-heading {
      display: grid;
    }

    .invite-user {
      grid-template-columns: 1fr 1fr;
    }

    .invite-button {
      width: 100%;
    }

    .search {
      min-width: 100%;
    }
  }

  @media (max-width: 520px) {
    .metrics {
      grid-template-columns: 1fr 1fr;
    }

    .metrics article {
      min-height: 112px;
      padding: 14px;
    }

    .organisation-row {
      grid-template-columns: 34px minmax(0, 1fr) auto;
    }

    .organisation-row .boundary {
      display: none;
    }

    .coverage-figure {
      grid-template-columns: 1fr;
    }

    .invite-user,
    .broadcast-grid {
      grid-template-columns: 1fr;
    }
  }

  .reviewer-invite { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
  
  
  
</style>
