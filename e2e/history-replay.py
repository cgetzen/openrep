from __future__ import annotations

import functools
import http.server
import re
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from run import QuietHandler, click_move, square, wait_for_last_move

ROOT = Path(__file__).resolve().parents[1]


def run():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load')

            # Reach the third Black decision: 1.e4 c6 2.d4 d5 3.e5.
            wait_for_last_move(page, 'e2e4')
            click_move(page, 'c7c6')
            wait_for_last_move(page, 'd2d4')
            click_move(page, 'd7d5')
            wait_for_last_move(page, 'e4e5')
            expect(page.locator('#history-status')).to_have_text('Current position')

            # Rewind to the prior Black decision. Historical positions on the
            # opponent turn remain read-only; repertoire decisions are playable.
            page.locator('#history-back').click()
            expect(page.locator('#history-status')).to_have_text('Position 4 / 5')
            expect(square(page, 'e4')).to_be_disabled()

            page.locator('#history-back').click()
            expect(page.locator('#history-status')).to_have_text('Position 3 / 5')
            expect(square(page, 'd7')).to_be_enabled()
            expect(square(page, 'd5').locator('.hint-target-indicator')).to_have_count(1)

            # Replaying the recorded move acts like Forward, then the historical
            # opponent move replays automatically until the live position is reached.
            click_move(page, 'd7d5')
            expect(page.locator('#history-status')).to_have_text('Current position', timeout=3000)
            expect(square(page, 'e4')).to_have_class(re.compile(r'last-move'))
            expect(square(page, 'e5')).to_have_class(re.compile(r'last-move'))

            # The live ply was not rewritten: backing up still exposes the same
            # five-ply history, and a wrong historical move does not advance it.
            page.locator('#history-back').click()
            page.locator('#history-back').click()
            expect(page.locator('#history-status')).to_have_text('Position 3 / 5')
            click_move(page, 'g8f6')
            expect(page.locator('#history-status')).to_have_text('Position 3 / 5')
            expect(page.locator('#history-feedback')).to_contain_text('Look for d5')
            expect(square(page, 'd7')).to_be_enabled()

            browser.close()
            print('Interactive history replay regression passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
