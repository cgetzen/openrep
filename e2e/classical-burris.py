from __future__ import annotations

import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from run import QuietHandler, click_move, wait_for_last_move

ROOT = Path(__file__).resolve().parents[1]


def expect_decision_prompt(page):
    prompt = page.locator('#prompt')
    expect(prompt).not_to_be_empty()
    expect(prompt.locator('strong')).to_have_count(0)
    expect(prompt).not_to_contain_text('Your move as Black')


def wait_for_expected_move(page, move):
    expect(page.locator(f'.square.hint-from[data-square="{move[:2]}"]')).to_have_count(1)
    expect(page.locator(f'.square.hint-to[data-square="{move[2:4]}"]')).to_have_count(1)
    expect_decision_prompt(page)


def play_black_moves(page, moves):
    for move, opponent_reply in moves:
        wait_for_expected_move(page, move)
        click_move(page, move)
        if opponent_reply:
            wait_for_last_move(page, opponent_reply)


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
            expect(page.get_by_role('heading', name='Caro-Kann Defense')).to_be_visible()

            # Enter the canonical Classical lesson and reach the decision after 4...Bf5.
            page.locator('[data-line-index="3"]').click()
            expect(page.locator('#line-title')).to_have_text('Classical — 4...Bf5')
            play_black_moves(page, [
                ('c7c6', 'd2d4'),
                ('d7d5', 'b1c3'),
                ('d5e4', 'c3e4'),
                ('c8f5', 'e4g3'),
            ])

            # 5.Bd3 used to be a one-answer "New response". It is now a full branch,
            # so the canonical decision panel must route it to Covered elsewhere.
            options = page.locator('#opponent-options')
            expect(options).to_be_visible()
            bd3 = options.locator('[data-opponent-move="5.Bd3"]')
            expect(bd3).to_contain_text('Covered elsewhere')
            expect(bd3).to_contain_text('Classical — 5.Bd3 Burris Gambit')
            expect(bd3).not_to_contain_text('New response')
            learn_lesson = bd3.get_by_role('button', name='Learn lesson')
            expect(learn_lesson).to_be_visible()

            learn_lesson.click()
            expect(page.locator('#line-title')).to_have_text('Classical — 5.Bd3 Burris Gambit')
            expect(page.locator('#line-variation')).to_contain_text('5.Bd3 Qxd4')

            # The promoted branch must continue beyond the first answer and train the
            # gambit-specific consolidation decisions through 10...Nbd7.
            play_black_moves(page, [
                ('c7c6', 'd2d4'),
                ('d7d5', 'b1c3'),
                ('d5e4', 'c3e4'),
                ('c8f5', 'f1d3'),
                ('d8d4', 'g1f3'),
                ('d4d8', 'd1e2'),
                ('e7e6', 'e1g1'),
                ('f5e4', 'd3e4'),
                ('g8f6', 'c1f4'),
                ('b8d7', None),
            ])

            expect_decision_prompt(page)
            expect(page.locator('#feedback')).to_contain_text('clean rep')
            expect(page.locator('#grading')).to_be_hidden()

            browser.close()
            print('Classical 5.Bd3 full-line promotion flow passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
