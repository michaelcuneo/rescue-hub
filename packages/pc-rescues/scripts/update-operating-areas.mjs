#!/usr/bin/env node
// Run from any directory: node packages/pc-rescues/scripts/update-operating-areas.mjs
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'src/routes/api/operating-areas/+server.ts'), 'utf8');
const service = 'https://maptest.environment.nsw.gov.au/arcgis/rest/services/WildlifeRehab/Wildlife_Rehab_Groups/MapServer';
const layers = [...source.matchAll(/\{ layerId: (\d+), organisationId: (null|'[^']+'), organisationName: '([^']+)', directoryStatus: '([^']+)'(?:, dynamicNameField: '([^']+)')? \}/g)]
  .map((m) => ({ layerId: Number(m[1]), organisationId: m[2] === 'null' ? null : m[2].slice(1, -1), organisationName: m[3], directoryStatus: m[4], dynamicNameField: m[5] }));
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
  const params = new URLSearchParams({ where: '1=1', outFields: layer.dynamicNameField ?? '*', returnGeometry: 'true', outSR: '4326', f: 'geojson' });
  const response = await fetch(service + '/' + layer.layerId + '/query?' + params, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error('Layer ' + layer.layerId + ': HTTP ' + response.status);
  const data = await response.json();
  if (data.error) throw new Error('Layer ' + layer.layerId + ': ' + data.error.message);
  return (data.features ?? []).filter((f) => f.geometry?.coordinates).map((f) => ({
    type: 'Feature', geometry: f.geometry,
    properties: { layerId: layer.layerId, organisationId: layer.organisationId ?? '', organisationName: layer.organisationName,
      areaLabel: layer.dynamicNameField && f.properties?.[layer.dynamicNameField] ? 'WIRES — ' + f.properties[layer.dynamicNameField].trim() : layer.organisationName,
      directoryStatus: layer.directoryStatus, source: 'NSW DCCEEW Wildlife Rehabilitation Group boundaries' }
  }));
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
