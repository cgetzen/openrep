from __future__ import annotations

import functools
import http.server
import os
import re
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def square(page, name: str):
    return page.locator(f'.square[data-square="{name}"]')


def click_move(page, uci: str):
    square(page, uci[:2]).click()
    square(page, uci[2:4]).click()


def wait_for_last_move(page, uci: str):
    expect(square(page, uci[:2])).to_have_class(re.compile(r'last-move'))
    expect(square(page, uci[2:4])).to_have_class(re.compile(r'last-move'))


def run():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with sync_playwright() as p:
            launch = {'headless': True}
            chromium_path = os.environ.get('CHROMIUM_PATH')
            if chromium_path:
                launch['executable_path'] = chromium_path
                launch['args'] = ['--no-sandbox']
            browser = p.chromium.launch(**launch)
            page = browser.new_page(viewport={"width": 1440, "height": 1050})
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load')

            # The generated snapshot is projected into the existing curriculum,
            # rather than creating a parallel generated-training UI.
            expect(page.locator(
                '[data-curriculum-tier="core"] [data-curriculum-family="two-knights-coverage"]'
            )).to_have_count(1)
            expect(page.locator(
                '[data-curriculum-tier="important"] [data-curriculum-family="early-nf3"]'
            )).to_have_count(1)
            expect(page.locator(
                '[data-curriculum-tier="sideline"] [data-curriculum-family="quiet-d3"]'
            )).to_have_count(1)

            for response_id in (
                'two-knights-d4-transposition',
                'two-knights-qf3',
                'two-knights-exchange',
                'two-knights-d3',
            ):
                expect(page.locator(f'[data-curriculum-response="{response_id}"]')).to_have_count(1)

            # Hillbilly's generated terminal alternative should behave exactly
            # like any other accepted completion move.
            hillbilly = page.locator('#line-list [data-line-index]').filter(has_text='Hillbilly Attack')
            expect(hillbilly).to_have_count(1)
            hillbilly.click()
            expect(page.locator('#line-title')).to_have_text('Hillbilly Attack')
            wait_for_last_move(page, 'e2e4')

            sequence = [
                ('c7c6', 'f1c4'),
                ('d7d5', 'e4d5'),
                ('c6d5', 'c4b5'),
                ('b8c6', 'd2d4'),
                ('g8f6', 'g1f3'),
            ]
            for black_move, white_reply in sequence:
                click_move(page, black_move)
                wait_for_last_move(page, white_reply)

            click_move(page, 'c8g4')
            expect(page.locator('#feedback')).to_contain_text('clean rep')
            expect(page.locator('#completion-theory')).to_be_visible()
            played = page.locator('#completion-theory .completion-theory-choice.played')
            expect(played).to_contain_text('Bg4')
            expect(played).to_contain_text('Also works')
            expect(played).to_contain_text('You played')

            # History may reconstruct the accepted Bg4 that was actually played,
            # but moving back/forward to the same decision must still project the
            # canonical Bf5 + accepted-Bg4 repertoire semantics.
            page.locator('#history-back').click()
            page.locator('#history-back').click()
            page.locator('#history-forward').click()
            expect(page.locator('#prompt')).to_contain_text('Bf5')
            click_move(page, 'c8f5')
            expect(page.locator('#feedback')).not_to_contain_text('not the move this line teaches')
            expect(page.locator('#feedback')).not_to_contain_text('repertoire choice here')
            expect(page.locator('#feedback')).to_contain_text('clean rep')

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
