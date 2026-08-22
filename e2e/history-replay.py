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

            # At the first Black decision, record the complete learner-facing result
            # for a bad move: classification/score, explanation copy, and arrow.
            wait_for_last_move(page, 'e2e4')
            click_move(page, 'b7b5')
            live_feedback = page.locator('#feedback')
            expect(live_feedback).to_contain_text('Why this is bad')
            expect(live_feedback).to_contain_text('Bxb5')
            expect(live_feedback.locator('.move-quality')).to_have_count(1, timeout=15000)
            live_feedback_text = live_feedback.inner_text()
            expect(page.locator('.explanation-arrow[data-from="f1"][data-to="b5"]')).to_have_count(1)

            # Continue normally so the same decision can later be reached by rewind.
            click_move(page, 'c7c6')
            wait_for_last_move(page, 'd2d4')
            expect(page.locator('#history-status')).to_have_text('Current position')

            # Rewinding to an opponent turn starts a separate analysis variation.
            # Moves stick, both sides remain movable, and each exploratory move is
            # scored without advancing the lesson's live route.
            page.locator('#history-back').click()
            expect(page.locator('#history-status')).to_have_text('Position 2 / 3')
            expect(square(page, 'd2')).to_be_enabled()

            click_move(page, 'd2d4')
            historical_feedback = page.locator('#history-feedback')
            expect(page.locator('#history-status')).to_contain_text('Analysis 1/6')
            expect(historical_feedback.locator('.move-quality')).to_have_count(1, timeout=15000)
            expect(historical_feedback).to_contain_text('d4')
            expect(page.locator('.piece[data-piece-square="d4"]')).to_have_count(1)
            expect(page.locator('#analysis-return')).to_be_visible()

            click_move(page, 'd7d5')
            expect(page.locator('#history-status')).to_contain_text('Analysis 2/6')
            expect(historical_feedback.locator('.move-quality')).to_have_count(1, timeout=15000)
            expect(historical_feedback).to_contain_text('d5')
            expect(page.locator('.piece[data-piece-square="d4"]')).to_have_count(1)
            expect(page.locator('.piece[data-piece-square="d5"]')).to_have_count(1)

            click_move(page, 'e4e5')
            expect(page.locator('#history-status')).to_contain_text('Analysis 3/6')
            expect(historical_feedback.locator('.move-quality')).to_have_count(1, timeout=15000)
            expect(page.locator('.piece[data-piece-square="e5"]')).to_have_count(1)
            expect(page.locator('#prompt')).to_contain_text('Known repertoire position')

            # History buttons first navigate the temporary analysis branch. Undo and
            # redo must preserve the exploratory continuation before history itself moves.
            page.locator('#history-back').click()
            expect(page.locator('#history-status')).to_contain_text('Analysis 2/6')
            expect(page.locator('.piece[data-piece-square="e4"]')).to_have_count(1)
            expect(page.locator('.piece[data-piece-square="e5"]')).to_have_count(0)
            page.locator('#history-forward').click()
            expect(page.locator('#history-status')).to_contain_text('Analysis 3/6')
            expect(page.locator('.piece[data-piece-square="e5"]')).to_have_count(1)

            # Returning to the line discards only the temporary branch and restores
            # the original historical projection at its anchor.
            page.locator('#analysis-return').click()
            expect(page.locator('#history-status')).to_have_text('Position 2 / 3')
            expect(page.locator('.piece[data-piece-square="d2"]')).to_have_count(1)
            expect(page.locator('.piece[data-piece-square="d4"]')).to_have_count(0)

            # Rewind to the exact same Black decision and try the exact same bad move.
            # 1→2→X and 1→2→3→2→X must be learner-facing identical.
            page.locator('#history-back').click()
            expect(page.locator('#history-status')).to_have_text('Position 1 / 3')
            expect(square(page, 'b7')).to_be_enabled()
            expect(square(page, 'c6').locator('.hint-target-indicator')).to_have_count(1)

            click_move(page, 'b7b5')
            historical_feedback = page.locator('#history-feedback')
            expect(page.locator('#history-status')).to_have_text('Position 1 / 3')
            expect(historical_feedback).to_contain_text('Why this is bad')
            expect(historical_feedback).to_contain_text('Bxb5')
            expect(historical_feedback.locator('.move-quality')).to_have_count(1, timeout=15000)
            expect(historical_feedback).to_have_text(live_feedback_text)
            expect(page.locator('.explanation-arrow[data-from="f1"][data-to="b5"]')).to_have_count(1)

            # A wrong historical answer did not mutate/advance the session. Playing
            # the repertoire answer still acts like Forward, and the recorded White
            # reply replays automatically until the original live position returns.
            click_move(page, 'c7c6')
            expect(page.locator('#history-status')).to_have_text('Current position', timeout=3000)
            expect(square(page, 'd2')).to_have_class(re.compile(r'last-move'))
            expect(square(page, 'd4')).to_have_class(re.compile(r'last-move'))

            # The live history is still exactly three plies long.
            page.locator('#history-back').click()
            expect(page.locator('#history-status')).to_have_text('Position 2 / 3')

            browser.close()
            print('Sticky analysis variation, known-position recognition, and equivalent-attempt parity regression passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
