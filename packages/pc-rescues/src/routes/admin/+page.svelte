<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

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

    <div class="sidebar-footer">
      <div class:online={data.backend.online} class="status-dot"></div>
      <div>
        <strong>{data.backend.online ? 'SST backend online' : 'Local UI mode'}</strong>
        <span>{data.backend.online ? 'AppSync + DynamoDB' : 'Backend data unavailable'}</span>
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

      <div class="demo-identity">
        <span class="avatar">MC</span>
        <div>
          <strong>Demo administrator</strong>
          <span>Independent Rescue Hub prototype</span>
        </div>
      </div>
    </header>

    {#if !data.backend.online}
      <section class="backend-warning">
        <strong>The interface is running, but the SST data layer is not currently reachable.</strong>
        <span>
          Start Rescue Hub from the repository root with <code>npm run dev</code>. SST injects
          the linked AppSync resources into this server process.
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
          <span class="metric-label">Platform stage</span>
          <strong class="text-metric">Demo</strong>
          <small>independent NSW prototype</small>
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
              Seeded public providers remain unclaimed until an authorised representative is verified.
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
                    {#if organisation.id === 'native-animal-trust-fund'}
                      <em>Demo organisation</em>
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
            <strong>No rescue records in this stage yet</strong>
            <span>New dispatches from PC Rescues will appear here as the demonstration data is created.</span>
          </div>
        {/if}
      </section>
    {:else if section === 'regions'}
      <section class="feature-grid">
        <article class="panel page-panel feature-copy">
          <p class="eyebrow">Operating areas</p>
          <h2>NSW geographic authority</h2>
          <p>
            This section will combine the DCCEEW operating-area polygons with the seeded organisation
            directory. It is the administrative source of truth for dispatch routing.
          </p>
          <div class="readiness">
            <span><strong>{gisOrganisations.length}</strong> GIS sources identified</span>
            <span><strong>{Math.max(0, (data.organisations.length || 35) - gisOrganisations.length)}</strong> text-only areas</span>
          </div>
        </article>
        <article class="map-placeholder">
          <span>NSW</span>
          <strong>Operating-area map</strong>
          <small>GIS polygons are the next integration step.</small>
        </article>
      </section>
    {:else if section === 'people'}
      <section class="panel page-panel empty-feature">
        <p class="eyebrow">Identity & permissions</p>
        <h2>People and access</h2>
        <p>
          Organisation claims, governing users, dispatchers, rescuers, carers and data stewards will
          be administered here once identity is connected.
        </p>
      </section>
    {:else}
      <section class="panel page-panel empty-feature">
        <p class="eyebrow">Governance</p>
        <h2>Audit history</h2>
        <p>
          Rescue creation, assignment, status changes, outcomes, euthanasia records and privileged
          administrative corrections will be surfaced here as immutable audit events.
        </p>
      </section>
    {/if}
  </main>
</div>

<style>
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
    color: #eef7f0;
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
    background: var(--lime);
    color: #173d2c;
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
    font-size: 15px;
  }

  .brand span {
    margin-top: 2px;
    color: #9fbaa9;
    font-size: 11px;
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
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: #bcd0c3;
    cursor: pointer;
    text-align: left;
  }

  nav button:hover,
  nav button.active {
    background: rgba(255, 255, 255, 0.075);
    color: white;
  }

  .nav-icon {
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  nav button.active .nav-icon {
    background: var(--lime);
    color: var(--forest);
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 18px 8px 2px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .sidebar-footer strong {
    font-size: 11px;
  }

  .sidebar-footer span {
    margin-top: 2px;
    color: #91aa9a;
    font-size: 10px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #ca7a60;
    box-shadow: 0 0 0 4px rgba(202, 122, 96, 0.11);
  }

  .status-dot.online {
    background: #81db8d;
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
    border-bottom: 1px solid var(--line);
  }

  .topbar h1,
  .panel h2,
  .empty-feature h2 {
    margin: 0;
    color: var(--ink);
    letter-spacing: -0.035em;
  }

  .topbar h1 {
    font-size: clamp(25px, 3vw, 34px);
  }

  .eyebrow {
    margin: 0 0 5px;
    color: #648074;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.13em;
  }

  .demo-identity {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .demo-identity strong,
  .demo-identity span {
    display: block;
    text-align: right;
  }

  .demo-identity strong {
    font-size: 12px;
  }

  .demo-identity span {
    margin-top: 2px;
    color: var(--muted);
    font-size: 10px;
  }

  .avatar {
    order: 2;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #dce8df;
    color: var(--forest);
    font-size: 11px;
    font-weight: 800;
  }

  .backend-warning {
    margin-top: 22px;
    display: grid;
    gap: 5px;
    padding: 14px 16px;
    border: 1px solid #e4c986;
    border-radius: 12px;
    background: #fff8e6;
    color: #674f16;
    font-size: 12px;
  }

  .backend-warning span {
    color: #806928;
  }

  .backend-warning details {
    margin-top: 5px;
  }

  .backend-warning details code {
    display: block;
    margin-top: 6px;
    white-space: normal;
    font-size: 10px;
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
    border: 1px solid var(--line);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.74);
    box-shadow: 0 10px 30px rgba(29, 55, 42, 0.035);
  }

  .metric-label,
  .metrics small {
    display: block;
    color: var(--muted);
  }

  .metric-label {
    font-size: 11px;
    font-weight: 700;
  }

  .metrics strong {
    display: block;
    margin: 15px 0 7px;
    color: var(--forest);
    font-size: 30px;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .metrics strong.text-metric {
    font-size: 25px;
  }

  .metrics small {
    font-size: 10px;
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
    border: 1px solid var(--line);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.84);
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
    font-size: 17px;
  }

  .text-button {
    padding: 0;
    border: 0;
    background: none;
    color: var(--forest-2);
    font-size: 11px;
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
    border: 0;
    border-top: 1px solid #e8eeea;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .organisation-row:first-child {
    border-top: 0;
  }

  .organisation-row:hover .org-main strong {
    color: var(--forest-2);
  }

  .org-initials {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--surface-soft);
    color: var(--forest);
    font-size: 9px;
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
    font-size: 12px;
  }

  .org-main small {
    margin-top: 3px;
    overflow: hidden;
    color: var(--muted);
    font-size: 10px;
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
    font-size: 9px;
    font-weight: 800;
  }

  .boundary {
    background: #f1f3f2;
    color: #66736c;
  }

  .boundary.gis {
    background: #e7f5eb;
    color: #29633e;
  }

  .claim {
    background: #f5efe1;
    color: #7c6329;
  }

  .rescue-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }

  .rescue-summary div {
    padding: 12px 8px;
    border-radius: 11px;
    background: var(--surface-soft);
    text-align: center;
  }

  .rescue-summary span,
  .rescue-summary strong {
    display: block;
  }

  .rescue-summary span {
    color: var(--muted);
    font-size: 9px;
  }

  .rescue-summary strong {
    margin-top: 5px;
    color: var(--forest);
    font-size: 21px;
  }

  .primary-action {
    width: 100%;
    margin-top: 14px;
    padding: 11px 14px;
    border: 0;
    border-radius: 10px;
    background: var(--forest);
    color: white;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .primary-action:hover {
    background: var(--forest-2);
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
    background: white;
  }

  .coverage-ring strong {
    position: relative;
    z-index: 1;
    font-size: 15px;
  }

  .coverage-figure p {
    margin: 0;
    color: var(--muted);
    font-size: 11px;
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
    color: var(--muted);
    font-size: 11px;
    line-height: 1.5;
  }

  .search {
    display: grid;
    gap: 5px;
    min-width: min(310px, 100%);
    color: var(--muted);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search input {
    width: 100%;
    padding: 9px 11px;
    border: 1px solid #d4ddd7;
    border-radius: 9px;
    outline: none;
    background: white;
    color: var(--ink);
    font-size: 11px;
    text-transform: none;
    letter-spacing: normal;
  }

  .search input:focus {
    border-color: #6e947e;
    box-shadow: 0 0 0 3px rgba(110, 148, 126, 0.12);
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  th {
    padding: 9px 11px;
    border-bottom: 1px solid var(--line);
    color: #718078;
    font-size: 9px;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  td {
    max-width: 340px;
    padding: 12px 11px;
    border-bottom: 1px solid #e8eeea;
    vertical-align: top;
    color: #4b5b52;
    line-height: 1.45;
  }

  td strong,
  td span,
  td em {
    display: block;
  }

  td strong {
    color: var(--ink);
    font-size: 11px;
  }

  td span {
    margin-top: 2px;
    color: var(--muted);
    font-size: 9px;
  }

  td em {
    width: max-content;
    margin-top: 5px;
    padding: 3px 6px;
    border-radius: 5px;
    background: #eef4da;
    color: #526b18;
    font-size: 8px;
    font-style: normal;
    font-weight: 800;
    text-transform: uppercase;
  }

  td .boundary,
  td .claim {
    margin: 0;
  }

  .rescue-status {
    margin: 0;
    background: #edf0ee;
  }

  .status-pending {
    background: #fff1cd;
    color: #7b5b0d;
  }

  .status-assigned {
    background: #e8eefc;
    color: #355a9a;
  }

  .status-completed {
    background: #e2f3e8;
    color: #27663e;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(360px, 1.2fr);
    gap: 14px;
  }

  .feature-copy > p:not(.eyebrow),
  .empty-feature > p:not(.eyebrow) {
    color: var(--muted);
    font-size: 12px;
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
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 11px;
  }

  .readiness strong {
    color: var(--forest);
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
    color: white;
    text-align: center;
  }

  .map-placeholder > span {
    font-size: 64px;
    font-weight: 900;
    letter-spacing: -0.08em;
    opacity: 0.12;
  }

  .map-placeholder strong {
    font-size: 16px;
  }

  .map-placeholder small {
    color: #a8c5b2;
  }

  .empty-state {
    display: grid;
    gap: 4px;
    padding: 28px 10px;
    color: var(--muted);
    text-align: center;
    font-size: 10px;
  }

  .empty-state strong {
    color: var(--ink);
    font-size: 12px;
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

  .empty-feature p {
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
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
  }
</style>
