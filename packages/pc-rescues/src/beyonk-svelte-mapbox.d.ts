// @beyonk/svelte-mapbox does not currently publish TypeScript declarations.
// Keep the shim local so the rest of the application remains strictly typed.
declare module '@beyonk/svelte-mapbox' {
	export const Map: any;
	export const Marker: any;
	export const controls: {
		GeolocateControl: any;
		NavigationControl: any;
		ScaleControl: any;
		[key: string]: any;
	};
}
