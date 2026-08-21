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

            accelerated = page.locator('[data-curriculum-family="accelerated-panov"]')
            expect(accelerated.locator('h4')).to_have_text('2.c4 — Accelerated Panov')
            response = accelerated.locator('[data-curriculum-response="accelerated-panov-c4"]')
            expect(response.locator('strong')).to_have_text('2.c4 → d5')
            expect(response).not_to_contain_text('Accelerated Panov')
            response.click()

            expect(page.locator('#line-title')).to_have_text('2.c4 — Accelerated Panov')
            expect(page.locator('#line-variation')).to_have_text('Important · Top-level opponent decision')
            expect(page.locator('#line-counter')).to_have_text('LEARN · IMPORTANT · RESPONSE')
            expect(page.locator('.lesson-card')).not_to_contain_text('Another good move')
            expect(page.locator('.lesson-card')).not_to_contain_text('from Advance — Immediate counterplay')

            browser.close()
            print('Curriculum notation and canonical response lesson presentation regressions passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
