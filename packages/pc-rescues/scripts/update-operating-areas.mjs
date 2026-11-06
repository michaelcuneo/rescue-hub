#!/usr/bin/env node
// Run from any directory: node packages/pc-rescues/scripts/update-operating-areas.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = 'https://maptest.environment.nsw.gov.au/arcgis/rest/services/WildlifeRehab/Wildlife_Rehab_Groups/MapServer';
// Stable ArcGIS mapping maintained independently of the runtime API.
const layers = [
  {
    "layerId": 0,
    "organisationId": "wires",
    "organisationName": "WIRES",
    "directoryStatus": "CURRENT",
    "dynamicNameField": "WIRES_Branch"
  },
  {
    "layerId": 2,
    "organisationId": "fawna",
    "organisationName": "FAWNA",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 3,
    "organisationId": "friends-of-the-koala",
    "organisationName": "Friends of the Koala",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 4,
    "organisationId": null,
    "organisationName": "Kangaroo Protection Co-op",
    "directoryStatus": "LEGACY_OR_SHARED"
  },
  {
    "layerId": 5,
    "organisationId": "koalas-in-care",
    "organisationName": "Koalas In Care",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 6,
    "organisationId": "snowy-mountains-wildlife-rescue-laoko",
    "organisationName": "Snowy Mountains Wildlife Rescue LAOKO",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 7,
    "organisationId": "native-animal-rescue-group",
    "organisationName": "Native Animal Rescue Group",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 8,
    "organisationId": "native-animal-trust-fund",
    "organisationName": "Hunter Wildlife Rescue",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 9,
    "organisationId": "northern-rivers-wildlife-carers",
    "organisationName": "Northern Rivers Wildlife Carers",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 10,
    "organisationId": "northern-tablelands-wildlife-carers",
    "organisationName": "Northern Tablelands Wildlife Carers",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 11,
    "organisationId": "port-macquarie-koala-hospital",
    "organisationName": "Port Macquarie Koala Hospital",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 12,
    "organisationId": "port-stephens-koalas",
    "organisationName": "Port Stephens Koalas",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 13,
    "organisationId": "sydney-metropolitan-wildlife-services",
    "organisationName": "Sydney Metropolitan Wildlife Services",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 14,
    "organisationId": "sona",
    "organisationName": "Saving Our Native Animals",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 15,
    "organisationId": "sunraysia-wildlife-carers",
    "organisationName": "Sunraysia Wildlife Carers",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 16,
    "organisationId": "tweed-valley-wildlife-carers",
    "organisationName": "Tweed Valley Wildlife Carers",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 17,
    "organisationId": "winc",
    "organisationName": "WINC",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 18,
    "organisationId": "wildcare-queanbeyan",
    "organisationName": "Wildcare Queanbeyan",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 19,
    "organisationId": "wildlife-arc",
    "organisationName": "Wildlife ARC",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 20,
    "organisationId": "wildlife-carers-network-central-west",
    "organisationName": "Wildlife Carers Network Central West",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 21,
    "organisationId": "wildlife-rescue-south-coast",
    "organisationName": "Wildlife Rescue South Coast",
    "directoryStatus": "CURRENT"
  },
  {
    "layerId": 22,
    "organisationId": null,
    "organisationName": "NSW coastal wildlife services",
    "directoryStatus": "LEGACY_OR_SHARED"
  }
];
if (layers.length !== 22) throw new Error('Expected 22 ArcGIS layer mappings; found ' + layers.length);

const round = (n) => Math.round(n * 1e5) / 1e5;
function distanceSq(p, a, b) {
  const scale = Math.cos(((p[1] + a[1] + b[1]) / 3) * Math.PI / 180);
  const x = p[0] * scale, ax = a[0] * scale, bx = b[0] * scale;
  const y = p[1], ay = a[1], by = b[1];
  const dx = bx - ax, dy = by - ay;
  const t = dx * dx + dy * dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}
function simplifyLine(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let index = -1, max = tolerance * tolerance;
    for (let i = start + 1; i < end; i++) {
      const d = distanceSq(points[i], points[start], points[end]);
      if (d > max) { max = d; index = i; }
    }
    if (index !== -1) { keep[index] = 1; stack.push([start, index], [index, end]); }
  }
  return points.filter((_, i) => keep[i]);
}
function ring(points, tolerance) {
  const clean = points.map(([x, y]) => [round(x), round(y)]);
  if (clean.length < 4) return clean;
  const open = clean.slice(0, -1);
  // Split closed rings at two distant vertices so RDP cannot collapse the loop.
  const mid = Math.floor(open.length / 2);
  const result = [...simplifyLine(open.slice(0, mid + 1), tolerance).slice(0, -1),
    ...simplifyLine([...open.slice(mid), open[0]], tolerance).slice(0, -1)];
  const unique = new Set(result.map((p) => p.join(',')));
  if (unique.size < 3) return clean;
  return [...result, result[0]];
}
function geometry(g, tolerance) {
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) return g;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const simplified = polygons.map((polygon) => polygon.map((r) => ring(r, tolerance)));
  return { type: g.type, coordinates: g.type === 'Polygon' ? simplified[0] : simplified };
}
async function load(layer) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: layer.dynamicNameField ?? '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson'
  });
  const url = service + '/' + layer.layerId + '/query?' + params;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(90000),
        headers: { accept: 'application/geo+json, application/json' }
      });
      const body = await response.text();
      if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + body.slice(0, 120).replace(/\\s+/g, ' '));
      let data;
      try { data = JSON.parse(body); }
      catch {
        throw new Error('Non-JSON response (' + (response.headers.get('content-type') ?? 'unknown content type') + '): ' + body.slice(0, 120).replace(/\\s+/g, ' '));
      }
      if (data.error) throw new Error('ArcGIS: ' + (data.error.message ?? JSON.stringify(data.error)));
      if (!Array.isArray(data.features)) throw new Error('Response does not contain GeoJSON features');
      console.log('Layer', layer.layerId, 'loaded', data.features.length, 'features');
      return data.features.filter((f) => f.geometry?.coordinates).map((f) => ({
        type: 'Feature', geometry: f.geometry,
        properties: { layerId: layer.layerId, organisationId: layer.organisationId ?? '', organisationName: layer.organisationName,
          areaLabel: layer.dynamicNameField && f.properties?.[layer.dynamicNameField] ? 'WIRES — ' + f.properties[layer.dynamicNameField].trim() : layer.organisationName,
          directoryStatus: layer.directoryStatus, source: 'NSW DCCEEW Wildlife Rehabilitation Group boundaries' }
      }));
    } catch (error) {
      lastError = error;
      console.warn('Layer', layer.layerId, 'attempt', attempt, 'failed:', error.message);
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  throw new Error('Layer ' + layer.layerId + ' failed after 4 attempts: ' + lastError.message);
}

console.log('Downloading', layers.length, 'ArcGIS layers...');
const results = await Promise.allSettled(layers.map(load));
const failures = results.flatMap((r, i) => r.status === 'rejected' ? [layers[i].layerId + ': ' + r.reason] : []);
if (failures.length) throw new Error('Refusing partial snapshot:\n' + failures.join('\n'));
const features = results.flatMap((r) => r.value);
if (!features.length) throw new Error('No features returned');
const metadata = { source: 'NSW DCCEEW Wildlife Rehabilitation Group boundaries', sourceUrl: service, generatedAt: new Date().toISOString(), loadedLayers: layers.map((l) => l.layerId), failedLayers: [] };
const original = { type: 'FeatureCollection', features, metadata };
const outputDir = path.join(root, 'static/data');
const archiveDir = path.join(root, 'data');
await mkdir(outputDir, { recursive: true });
await mkdir(archiveDir, { recursive: true });
await writeFile(path.join(archiveDir, 'operating-areas-source.geojson'), JSON.stringify(original));
let final, size, tolerance;
for (tolerance of [0.0001, 0.00025, 0.0005, 0.001, 0.002, 0.004, 0.008]) {
  final = { ...original, features: features.map((f) => ({ ...f, geometry: geometry(f.geometry, tolerance) })) };
  size = Buffer.byteLength(JSON.stringify(final));
  console.log('Tolerance', tolerance, 'size', size, 'bytes');
  if (size < 4_000_000) break;
}
if (size >= 4_000_000) throw new Error('Unable to reduce output below 4 MB safely; source snapshot saved.');
await writeFile(path.join(outputDir, 'operating-areas.geojson'), JSON.stringify(final));
console.log('Saved', features.length, 'features,', size, 'bytes. Review boundary appearance before production use.');
