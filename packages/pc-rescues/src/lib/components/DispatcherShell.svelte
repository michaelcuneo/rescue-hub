<script lang="ts">
	import { env } from '$env/dynamic/public';
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
		Phone,
		UserRound,
		LoaderCircle
	} from '@lucide/svelte';
	import {
		available,
		coords,
		data,
		draftLocation,
		intakeOpen,
		mapRef,
		selectedRescue
	} from '$lib/stores';

	let { backendOnline }: { backendOnline: boolean } = $props();

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
	let breed = $state('');
	let injury = $state('');
	let callerName = $state('');
	let callerPhone = $state('');
	let addressQuery = $state('');
	let addressResults = $state<GeocodeResult[]>([]);
	let addressSearching = $state(false);
	let submitError = $state('');
	let saving = $state(false);
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

	const relativeTime = (value?: string) => {
		if (!value) return 'just now';
		const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	};

	function selectRescue(item: any) {
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

		if (!$draftLocation) {
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
					location: addressQuery.trim() || $draftLocation.label,
					longitude: $draftLocation.longitude,
					latitude: $draftLocation.latitude,
					callerName: callerName.trim(),
					callerPhone: callerPhone.trim()
				})
			});

			const payload = (await response.json()) as {
				rescue?: any;
				error?: string;
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
				pending: [rescue, ...current.pending]
			}));

			tab = 'pending';
			$selectedRescue = rescue;
			closeIntake();

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
	<header class="topbar">
		<div class="organisation">
			<div class="logo">RH</div>
			<div>
				<strong>Hunter Wildlife Rescue</strong>
				<span>Demo organisation · Newcastle / Hunter</span>
			</div>
		</div>

		<div class="topbar-actions">
			<span class:offline={!backendOnline} class="backend-state">
				<i></i>{backendOnline ? 'Live' : 'Demo data'}
			</span>

			<button
				type="button"
				class:available={$available}
				class="availability"
				onclick={() => ($available = !$available)}
			>
				<Radio size={14} />
				{$available ? 'Available' : 'Unavailable'}
			</button>

			<div class="user">
				<span>MC</span>
				<div>
					<strong>Michael</strong>
					<small>Volunteer · Demo user</small>
				</div>
			</div>
		</div>
	</header>

	<aside class="queue">
		<div class="queue-heading">
			<div>
				<p>Dispatch</p>
				<h1>Rescue queue</h1>
			</div>
			<button class="new-rescue" type="button" onclick={openIntake}>
				<Plus size={16} />
				New rescue
			</button>
		</div>

		<label class="queue-search">
			<Search size={15} />
			<input bind:value={search} placeholder="Search animal, suburb, condition…" />
		</label>

		<div class="tabs" role="tablist" aria-label="Rescue state">
			<button class:active={tab === 'pending'} type="button" onclick={() => (tab = 'pending')}>
				<span>Pending</span>
				<strong>{$data.pending.length}</strong>
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
					</span>
					<span class="rescue-time">
						<Clock3 size={11} />
						{relativeTime(item.updatedAt)}
					</span>
					<ChevronRight size={15} class="chevron" />
				</button>
			{:else}
				<div class="empty-list">
					<CircleCheck size={26} />
					<strong>No {tab} rescues</strong>
					<span>Nothing matches the current filter.</span>
				</div>
			{/each}
		</div>

		<div class="queue-footer">
			<span><i class="pending"></i>{$data.pending.length} awaiting rescue</span>
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

			<p class="detail-kicker">Selected rescue</p>
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

			<div class="condition">
				<small>Reported condition</small>
				<strong>{selected.injury || 'No condition recorded'}</strong>
			</div>

			<div class="detail-actions">
				<button type="button" class="secondary">
					<Phone size={14} /> Caller details
				</button>
				<button type="button" class="primary">
					<UserRound size={14} />
					{selected.assignedUserId ? 'View assignment' : 'Assign rescuer'}
				</button>
			</div>
		</section>
	{/if}

	{#if $intakeOpen}
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
								<LoaderCircle size={15} class="spinner" />
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
						<input bind:value={species} placeholder="Possum, magpie, kangaroo…" />
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
						<input bind:value={callerName} placeholder="Optional for demo" />
					</label>
					<label class="field">
						<span>Caller phone</span>
						<input bind:value={callerPhone} placeholder="Optional for demo" />
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
	.dispatcher-shell {
		position: fixed;
		inset: 0;
		z-index: 20;
		pointer-events: none;
		color: #16231d;
		font-family:
			Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.topbar,
	.queue,
	.detail-card,
	.intake {
		pointer-events: auto;
	}

	.topbar {
		position: absolute;
		top: 14px;
		left: 16px;
		right: 16px;
		height: 58px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 8px 10px 8px 12px;
		border: 1px solid rgb(27 62 45 / 0.12);
		border-radius: 14px;
		background: rgb(255 255 255 / 0.94);
		box-shadow: 0 10px 34px rgb(26 54 41 / 0.12);
		backdrop-filter: blur(14px);
	}

	.organisation,
	.topbar-actions,
	.user {
		display: flex;
		align-items: center;
	}

	.organisation {
		gap: 10px;
		min-width: 0;
	}

	.logo {
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border-radius: 10px;
		background: #173d2c;
		color: #dff15d;
		font-size: 11px;
		font-weight: 900;
	}

	.organisation strong,
	.organisation span,
	.user strong,
	.user small {
		display: block;
	}

	.organisation strong {
		font-size: 12px;
	}

	.organisation span {
		margin-top: 2px;
		color: #718078;
		font-size: 9px;
	}

	.topbar-actions {
		gap: 8px;
	}

	.backend-state,
	.availability {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		padding: 0 10px;
		border: 1px solid #d9e2dc;
		border-radius: 9px;
		background: #f7faf8;
		font-size: 9px;
		font-weight: 800;
	}

	.backend-state i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #45a663;
		box-shadow: 0 0 0 3px rgb(69 166 99 / 0.12);
	}

	.backend-state.offline i {
		background: #c89a33;
		box-shadow: 0 0 0 3px rgb(200 154 51 / 0.12);
	}

	.availability {
		border-color: #d6dfda;
		color: #5b6861;
		cursor: pointer;
	}

	.availability.available {
		border-color: #b9d7c4;
		background: #eef8f1;
		color: #286740;
	}

	.user {
		gap: 8px;
		padding-left: 4px;
	}

	.user > span {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: #dfe9e2;
		color: #173d2c;
		font-size: 9px;
		font-weight: 900;
	}

	.user strong {
		font-size: 10px;
	}

	.user small {
		margin-top: 1px;
		color: #7b8780;
		font-size: 8px;
	}

	.queue {
		position: absolute;
		top: 84px;
		bottom: 16px;
		left: 16px;
		width: 365px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid rgb(27 62 45 / 0.12);
		border-radius: 16px;
		background: rgb(255 255 255 / 0.96);
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
		color: #748078;
		font-size: 8px;
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
		border: 0;
		border-radius: 9px;
		background: #173d2c;
		color: white;
		font-size: 9px;
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
		border: 1px solid #dce3df;
		border-radius: 10px;
		background: #f8faf9;
		color: #728078;
	}

	.queue-search input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: 0;
		background: transparent;
		color: #17211d;
		font-size: 10px;
	}

	.tabs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin: 12px 16px 8px;
		padding: 4px;
		border-radius: 10px;
		background: #edf2ef;
	}

	.tabs button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 0;
		padding: 7px 6px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: #6d7972;
		font-size: 8px;
		font-weight: 800;
		cursor: pointer;
	}

	.tabs button.active {
		background: white;
		color: #173d2c;
		box-shadow: 0 2px 7px rgb(23 61 44 / 0.08);
	}

	.tabs strong {
		display: grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 999px;
		background: #e5ebe7;
		font-size: 8px;
	}

	.tabs button.active strong {
		background: #e9f0eb;
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
		border: 1px solid transparent;
		border-bottom-color: #edf1ee;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.rescue-card:hover,
	.rescue-card.selected {
		border-radius: 10px;
		border-color: #d9e5dd;
		background: #f6faf7;
	}

	.rescue-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}

	.state-pending {
		background: #d92b04;
	}

	.state-assigned {
		background: #f2b705;
	}

	.state-completed {
		background: #50a971;
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
		font-size: 11px;
	}

	.rescue-title small {
		overflow: hidden;
		color: #7c8881;
		font-size: 8px;
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
		color: #516159;
		font-size: 9px;
	}

	.rescue-injury {
		margin-top: 2px;
		color: #849088;
		font-size: 8px;
	}

	.rescue-time {
		display: flex;
		align-items: center;
		gap: 3px;
		color: #89958e;
		font-size: 8px;
		white-space: nowrap;
	}

	.chevron {
		color: #a5afa9;
	}

	.empty-list {
		min-height: 250px;
		display: grid;
		place-content: center;
		gap: 5px;
		color: #718078;
		text-align: center;
	}

	.empty-list :global(svg) {
		margin: 0 auto 5px;
		color: #8fad99;
	}

	.empty-list strong {
		color: #293730;
		font-size: 11px;
	}

	.empty-list span {
		font-size: 9px;
	}

	.queue-footer {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 10px 16px;
		border-top: 1px solid #e5ebe7;
		background: #fafcfb;
		color: #6f7d75;
		font-size: 8px;
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
		background: #d92b04;
	}

	.queue-footer i.assigned {
		background: #f2b705;
	}

	.detail-card {
		position: absolute;
		right: 18px;
		bottom: 18px;
		width: 320px;
		padding: 17px;
		border: 1px solid rgb(27 62 45 / 0.12);
		border-radius: 15px;
		background: rgb(255 255 255 / 0.96);
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
		border: 0;
		border-radius: 8px;
		background: #f1f5f2;
		cursor: pointer;
	}

	.detail-kicker {
		margin: 0 0 5px;
		color: #7b8981;
		font-size: 8px;
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
		color: #7b8880;
		font-size: 9px;
	}

	.detail-status {
		padding: 4px 7px;
		border-radius: 999px;
		background: #edf3ef;
		color: #3c5f4b;
		font-size: 7px;
		font-weight: 900;
	}

	.detail-location {
		display: flex;
		gap: 8px;
		margin-top: 16px;
		padding: 10px;
		border-radius: 10px;
		background: #f5f8f6;
	}

	.detail-location strong,
	.detail-location span {
		display: block;
	}

	.detail-location strong {
		font-size: 10px;
	}

	.detail-location span {
		margin-top: 2px;
		color: #7c8982;
		font-size: 8px;
	}

	.condition {
		margin-top: 13px;
	}

	.condition small,
	.condition strong {
		display: block;
	}

	.condition small {
		color: #7b8981;
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}

	.condition strong {
		margin-top: 4px;
		font-size: 10px;
		font-weight: 600;
	}

	.detail-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 7px;
		margin-top: 15px;
	}

	.detail-actions button {
		min-height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border-radius: 9px;
		font-size: 8px;
		font-weight: 800;
		cursor: pointer;
	}

	.detail-actions .secondary {
		border: 1px solid #d9e2dc;
		background: white;
	}

	.detail-actions .primary {
		border: 1px solid #173d2c;
		background: #173d2c;
		color: white;
	}

	.intake-backdrop {
		position: absolute;
		inset: 0;
		z-index: 40;
		background: rgb(17 38 27 / 0.22);
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
		border: 1px solid rgb(27 62 45 / 0.12);
		border-radius: 16px;
		background: #fff;
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
		border-bottom: 1px solid #e8edea;
		background: rgb(255 255 255 / 0.96);
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
		border: 0;
		border-radius: 9px;
		background: #eff4f1;
		cursor: pointer;
	}

	.intake form {
		padding: 0 18px 18px;
	}

	.form-section {
		padding: 17px 0;
		border-bottom: 1px solid #edf1ee;
	}

	.two-column {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 11px;
	}

	.two-column.compact {
		padding-bottom: 5px;
		border-bottom: 0;
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
		color: #66746c;
		font-size: 8px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}

	.field input,
	.field textarea {
		width: 100%;
		padding: 10px 11px;
		border: 1px solid #d7e0da;
		border-radius: 9px;
		outline: 0;
		background: #fbfcfb;
		color: #17211d;
		font-size: 10px;
		resize: vertical;
		user-select: text;
	}

	.field input:focus,
	.field textarea:focus {
		border-color: #79a58a;
		box-shadow: 0 0 0 3px rgb(121 165 138 / 0.12);
		background: #fff;
	}

	.address-input {
		position: relative;
		display: flex;
		align-items: center;
	}

	.address-input > :global(svg:first-child) {
		position: absolute;
		left: 10px;
		color: #7e8b84;
	}

	.address-input input {
		padding-left: 33px;
		padding-right: 33px;
	}

	.address-input .spinner {
		position: absolute;
		right: 10px;
	}

	.address-results {
		position: absolute;
		z-index: 6;
		top: calc(100% + 5px);
		left: 0;
		right: 0;
		overflow: hidden;
		border: 1px solid #d9e2dc;
		border-radius: 10px;
		background: white;
		box-shadow: 0 10px 28px rgb(26 54 41 / 0.15);
	}

	.address-results button {
		width: 100%;
		display: flex;
		align-items: flex-start;
		gap: 7px;
		padding: 9px 10px;
		border: 0;
		border-bottom: 1px solid #edf1ee;
		background: white;
		color: #33423a;
		text-align: left;
		font-size: 9px;
		cursor: pointer;
	}

	.address-results button:hover {
		background: #f4f8f5;
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
		border: 1px solid #d8e1dc;
		border-radius: 8px;
		background: white;
		color: #365444;
		font-size: 8px;
		font-weight: 800;
		cursor: pointer;
	}

	.location-tools > span {
		color: #859189;
		font-size: 8px;
	}

	.location-confirmed {
		display: flex;
		gap: 8px;
		margin-top: 10px;
		padding: 9px 10px;
		border-radius: 9px;
		background: #edf7f0;
		color: #2b6540;
	}

	.location-confirmed strong,
	.location-confirmed span {
		display: block;
	}

	.location-confirmed strong {
		font-size: 9px;
	}

	.location-confirmed span {
		margin-top: 1px;
		font-size: 8px;
	}

	.form-error {
		margin-top: 12px;
		padding: 9px 10px;
		border-radius: 8px;
		background: #fff0ed;
		color: #9c382b;
		font-size: 9px;
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
		font-size: 9px;
		font-weight: 900;
		cursor: pointer;
	}

	.intake footer .cancel {
		border: 1px solid #d8e1dc;
		background: white;
	}

	.intake footer .create {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid #173d2c;
		background: #173d2c;
		color: white;
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

	@media (max-width: 900px) {
		.user div {
			display: none;
		}

		.backend-state {
			display: none;
		}

		.queue {
			width: 330px;
		}
	}

	@media (max-width: 700px) {
		.topbar {
			left: 10px;
			right: 10px;
		}

		.organisation span,
		.availability {
			display: none;
		}

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
			top: 78px;
			right: 10px;
			bottom: 10px;
			width: calc(100vw - 20px);
		}
	}
</style>
