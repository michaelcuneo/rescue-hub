import { getRescues } from '$lib/server/graphql';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const result = await getRescues(undefined, 100);

		return {
			rescues: result.items,
			backendOnline: true
		};
	} catch (error) {
		console.warn('PC Rescues started without live rescue data.', error);

		return {
			rescues: [],
			backendOnline: false
		};
	}
};
