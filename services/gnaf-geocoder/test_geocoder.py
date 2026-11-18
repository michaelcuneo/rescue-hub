"""Offline integration tests; the fixture does NOT contain live addresses."""
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import json
import unittest

from import_gnaf import build
from geocoder import connect, reverse, search, handler


class GnafServiceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        (root / 'GNAF_CORE.psv').write_text(
            'ADDRESS_DETAIL_PID|ADDRESS_LABEL|LATITUDE|LONGITUDE|STATE\n'
            'ADDR-1|12 Hunter Street, Newcastle NSW 2300|-32.929|151.779|NSW\n'
            'ADDR-2|50 Test Road, Canberra ACT 2600|-35.28|149.13|ACT\n')
        (root / 'GNAF_CORE_RETIRED.psv').write_text(
            'ADDRESS_DETAIL_PID|ADDRESS_LABEL|LATITUDE|LONGITUDE|STATE\n'
            'ADDR-OLD|77 Hunter Street, Newcastle NSW 2300|-32.929|151.779|NSW\n')
        self.database = str(root / 'addresses.sqlite')
        build(root, self.database, '2026-08', {'NSW'})

    def test_import_search_reverse_and_state_filter(self):
        with connect(self.database) as db:
            result = search(db, '12 hunter')
            self.assertEqual(result['source'], 'GNAF')
            self.assertEqual([row['id'] for row in result['results']], ['ADDR-1'])
            self.assertEqual(reverse(db, -32.929, 151.779)['distanceMetres'], 0)
            self.assertIsNone(reverse(db, -32.90, 151.78)['address'])
            self.assertEqual(search(db, 'Canberra')['results'], [])
            self.assertEqual(search(db, 'hunter OR')['results'], [])

    def test_api_requires_bearer_token(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler(self.database, 'test-token-secret-123456789'))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = f'http://127.0.0.1:{server.server_port}/search?q=hunter'
        with self.assertRaises(HTTPError) as failure:
            urlopen(url)
        self.assertEqual(failure.exception.code, 401)
        with urlopen(Request(url, headers={'Authorization': 'Bearer test-token-secret-123456789'})) as response:
            self.assertEqual(json.load(response)['results'][0]['id'], 'ADDR-1')


if __name__ == '__main__':
    unittest.main()
