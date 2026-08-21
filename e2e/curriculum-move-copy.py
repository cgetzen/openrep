from __future__ import annotations

import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from run import QuietHandler

ROOT = Path(__file__).resolve().parents[1]


def run():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 1000})
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load')

            curriculum = page.locator('.curriculum-list')
            expect(curriculum).to_be_visible()
            expect(curriculum).not_to_contain_text('...')

            advance = page.locator('[data-curriculum-family="advance-c5"]')
            expect(advance.locator('h4')).to_have_text('Advance — c5 system')
            plan = advance.locator('.curriculum-teaching p').nth(1)
            expect(plan).to_contain_text('Challenge d4 immediately with c5')
            expect(plan).not_to_contain_text('...c5')

            browser.close()
            print('Curriculum move notation omits black-move ellipses')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
