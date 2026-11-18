"""Index the active open G-NAF Core PSV table with SQLite FTS5 and RTree.

G-NAF Core already supplies ADDRESS_LABEL and LATITUDE/LONGITUDE in one file.
Never import GNAF_CORE_RETIRED. Builds an independent .building DB and swaps
it in only on success so a failed import cannot destroy the live dataset.
"""
import argparse
import csv
import math
import os
from pathlib import Path
import sqlite3

STATES = set('ACT NSW NT QLD SA TAS VIC WA'.split())


def find_source(input_path):
    path = Path(input_path)
    if path.is_file():
        if 'retired' in path.name.casefold():
            raise ValueError('Use active GNAF_CORE data, not retired addresses')
        return path
    matches = [p for p in path.rglob('*') if p.is_file() and
               'gnaf_core' in p.name.casefold() and 'retired' not in p.name.casefold()
               and p.suffix.casefold() in ('.psv', '.txt', '.csv')]
    if len(matches) != 1:
        raise ValueError(f'Expected one active GNAF_CORE PSV file, found {len(matches)}')
    return matches[0]


def build(input_path, output, edition, states):
    source = find_source(input_path)
    dest = Path(output)
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_name(dest.name + '.building')
    if temp.exists():
        raise ValueError(f'Previous incomplete build exists: {temp}')
    db = sqlite3.connect(temp)
    try:
        db.executescript("""
            PRAGMA journal_mode=DELETE;
            PRAGMA synchronous=OFF;
            CREATE TABLE addresses(id INTEGER PRIMARY KEY, gnaf_pid TEXT UNIQUE,
              label TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL);
            CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        """)
        count, batch = 0, []
        with source.open('r', encoding='utf-8-sig', newline='') as stream:
            reader = csv.DictReader(stream, delimiter='|')
            required = {'ADDRESS_DETAIL_PID', 'ADDRESS_LABEL', 'LATITUDE', 'LONGITUDE', 'STATE'}
            if not required.issubset(set(reader.fieldnames or [])):
                raise ValueError('Input does not match the G-NAF Core PSV schema')
            for row in reader:
                if row['STATE'].strip().upper() not in states:
                    continue
                try:
                    lat = float(row['LATITUDE'])
                    lon = float(row['LONGITUDE'])
                except (TypeError, ValueError):
                    continue
                label = row['ADDRESS_LABEL'].strip()
                pid = row['ADDRESS_DETAIL_PID'].strip()
                if not pid or not 3 <= len(label) <= 250 or not math.isfinite(lat) or not math.isfinite(lon):
                    continue
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    continue
                batch.append((pid, label, lat, lon))
                if len(batch) >= 10_000:
                    db.executemany('INSERT OR IGNORE INTO addresses(gnaf_pid,label,latitude,longitude) VALUES (?,?,?,?)', batch)
                    count += len(batch)
                    batch.clear()
            if batch:
                db.executemany('INSERT OR IGNORE INTO addresses(gnaf_pid,label,latitude,longitude) VALUES (?,?,?,?)', batch)
                count += len(batch)
        db.commit()
        if count == 0:
            raise ValueError('No current G-NAF Core addresses indexed')
        print(f'Read {count:,} G-NAF Core address rows', flush=True)
        db.executescript("""
            CREATE VIRTUAL TABLE addresses_rtree USING rtree(id,min_lat,max_lat,min_lon,max_lon);
            INSERT INTO addresses_rtree SELECT id,latitude,latitude,longitude,longitude FROM addresses;
            CREATE VIRTUAL TABLE addresses_fts USING fts5(label,content='addresses',content_rowid='id');
            INSERT INTO addresses_fts(addresses_fts) VALUES('rebuild');
        """)
        db.execute('INSERT INTO metadata VALUES (?,?)', ('edition', edition))
        db.commit()
        db.execute('VACUUM')
        db.close()
        os.replace(temp, dest)
    except BaseException:
        db.close()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, help='Active GNAF_CORE PSV file or extracted release')
    parser.add_argument('--output', required=True, help='New SQLite address index')
    parser.add_argument('--edition', required=True, help='Source edition, e.g. 2026-08')
    parser.add_argument('--states', default=','.join(sorted(STATES)), help='Comma-separated states')
    args = parser.parse_args()
    states = {item.strip().upper() for item in args.states.split(',') if item.strip()}
    if not states or not states.issubset(STATES):
        parser.error('Use NSW, ACT, NT, QLD, SA, TAS, VIC or WA')
    build(args.input, args.output, args.edition, states)


if __name__ == '__main__':
    main()
