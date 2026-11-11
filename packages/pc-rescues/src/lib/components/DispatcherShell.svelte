<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { australianAnimalNames } from '$lib/data/australian-animals';
import { reportChannelLabel } from '../../../../core/report-channel';
		import type { OrganisationMembershipConfig } from '$lib/server/membership';
	import {
		Search,
		Plus,
		MapPin,
		Clock3,
		Radio,
		X,
		ChevronRight,
		CircleCheck,
		Crosshair,
		LoaderCircle
	} from '@lucide/svelte';
	import {
		available,
		coords,
		data,
		people,
		draftLocation,
		intakeOpen,
		mapRef,
		selectedRescue,
		routingExceptions
	} from '$lib/stores';
	import type { RescueItem } from '$lib/stores';

	let {
		backendOnline,
		user,
		demoMode = false,
        membershipConfig
	}: {
		backendOnline: boolean;
		demoMode?: boolean;
        membershipConfig: OrganisationMembershipConfig;
		user: {
			id: string;
			name: string;
			email: string;
			roles: string[];
			organisationId?: string;
		};
	} = $props();

	const userCanDispatch = $derived(
		user.roles.some((role) =>
			['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN', 'DISPATCHER'].includes(role)
		)
	);

	type RescueTab = 'pending' | 'assigned' | 'completed';
	type GeocodeResult = {
		id: string;
		label: string;
		longitude: number;
		latitude: number;
	};

	let tab = $state<RescueTab>('pending');
	let search = $state('');
	let species = $state('');
	let speciesSuggestionsOpen = $state(false);
	const speciesMatches = $derived(species.trim() ? australianAnimalNames.filter((name) => name.toLowerCase().includes(species.trim().toLowerCase())).slice(0, 12) : australianAnimalNames.slice(0, 12));
	let breed = $state('');
	let injury = $state('');
	let callerName = $state('');
	let callerPhone = $state('');
	let addressQuery = $state('');
	let addressResults = $state<GeocodeResult[]>([]);
	let addressSearching = $state(false);
	let submitError = $state('');
	let dispatchNotice = $state('');
	let saving = $state(false);
	let routeBusy = $state('');
	let routeError = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const token = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

	const allRescues = $derived([
		...$data.pending.map((item) => ({ ...item, status: 'PENDING' })),
		...$data.assigned.map((item) => ({ ...item, status: 'ASSIGNED' })),
		...$data.completed.map((item) => ({ ...item, status: 'COMPLETED' }))
	]);

	const currentItems = $derived(
		tab === 'pending' ? $data.pending : tab === 'assigned' ? $data.assigned : $data.completed
	);

	const visibleItems = $derived(
		currentItems.filter((item) => {
			const query = search.trim().toLowerCase();
			if (!query) return true;

			return [item.type, item.breed, item.location, item.injury]
				.join(' ')
				.toLowerCase()
				.includes(query);
		})
	);

	const selected = $derived($selectedRescue);
	const unmatchedReports = $derived(
		tab === 'pending' && userCanDispatch ? $routingExceptions.filter(report => {
			const query = search.trim().toLowerCase();
			return !query || [report.animal, report.condition, report.areaLabel, report.routingReason]
				.filter(Boolean).join(' ').toLowerCase().includes(query);
		}) : []
	);
	async function retryPublicRouting(id: string) {
		if (routeBusy) return;
		routeBusy = id; routeError = '';
		try {
			const response = await fetch(`/api/dispatch/reports/${encodeURIComponent(id)}/convert`, { method: 'POST' });
			const result = await response.json() as { rescue?: RescueItem; error?: string };
			if (!response.ok || !result.rescue) throw new Error(result.error ?? 'Routing has not resolved yet.');
			routingExceptions.update(items => items.filter(item => item.id !== id));
			const routed = { ...result.rescue, color: 'd2222d', disabled: false, status: 'PENDING' };
			data.update(current => ({
				...current,
				pending: [routed, ...current.pending.filter(item => item.id !== routed.id)]
			}));
			dispatchNotice = 'Public report GPS-routed into Pending. Eligible rescuers have been notified.';
		} catch (error) {
			routeError = error instanceof Error ? error.message : 'GPS routing is still unavailable.';
		} finally {
			routeBusy = '';
		}
	}

	function assigneeName(userId?: string | null) {
		if (!userId) return null;
		if (userId === user.id) return user.name;
		return $people.find(person => person.id === userId)?.name ?? 'Assigned responder';
	}

	function rescueProgress(item: RescueItem) {
		if (item.status === 'COMPLETED') {
			switch (item.animalStatus) {
				case 'RELEASED': return 'Released';
				case 'EUTHANISED': return 'Euthanised on veterinary advice';
				case 'DECEASED': return 'Died during treatment';
				default: return 'Case closed';
			}
		}
		if (!item.assignedUserId) return 'Awaiting assignment';
		if (!item.pickedUpAt) return 'Awaiting collection';
		switch (item.animalStatus) {
			case 'AT_VET': return 'At veterinary clinic';
			case 'IN_TRANSIT': return 'In transit';
			case 'IN_CARE': return 'With wildlife carer';
			default: return 'Animal collected';
		}
	}

	const relativeTime = (value?: string) => {
		if (!value) return 'just now';
		const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	};

	function selectRescue(item: RescueItem) {
		$selectedRescue = item;
		const rawMap = $mapRef?.getMap?.();

		rawMap?.flyTo?.({
			center: [Number(item.longitude), Number(item.latitude)],
			zoom: Math.max(rawMap.getZoom?.() ?? 11, 13),
			duration: 550
		});
	}

	function openIntake() {
		$intakeOpen = true;
		$draftLocation = null;
		submitError = '';
	}

	function closeIntake() {
		$intakeOpen = false;
		$draftLocation = null;
		addressResults = [];
		submitError = '';
	}

	function scheduleAddressSearch(value: string) {
		addressQuery = value;
		if (searchTimer) clearTimeout(searchTimer);

		if (value.trim().length < 3) {
			addressResults = [];
			return;
		}

		searchTimer = setTimeout(() => void searchAddress(), 260);
	}

	async function searchAddress() {
		if (!token || addressQuery.trim().length < 3) return;

		addressSearching = true;

		try {
			const params = new URLSearchParams({
				q: addressQuery.trim(),
				access_token: token,
				country: 'au',
				limit: '5',
				proximity: '151.70,-32.93'
			});

			const response = await fetch(
				`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`
			);

			if (!response.ok) throw new Error(`Address search failed: ${response.status}`);

			const payload = (await response.json()) as {
				features?: Array<{
					id: string;
					geometry: { coordinates: [number, number] };
					properties?: {
						full_address?: string;
						name?: string;
						place_formatted?: string;
					};
				}>;
			};

			addressResults = (payload.features ?? []).map((feature) => {
				const properties = feature.properties ?? {};
				const label =
					properties.full_address ??
					[properties.name, properties.place_formatted].filter(Boolean).join(', ') ??
					'Selected location';

				return {
					id: feature.id,
					label,
					longitude: feature.geometry.coordinates[0],
					latitude: feature.geometry.coordinates[1]
				};
			});
		} catch (error) {
			console.error(error);
			addressResults = [];
		} finally {
			addressSearching = false;
		}
	}

	function chooseAddress(result: GeocodeResult) {
		addressQuery = result.label;
		addressResults = [];
		$draftLocation = {
			longitude: result.longitude,
			latitude: result.latitude,
			label: result.label
		};

		$mapRef?.getMap?.()?.flyTo?.({
			center: [result.longitude, result.latitude],
			zoom: 15,
			duration: 550
		});
	}

	function useCurrentLocation() {
		const longitude = Number($coords[0]);
		const latitude = Number($coords[1]);

		$draftLocation = {
			longitude,
			latitude,
			label: 'Current map location'
		};

		$mapRef?.getMap?.()?.flyTo?.({
			center: [longitude, latitude],
			zoom: 15,
			duration: 450
		});
	}

	async function createNewRescue(event: SubmitEvent) {
		event.preventDefault();
		submitError = '';

		const location = $draftLocation;
		if (!location) {
			submitError = 'Choose an address or click the map to place the rescue pin.';
			return;
		}

		if (!species.trim()) {
			submitError = 'Enter the animal type or species.';
			return;
		}

		saving = true;

		try {
			const response = await fetch('/api/rescues', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					type: species.trim(),
					breed: breed.trim(),
					injury: injury.trim(),
					location: addressQuery.trim() || location.label,
					longitude: location.longitude,
					latitude: location.latitude,
					callerName: callerName.trim(),
					callerPhone: callerPhone.trim()
				})
			});

			const payload = (await response.json()) as {
				rescue?: any;
				error?: string;
				notifications?: {
					capability: string;
					eligibleUsers: number;
					pushTokens: number;
					accepted: number;
					rejected: number;
					errors: string[];
				};
			};

			if (!response.ok || !payload.rescue) {
				throw new Error(payload.error ?? 'Unable to create rescue.');
			}

			const rescue = {
				...payload.rescue,
				color: 'd2222d',
				disabled: false
			};

			data.update((current) => ({
				...current,
				pending: [rescue, ...current.pending.filter(item => item.id !== rescue.id)]
			}));

			tab = 'pending';
			$selectedRescue = rescue;
			closeIntake();
			const push = payload.notifications;
			dispatchNotice = !push
				? 'Rescue created; notification delivery status unavailable.'
				: push.errors.length
					? `Rescue created. Push delivery error: ${push.errors.join('; ')}`
					: `Rescue created. ${push.eligibleUsers} eligible rescuer(s), ${push.pushTokens} registered device(s), ${push.accepted} accepted by Expo, ${push.rejected} rejected. Expo acceptance does not confirm phone delivery.`;

			species = '';
			breed = '';
			injury = '';
			callerName = '';
			callerPhone = '';
			addressQuery = '';
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Unable to create rescue.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="dispatcher-shell">
	<aside class="queue">
		<div class="queue-heading">
			<div>
				<p>Dispatch</p>
				<h1>Rescue queue</h1>
			</div>
			<span class:offline={!backendOnline} class="queue-connection" title={backendOnline ? 'Connected to Rescue Hub' : 'Backend unavailable'}>{backendOnline ? 'Connected' : 'Offline'}</span>
			{#if userCanDispatch}
				<button class="new-rescue" type="button" onclick={openIntake}>
					<Plus size={16} />
					New rescue
				</button>
			{/if}
		</div>

		{#if user.roles.some(role => ['RESCUER', 'CARER'].includes(role))}
			<button type="button" class:available={$available} class="queue-duty"
				aria-pressed={$available} onclick={() => ($available = !$available)}>
				<Radio size={15} aria-hidden="true" /> {$available ? 'Available for rescue' : 'Unavailable for rescue'}
			</button>
		{/if}
		{#if dispatchNotice}
			<p role="status" class="dispatch-notice">{dispatchNotice}</p>
		{/if}
		<label class="queue-search">
			<Search size={15} />
			<input bind:value={search} placeholder="Search animal, suburb, condition…" />
		</label>

		<div class="tabs" role="tablist" aria-label="Rescue state">
			<button class:active={tab === 'pending'} type="button" onclick={() => (tab = 'pending')}>
				<span>Pending</span>
				<strong>{$data.pending.length + (userCanDispatch ? $routingExceptions.length : 0)}</strong>
			</button>
			<button class:active={tab === 'assigned'} type="button" onclick={() => (tab = 'assigned')}>
				<span>Assigned</span>
				<strong>{$data.assigned.length}</strong>
			</button>
			<button class:active={tab === 'completed'} type="button" onclick={() => (tab = 'completed')}>
				<span>Completed</span>
				<strong>{$data.completed.length}</strong>
			</button>
		</div>

		<div class="rescue-list">
			{#if tab === 'pending' && unmatchedReports.length}
				{#each unmatchedReports as report (report.id)}
					<article class="rescue-card routing-exception" aria-label="Online public report awaiting GPS routing">
						<span class="rescue-dot state-pending"></span>
						<div class="rescue-content">
							<span class="source-label">Online report · Routing exception</span>
							<strong>{report.animal}</strong>
							<span class="rescue-injury">{report.condition}</span>
							<small class="rescue-injury">GPS {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</small>
							<small class="rescue-injury">Awaiting verified operating area; not yet dispatchable.</small>
							<button class="retry-route" type="button" disabled={Boolean(routeBusy)}
								onclick={() => void retryPublicRouting(report.id)}>
								{routeBusy === report.id ? 'Checking GPS…' : 'Retry GPS routing'}
							</button>
						</div>
					</article>
				{/each}
			{/if}
			{#if routeError}<p role="alert" class="dispatch-notice">{routeError}</p>{/if}
			{#each visibleItems as item (item.id)}
				<button
					type="button"
					class:selected={selected?.id === item.id}
					class="rescue-card"
					onclick={() => selectRescue(item)}
				>
					<span class="rescue-dot state-{tab}"></span>
					<span class="rescue-content">
						<span class="rescue-title">
							<strong>{item.type}</strong>
							<small>{item.breed && item.breed !== '-' ? item.breed : ''}</small>
						</span>
						<span class="rescue-location">
							<MapPin size={12} />
							{item.location || 'Location not recorded'}
						</span>
						<span class="rescue-injury">{item.injury || 'Condition not recorded'}</span>
						<span class="source-label">{reportChannelLabel(item)}</span>
						{#if item.assignedUserId}
							<span class="rescue-assignment">
								<strong>{assigneeName(item.assignedUserId)}</strong>
								<small>· {rescueProgress(item)}</small>
							</span>
						{/if}
					</span>
					<span class="rescue-time">
						<Clock3 size={11} />
						{relativeTime(item.updatedAt)}
					</span>
					<ChevronRight size={15} class="chevron" />
				</button>
			{:else}
				<div class="empty-list" class:hide-empty={unmatchedReports.length > 0}>
					<CircleCheck size={26} />
					<strong>No {tab} rescues</strong>
					<span>Nothing matches the current filter.</span>
				</div>
			{/each}
		</div>

		<div class="queue-footer">
			<span><i class="pending"></i>{$data.pending.length + (userCanDispatch ? $routingExceptions.length : 0)} awaiting dispatch</span>
			<span><i class="assigned"></i>{$data.assigned.length} assigned</span>
		</div>
	</aside>

	{#if selected}
		<section class="detail-card">
			<button
				class="detail-close"
				type="button"
				aria-label="Close rescue details"
				onclick={() => ($selectedRescue = null)}
			>
				<X size={15} />
			</button>

			<p class="detail-kicker">Selected rescue · {reportChannelLabel(selected)}</p>
			<div class="detail-title">
				<div>
					<h2>{selected.type}</h2>
					<span>{selected.breed && selected.breed !== '-' ? selected.breed : 'Species detail unknown'}</span>
				</div>
				<span class="detail-status">
					{allRescues.find((item) => item.id === selected.id)?.status ?? 'PENDING'}
				</span>
			</div>

			<div class="detail-location">
				<MapPin size={15} />
				<div>
					<strong>{selected.location || 'Location not recorded'}</strong>
					<span>{Number(selected.latitude).toFixed(5)}, {Number(selected.longitude).toFixed(5)}</span>
				</div>
			</div>

			{#if selected.assignedUserId}
				<div class="rescue-owner-summary">
					<small>{selected.status === 'COMPLETED' ? 'Responding rescuer' : 'Assigned responder'}</small>
					<strong>{assigneeName(selected.assignedUserId)}</strong>
					<span>{rescueProgress(selected)}{selected.pickedUpAt ? ` · Collected ${new Date(selected.pickedUpAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</span>
				</div>
			{/if}

			<div class="condition">
				<small>Reported condition</small>
				<strong>{selected.injury || 'No condition recorded'}</strong>
			</div>

			<div class="detail-actions">
				{#if selected.assignedUserId === user.id || user.roles.some((role) => ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role))}
					<a class="primary" href="/rescues/{selected.id}/care">Animal Records &amp; Phone Updates</a>
				{:else}
					<p class="detail-restricted">Animal records are available to the assigned rescuer and authorised dispatch staff.</p>
				{/if}
			</div>
		</section>
	{/if}

	{#if $intakeOpen && userCanDispatch}
		<div class="intake-backdrop" role="presentation" onclick={closeIntake}></div>
		<section class="intake" aria-label="Create rescue">
			<header>
				<div>
					<p>New rescue</p>
					<h2>Dispatch intake</h2>
				</div>
				<button type="button" aria-label="Close intake" onclick={closeIntake}>
					<X size={17} />
				</button>
			</header>

			<form onsubmit={createNewRescue}>
				<div class="form-section">
					<label class="field full">
						<span>Address or location</span>
						<div class="address-input">
							<Search size={15} />
							<input
								value={addressQuery}
								oninput={(event) =>
									scheduleAddressSearch((event.currentTarget as HTMLInputElement).value)}
								placeholder="Start typing an NSW address…"
								autocomplete="off"
							/>
							{#if addressSearching}
								<span class="address-spinner"><LoaderCircle size={15} /></span>
							{/if}
						</div>

						{#if addressResults.length}
							<div class="address-results">
								{#each addressResults as result}
									<button type="button" onclick={() => chooseAddress(result)}>
										<MapPin size={13} />
										<span>{result.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</label>

					<div class="location-tools">
						<button type="button" onclick={useCurrentLocation}>
							<Crosshair size={14} />
							Use current map position
						</button>
						<span>or click directly on the map while this panel is open</span>
					</div>

					{#if $draftLocation}
						<div class="location-confirmed">
							<MapPin size={14} />
							<div>
								<strong>Rescue pin set</strong>
								<span>{$draftLocation.label}</span>
							</div>
						</div>
					{/if}
				</div>

				<div class="form-section two-column">
					<label class="field">
						<span>Animal / species</span>
						<input bind:value={species} role="combobox" aria-autocomplete="list" aria-expanded={speciesSuggestionsOpen} aria-controls="animal-species-options" autocomplete="off" placeholder="Search Australian animals…" onfocus={() => (speciesSuggestionsOpen = true)} oninput={() => (speciesSuggestionsOpen = true)} onkeydown={(event) => { if (event.key === 'Escape') speciesSuggestionsOpen = false; }} />
						{#if speciesSuggestionsOpen}
							<div class="animal-options" id="animal-species-options" role="listbox" aria-label="Australian animal suggestions">
								{#each speciesMatches as animal}
									<button type="button" role="option" aria-selected={species === animal} onmousedown={(event) => event.preventDefault()} onclick={() => { species = animal; speciesSuggestionsOpen = false; }}>{animal}</button>
								{:else}
									<p>No catalogue matches. You can still enter an animal name manually.</p>
								{/each}
							</div>
						{/if}
					</label>

					<label class="field">
						<span>Species detail</span>
						<input bind:value={breed} placeholder="Optional" />
					</label>

					<label class="field full">
						<span>Condition / injury</span>
						<textarea
							bind:value={injury}
							rows="3"
							placeholder="What has the caller observed?"
						></textarea>
					</label>
				</div>

				<div class="form-section two-column compact">
					<label class="field">
						<span>Caller name</span>
						<input bind:value={callerName} placeholder="Optional" />
					</label>
					<label class="field">
						<span>Caller phone</span>
						<input bind:value={callerPhone} placeholder="Optional" />
					</label>
				</div>

				{#if submitError}
					<div class="form-error">{submitError}</div>
				{/if}

				<footer>
					<button type="button" class="cancel" onclick={closeIntake}>Cancel</button>
					<button type="submit" class="create" disabled={saving}>
						{#if saving}<LoaderCircle size={15} class="spinner" />{/if}
						Create pending rescue
					</button>
				</footer>
			</form>
		</section>
	{/if}
</div>

<style>
	.dispatch-notice { margin: 8px 12px; padding: 10px 12px; background:var(--rh-t1, #eff6f0); border:1px solid var(--rh-t2, #b8d6c3); border-radius: 9px; color:var(--rh-t3, #173d2c); font-size: 12px; line-height: 1.5; }
	.animal-options { max-height: 230px; overflow-y: auto; border:1px solid var(--rh-t4, #cbd8ce); background:var(--rh-t5, #fff); border-radius: 9px; box-shadow: 0 8px 20px rgba(0,0,0,.09); margin-top: 4px; position: relative; z-index: 5; }
	.animal-options button { display: block; width: 100%; padding: 9px 12px; text-align: left; background:var(--rh-t6, white); border:0; color:var(--rh-t7, #17211d); cursor: pointer; font: inherit; }
	.animal-options button:hover, .animal-options button:focus-visible { background:var(--rh-t8, #eaf2ec); }
	.animal-options p { padding: 10px; margin: 0; font-size: 12px; color:var(--rh-t9, #66736c); }

	.dispatcher-shell {
		position: fixed;
		inset: 0;
		z-index: 20;
		pointer-events: none;
		color:var(--rh-t10, #16231d);
		font-family:
			Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.queue,
	.detail-card,
	.intake {
		pointer-events: auto;
	}

	.queue-connection {
		font-size: 11px;
		color: var(--rh-muted);
		white-space: nowrap;
	}
	.queue-connection::before {
		content: '';
		display: inline-block;
		width: 7px;
		height: 7px;
		margin-right: 6px;
		border-radius: 50%;
		background: #238453;
	}
	.queue-connection.offline::before { background: #c58433; }
	.queue-duty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin: 0 16px 10px;
		min-height: 34px;
		padding: 8px 10px;
		border: 1px solid var(--rh-border);
		border-radius: 9px;
		background: var(--rh-surface-soft);
		color: var(--rh-text);
		font-size: 12px;
		font-weight: 750;
		cursor: pointer;
	}
	.queue-duty.available { color: var(--rh-text); background: var(--rh-accent-soft); }
	.queue-duty :global(svg) { color: var(--rh-accent); }

	.queue {
		position: absolute;
		top: var(--dispatch-content-top, 84px);
		bottom: var(--dispatch-gutter, 16px);
		left: var(--dispatch-gutter, 16px);
		width: var(--dispatch-queue-width, 365px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border:1px solid rgb(27 62 45 / 0.12);
		border-radius: 16px;
		background:rgb(255 255 255 / 0.96);
		box-shadow: 0 16px 42px rgb(26 54 41 / 0.14);
		backdrop-filter: blur(14px);
	}

	.queue-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 16px 12px;
	}

	.queue-heading p,
	.intake header p {
		margin: 0 0 2px;
		color:var(--rh-t22, #748078);
		font-size: 12px;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.queue-heading h1,
	.intake h2,
	.detail-card h2 {
		margin: 0;
		letter-spacing: -0.04em;
	}

	.queue-heading h1 {
		font-size: 19px;
	}

	.new-rescue {
		height: 34px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 11px;
		border:0;
		border-radius: 9px;
		background:#173d2c;
		color:white;
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
	}

	.queue-search {
		margin: 0 16px;
		height: 38px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 10px;
		border:1px solid var(--rh-t23, #dce3df);
		border-radius: 10px;
		background:var(--rh-t24, #f8faf9);
		color:var(--rh-t25, #728078);
	}

	.queue-search input {
		min-width: 0;
		flex: 1;
		border:0;
		outline: 0;
		background:transparent;
		color:var(--rh-t7, #17211d);
		font-size: 13px;
	}

	.tabs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin: 12px 16px 8px;
		padding: 4px;
		border-radius: 10px;
		background:var(--rh-t26, #edf2ef);
	}

	.tabs button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 0;
		padding: 7px 6px;
		border:0;
		border-radius: 7px;
		background:transparent;
		color:var(--rh-t27, #6d7972);
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
	}

	.tabs button.active {
		background:var(--rh-t6, white);
		color:var(--rh-t3, #173d2c);
		box-shadow: 0 2px 7px rgb(23 61 44 / 0.08);
	}

	.tabs strong {
		display: grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 999px;
		background:var(--rh-t28, #e5ebe7);
		font-size: 12px;
	}

	.tabs button.active strong {
		background:var(--rh-t29, #e9f0eb);
	}

	.rescue-list {
		flex: 1;
		overflow-y: auto;
		padding: 2px 10px 10px;
	}

	.rescue-card {
		position: relative;
		width: 100%;
		display: grid;
		grid-template-columns: 8px minmax(0, 1fr) auto 16px;
		gap: 10px;
		align-items: center;
		padding: 12px 9px;
		border:1px solid transparent;
		border-bottom-color:var(--rh-t30, #edf1ee);
		background:transparent;
		text-align: left;
		cursor: pointer;
	}

	.rescue-card:hover,
	.rescue-card.selected {
		border-radius: 10px;
		border-color:var(--rh-t31, #d9e5dd);
		background:var(--rh-t32, #f6faf7);
	}

	.rescue-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}

	.state-pending {
		background:#d92b04;
	}

	.state-assigned {
		background:var(--rh-t33, #f2b705);
	}

	.state-completed {
		background:#50a971;
	}

	.rescue-content,
	.rescue-title,
	.rescue-location,
	.rescue-injury {
		min-width: 0;
	}

	.rescue-title {
		display: flex;
		align-items: baseline;
		gap: 5px;
	}

	.rescue-title strong {
		font-size: 14px;
	}

	.rescue-title small {
		overflow: hidden;
		color:var(--rh-t34, #7c8881);
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rescue-location,
	.rescue-injury {
		display: flex;
		align-items: center;
		gap: 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rescue-location {
		margin-top: 3px;
		color:var(--rh-t35, #516159);
		font-size: 12px;
	}

	.rescue-injury {
		margin-top: 2px;
		color:var(--rh-t36, #849088);
		font-size: 12px;
	}

	.rescue-time {
		display: flex;
		align-items: center;
		gap: 3px;
		color:var(--rh-t37, #89958e);
		font-size: 12px;
		white-space: nowrap;
	}

	.chevron {
		color:var(--rh-t38, #a5afa9);
	}

	.empty-list {
		min-height: 250px;
		display: grid;
		place-content: center;
		gap: 5px;
		color:var(--rh-t11, #718078);
		text-align: center;
	}

	.empty-list :global(svg) {
		margin: 0 auto 5px;
		color:var(--rh-t39, #8fad99);
	}

	.empty-list strong {
		color:var(--rh-t40, #293730);
		font-size: 14px;
	}

	.empty-list span {
		font-size: 12px;
	}

	.queue-footer {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 10px 16px;
		border-top:1px solid var(--rh-t41, #e5ebe7);
		background:var(--rh-t42, #fafcfb);
		color:var(--rh-t43, #6f7d75);
		font-size: 12px;
	}

	.queue-footer span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.queue-footer i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.queue-footer i.pending {
		background:#d92b04;
	}

	.queue-footer i.assigned {
		background:var(--rh-t33, #f2b705);
	}

	.detail-card {
		position: absolute;
		/* Leave the right-hand operating-area panel unobstructed. */
		right: calc(var(--dispatch-areas-width, 285px) + var(--dispatch-gutter, 16px) * 2);
		bottom: var(--dispatch-gutter, 16px);
		width: 320px;
		padding: 17px;
		border:1px solid rgb(27 62 45 / 0.12);
		border-radius: 15px;
		background:rgb(255 255 255 / 0.96);
		box-shadow: 0 16px 42px rgb(26 54 41 / 0.16);
		backdrop-filter: blur(14px);
	}

	.detail-close {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border:0;
		border-radius: 8px;
		background:var(--rh-t44, #f1f5f2);
		cursor: pointer;
	}

	.detail-kicker {
		margin: 0 0 5px;
		color:var(--rh-t45, #7b8981);
		font-size: 12px;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.detail-title {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		padding-right: 26px;
	}

	.detail-title h2 {
		font-size: 19px;
	}

	.detail-title div > span {
		display: block;
		margin-top: 2px;
		color:var(--rh-t46, #7b8880);
		font-size: 12px;
	}

	.detail-status {
		padding: 4px 7px;
		border-radius: 999px;
		background:var(--rh-t47, #edf3ef);
		color:var(--rh-t48, #3c5f4b);
		font-size: 12px;
		font-weight: 900;
	}

	.detail-location {
		display: flex;
		gap: 8px;
		margin-top: 16px;
		padding: 10px;
		border-radius: 10px;
		background:var(--rh-t49, #f5f8f6);
	}

	.detail-location strong,
	.detail-location span {
		display: block;
	}

	.detail-location strong {
		font-size: 13px;
	}

	.detail-location span {
		margin-top: 2px;
		color:var(--rh-t50, #7c8982);
		font-size: 12px;
	}

	.condition {
		margin-top: 13px;
	}

	.condition small,
	.condition strong {
		display: block;
	}

	.condition small {
		color:var(--rh-t45, #7b8981);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}

	.condition strong {
		margin-top: 4px;
		font-size: 13px;
		font-weight: 600;
	}

	.detail-actions {
		display: grid;
		grid-template-columns: 1fr;
		gap: 7px;
		margin-top: 15px;
	}

	.detail-restricted {
		margin: 0;
		color:var(--rh-muted);
		font-size: 12px;
		line-height: 1.5;
	}

	.detail-actions a {
		min-height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border-radius: 9px;
		font-size: 12px;
		font-weight: 800;
		text-decoration: none;
		cursor: pointer;
	}

	.detail-actions .primary {
		border:1px solid #173d2c;
		background:#173d2c;
		color:white;
	}

	.intake-backdrop {
		position: absolute;
		inset: 0;
		z-index: 40;
		background:rgb(17 38 27 / 0.22);
		pointer-events: auto;
	}

	.intake {
		position: absolute;
		z-index: 50;
		top: 84px;
		right: 16px;
		bottom: 16px;
		width: min(430px, calc(100vw - 32px));
		overflow-y: auto;
		border:1px solid rgb(27 62 45 / 0.12);
		border-radius: 16px;
		background:var(--rh-t5, #fff);
		box-shadow: 0 20px 55px rgb(20 46 33 / 0.22);
	}

	.intake > header {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 17px 18px;
		border-bottom:1px solid var(--rh-t51, #e8edea);
		background:rgb(255 255 255 / 0.96);
		backdrop-filter: blur(10px);
	}

	.intake h2 {
		font-size: 19px;
	}

	.intake > header button {
		width: 31px;
		height: 31px;
		display: grid;
		place-items: center;
		border:0;
		border-radius: 9px;
		background:var(--rh-t52, #eff4f1);
		cursor: pointer;
	}

	.intake form {
		padding: 0 18px 18px;
	}

	.form-section {
		padding: 17px 0;
		border-bottom:1px solid var(--rh-t30, #edf1ee);
	}

	.two-column {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 11px;
	}

	.two-column.compact {
		padding-bottom: 5px;
		border-bottom:0;
	}

	.field {
		position: relative;
		display: grid;
		gap: 5px;
	}

	.field.full {
		grid-column: 1 / -1;
	}

	.field > span {
		color:var(--rh-t53, #66746c);
		font-size: 12px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}

	.field input,
	.field textarea {
		width: 100%;
		padding: 10px 11px;
		border:1px solid var(--rh-t54, #d7e0da);
		border-radius: 9px;
		outline: 0;
		background:var(--rh-t55, #fbfcfb);
		color:var(--rh-t7, #17211d);
		font-size: 13px;
		resize: vertical;
		user-select: text;
	}

	.field input:focus,
	.field textarea:focus {
		border-color:#79a58a;
		box-shadow: 0 0 0 3px rgb(121 165 138 / 0.12);
		background:var(--rh-t5, #fff);
	}

	.address-input {
		position: relative;
		display: flex;
		align-items: center;
	}

	.address-input > :global(svg:first-child) {
		position: absolute;
		left: 10px;
		color:var(--rh-t56, #7e8b84);
	}

	.address-input input {
		padding-left: 33px;
		padding-right: 33px;
	}

	.address-spinner {
		position: absolute;
		right: 10px;
		display: inline-flex;
		animation: spin 0.85s linear infinite;
	}

	.address-results {
		position: absolute;
		z-index: 6;
		top: calc(100% + 5px);
		left: 0;
		right: 0;
		overflow: hidden;
		border:1px solid var(--rh-t12, #d9e2dc);
		border-radius: 10px;
		background:var(--rh-t6, white);
		box-shadow: 0 10px 28px rgb(26 54 41 / 0.15);
	}

	.address-results button {
		width: 100%;
		display: flex;
		align-items: flex-start;
		gap: 7px;
		padding: 9px 10px;
		border:0;
		border-bottom:1px solid var(--rh-t30, #edf1ee);
		background:var(--rh-t6, white);
		color:var(--rh-t57, #33423a);
		text-align: left;
		font-size: 12px;
		cursor: pointer;
	}

	.address-results button:hover {
		background:var(--rh-t58, #f4f8f5);
	}

	.location-tools {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-top: 9px;
	}

	.location-tools button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 7px 8px;
		border:1px solid var(--rh-t59, #d8e1dc);
		border-radius: 8px;
		background:var(--rh-t6, white);
		color:var(--rh-t60, #365444);
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
	}

	.location-tools > span {
		color:var(--rh-t61, #859189);
		font-size: 12px;
	}

	.location-confirmed {
		display: flex;
		gap: 8px;
		margin-top: 10px;
		padding: 9px 10px;
		border-radius: 9px;
		background:var(--rh-t62, #edf7f0);
		color:var(--rh-t63, #2b6540);
	}

	.location-confirmed strong,
	.location-confirmed span {
		display: block;
	}

	.location-confirmed strong {
		font-size: 12px;
	}

	.location-confirmed span {
		margin-top: 1px;
		font-size: 12px;
	}

	.form-error {
		margin-top: 12px;
		padding: 9px 10px;
		border-radius: 8px;
		background:var(--rh-t64, #fff0ed);
		color:var(--rh-t65, #9c382b);
		font-size: 12px;
	}

	.intake footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding-top: 16px;
	}

	.intake footer button {
		min-height: 36px;
		padding: 0 12px;
		border-radius: 9px;
		font-size: 12px;
		font-weight: 900;
		cursor: pointer;
	}

	.intake footer .cancel {
		border:1px solid var(--rh-t59, #d8e1dc);
		background:var(--rh-t6, white);
	}

	.intake footer .create {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border:1px solid #173d2c;
		background:#173d2c;
		color:white;
	}

	.intake footer .create:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.spinner {
		animation: spin 0.85s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (min-width: 701px) and (max-width: 1120px) {
		.detail-card {
			top: calc(var(--dispatch-content-top, 84px) + 12px);
			right: calc(var(--dispatch-gutter, 16px) + 12px);
			bottom: auto;
			width: min(320px, calc(100vw - var(--dispatch-queue-width, 330px) - var(--dispatch-gutter, 16px) * 3 - 24px));
		}
	}

	@media (max-width: 900px) {
		.queue {
			width: var(--dispatch-queue-width, 330px);
		}
	}

	@media (max-width: 700px) {
		.queue {
			top: auto;
			right: 10px;
			bottom: 10px;
			left: 10px;
			width: auto;
			height: 45vh;
		}

		.detail-card {
			display: none;
		}

		.intake {
			top: var(--rh-content-top, 106px);
			right: 10px;
			bottom: 10px;
			width: calc(100vw - 20px);
		}
	}

	/* Neutral panel materials: no translucent white or green-on-green surfaces. */
	.dispatcher-shell { color: var(--rh-text); }
	.queue, .detail-card, .intake {
		background: var(--rh-surface);
		color: var(--rh-text);
		border: 1px solid var(--rh-border);
		box-shadow: var(--rh-shadow);
	}
	.intake > header { background: var(--rh-surface); color: var(--rh-text); }
	.queue-footer, .queue-search, .tabs, .detail-location, .detail-status {
		background: var(--rh-surface-soft);
	}
	.rescue-card { color: var(--rh-text); }
	.rescue-card:hover, .rescue-card.selected, .tabs button.active {
		background: var(--rh-raised);
		border-color: var(--rh-border-strong);
		color: var(--rh-text);
	}
	.new-rescue, .detail-actions .primary, .intake footer .create {
		background: var(--rh-primary); color: var(--rh-on-primary); border-color: var(--rh-primary);
	}
	.new-rescue:hover, .detail-actions .primary:hover, .intake footer .create:hover {
		background: var(--rh-primary-hover);
	}

	.rescue-assignment { display: inline-flex; flex-wrap: wrap; gap: 3px; align-items: baseline;
		margin-top: 7px; font-size: 12px; color: var(--rh-text); }
	.rescue-assignment strong { font-size: 12px; font-weight: 750; }
	.rescue-assignment small { font-size: 11px; font-weight: 500; color: var(--rh-muted); }
	.rescue-owner-summary { display: grid; gap: 3px; margin-top: 12px; padding: 12px;
		border: 1px solid var(--rh-border); border-radius: 10px;
		background: var(--rh-surface-soft); }
	.rescue-owner-summary small { color: var(--rh-muted); font-size: 11px;
		font-weight: 750; text-transform: uppercase; letter-spacing: .06em; }
	.rescue-owner-summary strong { color: var(--rh-text); font-size: 14px; }
	.rescue-owner-summary span { color: var(--rh-muted); font-size: 12px; }
	.source-label { display: inline-block; width: fit-content; margin-top: 6px;
		padding: 3px 7px; border: 1px solid var(--rh-border); border-radius: 7px;
		color: var(--rh-text); background: var(--rh-surface-soft);
		font-size: 11px; font-weight: 750; }
	.routing-exception { display: flex; align-items: flex-start; padding: 12px;
		gap: 10px; border: 1px solid var(--rh-border); border-radius: 10px;
		background: var(--rh-surface); color: var(--rh-text); }
	.routing-exception .rescue-content { display: grid; gap: 5px; }
	.retry-route { width: fit-content; margin-top: 6px; padding: 8px 10px;
		border: 1px solid var(--rh-border-strong); border-radius: 8px;
		background: var(--rh-surface-soft); color: var(--rh-text);
		cursor: pointer; font: inherit; font-weight: 700; }
	.retry-route:disabled { opacity: .6; cursor: wait; }
	.empty-list.hide-empty { display: none; }
</style>
