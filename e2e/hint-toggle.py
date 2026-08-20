from __future__ import annotations

import functools
import http.server
import re
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


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

            page.get_by_role('button', name='Practice test your recall').click()
            prompt = page.locator('#prompt')
            target = page.locator('.square[data-square="c6"]')
            expect(prompt).to_contain_text('Your move as Black', timeout=3000)

            expect(prompt).to_contain_text('Find c6.')
            expect(target.locator('.hint-target-indicator')).to_have_count(1)
            expect(page.locator('.square.hint-from')).to_have_count(1)
            expect(page.locator('.square.hint-to')).to_have_count(1)

            page.get_by_role('button', name='Hint: on').click()
            expect(page.get_by_role('button', name='Hint: off')).to_be_visible()
            expect(prompt).not_to_contain_text('Find c6.')
            expect(target.locator('.hint-target-indicator')).to_have_count(0)
            expect(page.locator('.square.hint-from')).to_have_count(0)
            expect(page.locator('.square.hint-to')).to_have_count(0)

            # Legal destinations remain normal board interaction, not proactive hints.
            page.locator('.square[data-square="c7"]').click()
            expect(target).to_have_class(re.compile(r'\blegal-target\b'))
            expect(target.locator('.hint-target-indicator')).to_have_count(0)

            # Changing the Practice queue strategy must not reset the user's hint choice.
            page.get_by_role('button', name='Weak focus weakest lines').click()
            expect(prompt).to_contain_text('Your move as Black', timeout=3000)
            expect(page.get_by_role('button', name='Hint: off')).to_be_visible()
            expect(prompt).not_to_contain_text('Find c6.')
            expect(page.locator('.square.hint-from')).to_have_count(0)
            expect(page.locator('.square.hint-to')).to_have_count(0)
            expect(target.locator('.hint-target-indicator')).to_have_count(0)

            page.get_by_role('button', name='Hint: off').click()
            expect(page.get_by_role('button', name='Hint: on')).to_be_visible()
            expect(prompt).to_contain_text('Find c6.')
            expect(target.locator('.hint-target-indicator')).to_have_count(1)

            browser.close()
            print('Practice hint toggle regression passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
