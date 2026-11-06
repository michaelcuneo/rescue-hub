import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Compatibility endpoint for existing map consumers. The geometry is a
// versioned static snapshot; Lambda never fetches ArcGIS or DynamoDB.
export const GET: RequestHandler = async () => {
	redirect(307, '/data/operating-areas.geojson');
};
