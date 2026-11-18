"""Independent G-NAF Core address lookup. Only Rescue Hub's backend calls this service."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import math
import os
import re
import sqlite3
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

MAX_REVERSE_METRES = 300


def metres_between(a_lat, a_lon, b_lat, b_lon):
    r = math.pi / 180
    dlat, dlon = (b_lat - a_lat) * r, (b_lon - a_lon) * r
    h = math.sin(dlat / 2) ** 2 + math.cos(a_lat * r) * math.cos(b_lat * r) * math.sin(dlon / 2) ** 2
    return 6371000 * 2 * math.asin(min(1.0, math.sqrt(h)))


def connect(database):
    uri = Path(database).resolve().as_uri() + '?mode=ro'
    connection = sqlite3.connect(uri, uri=True, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA query_only = ON')
    return connection


def edition(connection):
    return connection.execute("SELECT value FROM metadata WHERE key = 'edition'").fetchone()[0]


def reverse(connection, latitude, longitude):
    if not all(map(math.isfinite, (latitude, longitude))) or abs(latitude) > 90 or abs(longitude) > 180:
        raise ValueError('Invalid coordinates')
    lat_delta = MAX_REVERSE_METRES / 111_000 + 0.00001
    lon_delta = MAX_REVERSE_METRES / max(1000, 111_000 * abs(math.cos(math.radians(latitude)))) + 0.00001
    rows = connection.execute("""
        SELECT a.gnaf_pid, a.label, a.latitude, a.longitude
        FROM addresses_rtree r JOIN addresses a ON a.id = r.id
        WHERE r.min_lat <= ? AND r.max_lat >= ?
          AND r.min_lon <= ? AND r.max_lon >= ?
    """, (latitude + lat_delta, latitude - lat_delta, longitude + lon_delta, longitude - lon_delta))
    closest = None
    best_metres = MAX_REVERSE_METRES + 0.001
    for row in rows:
        metres = metres_between(latitude, longitude, row['latitude'], row['longitude'])
        if metres < best_metres:
            best_metres, closest = metres, row
    result = {'source': 'GNAF', 'edition': edition(connection), 'address': None}
    if closest:
        result.update({'id': closest['gnaf_pid'], 'address': closest['label'],
                       'latitude': closest['latitude'], 'longitude': closest['longitude'],
                       'distanceMetres': round(best_metres)})
    return result


def search(connection, query, limit=5):
    if len(query) > 120:
        raise ValueError('Address query too long')
    tokens = re.findall(r'[^\W_]+', query.casefold(), flags=re.UNICODE)
    if len(''.join(tokens)) < 3:
        return {'source': 'GNAF', 'edition': edition(connection), 'results': []}
    match = ' '.join('"' + token + '"*' for token in tokens[:12])
    rows = connection.execute("""
        SELECT a.gnaf_pid, a.label, a.latitude, a.longitude
        FROM addresses_fts f JOIN addresses a ON a.id = f.rowid
        WHERE addresses_fts MATCH ?
        ORDER BY bm25(addresses_fts) LIMIT ?
    """, (match, max(1, min(5, limit)))).fetchall()
    return {'source': 'GNAF', 'edition': edition(connection), 'results': [
        {'id': row['gnaf_pid'], 'label': row['label'],
         'latitude': row['latitude'], 'longitude': row['longitude']} for row in rows]}


def handler(database, token):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            # Avoid putting rescue coordinates or search terms into access logs.
            pass

        def respond(self, status, data):
            body = json.dumps(data).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'private, no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            header = self.headers.get('Authorization', '')
            if not hmac.compare_digest(header, 'Bearer ' + token):
                return self.respond(401, {'error': 'Authentication required'})
            parsed = urlsplit(self.path)
            params = parse_qs(parsed.query)
            try:
                with connect(database) as db:
                    if parsed.path == '/healthz':
                        result = {'ok': True, 'source': 'GNAF', 'edition': edition(db)}
                    elif parsed.path == '/reverse':
                        result = reverse(db, float(params['latitude'][0]), float(params['longitude'][0]))
                    elif parsed.path == '/search':
                        result = search(db, params['q'][0], int(params.get('limit', ['5'])[0]))
                    else:
                        return self.respond(404, {'error': 'Not found'})
                return self.respond(200, result)
            except (KeyError, ValueError, OverflowError):
                return self.respond(400, {'error': 'Invalid request'})
            except sqlite3.Error:
                return self.respond(503, {'error': 'Address database unavailable'})
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', default=os.getenv('GNAF_DB', '/data/gnaf.sqlite'))
    parser.add_argument('--host', default=os.getenv('GNAF_HOST', '127.0.0.1'))
    parser.add_argument('--port', type=int, default=int(os.getenv('GNAF_PORT', '8765')))
    args = parser.parse_args()
    token = os.getenv('GNAF_TOKEN', '')
    if len(token) < 24:
        parser.error('GNAF_TOKEN must be at least 24 characters')
    with connect(args.database) as db:
        print('G-NAF geocoder starting: dataset', edition(db), flush=True)
    ThreadingHTTPServer((args.host, args.port), handler(args.database, token)).serve_forever()


if __name__ == '__main__':
    main()
