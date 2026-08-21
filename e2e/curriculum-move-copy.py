from __future__ import annotations

import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from run import QuietHandler, click_move, wait_for_last_move

ROOT = Path(__file__).resolve().parents[1]


def wait_for_expected_move(page, move):
    expect(page.locator(f'.square.hint-from[data-square="{move[:2]}"]')).to_have_count(1)
    expect(page.locator(f'.square.hint-to[data-square="{move[2:4]}"]')).to_have_count(1)


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
            plan = accelerated.locator('.curriculum-teaching p').nth(1)
            expect(plan).to_contain_text('recover the temporary d5-pawn with Nf6 and Nxd5')
            lesson = accelerated.locator('.curriculum-line-item')
            expect(lesson.locator('strong')).to_have_text('2.c4 — Accelerated Panov')
            expect(lesson.locator('small')).to_contain_text('4.cxd5 Nf6')
            lesson.click()

            expect(page.locator('#line-title')).to_have_text('2.c4 — Accelerated Panov')
            expect(page.locator('#line-variation')).to_contain_text('4.cxd5 Nf6')
            assert 'current' in (lesson.get_attribute('class') or '')

            # Accelerated Panov is an independent multi-decision branch. The lesson
            # must teach the central liquidation and knight-based pawn recovery,
            # not stop after the first response to 2.c4.
            wait_for_last_move(page, 'e2e4')
            wait_for_expected_move(page, 'c7c6')
            click_move(page, 'c7c6')

            wait_for_last_move(page, 'c2c4')
            wait_for_expected_move(page, 'd7d5')
            click_move(page, 'd7d5')

            wait_for_last_move(page, 'e4d5')
            wait_for_expected_move(page, 'c6d5')
            click_move(page, 'c6d5')

            wait_for_last_move(page, 'c4d5')
            wait_for_expected_move(page, 'g8f6')
            expect(page.locator('#prompt')).not_to_contain_text('Qxd5')
            click_move(page, 'g8f6')

            wait_for_last_move(page, 'b1c3')
            wait_for_expected_move(page, 'f6d5')
            click_move(page, 'f6d5')

            wait_for_last_move(page, 'g1f3')
            wait_for_expected_move(page, 'd5c3')
            click_move(page, 'd5c3')

            wait_for_last_move(page, 'd2c3')
            wait_for_expected_move(page, 'd8d1')
            click_move(page, 'd8d1')

            wait_for_last_move(page, 'e1d1')
            wait_for_expected_move(page, 'b8c6')
            click_move(page, 'b8c6')

            expect(page.locator('#feedback')).to_contain_text('Line complete')
            expect(page.locator('#next-line')).to_have_text('Next lesson →')
            page.locator('#next-line').click()
            expect(page.locator('#line-title')).to_have_text('2.d3 — Quiet system')

            browser.close()
            print('Curriculum notation and full Accelerated Panov lesson regressions passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
