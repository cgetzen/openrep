from __future__ import annotations

import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from run import QuietHandler, click_move, is_highlighted, wait_for_last_move

ROOT = Path(__file__).resolve().parents[1]


def expect_decision_prompt(page):
    prompt = page.locator('#prompt')
    expect(prompt).not_to_be_empty()
    expect(prompt.locator('strong')).to_have_count(0)
    expect(prompt).not_to_contain_text('Your move as Black')


def play_black_moves(page, moves):
    for move, opponent_reply in moves:
        expect_decision_prompt(page)
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

            # Reach the first meaningful Advance branching position in the response's
            # canonical teaching owner.
            play_black_moves(page, [
                ('c7c6', 'd2d4'),
                ('d7d5', 'e4e5'),
                ('c8f5', 'g1f3'),
            ])

            options = page.locator('#opponent-options')
            expect(options).to_be_visible()
            expect(options).to_contain_text('Other good moves for White')

            new_response = options.locator('[data-opponent-move="4.Be2"]')
            expect(new_response).to_contain_text('New response')
            expect(new_response.get_by_role('button', name='Learn response')).to_be_visible()

            covered = options.locator('[data-opponent-move="4.h4"]')
            expect(covered).to_contain_text('Covered elsewhere')
            expect(covered).to_contain_text('Advance — h4 / Tal ideas')
            expect(covered.get_by_role('button', name='Learn lesson')).to_be_visible()

            # Regression: the same position is also reached by the Tal lesson. The
            # canonical Be2 response must not be presented as another New response
            # there; it is owned/taught by Advance — Main setup exactly once.
            ownership_page = browser.new_page(viewport={"width": 1280, "height": 900})
            ownership_page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load')
            ownership_page.locator('[data-line-index="1"]').click()
            expect(ownership_page.locator('#line-title')).to_have_text('Advance — h4 / Tal ideas')
            play_black_moves(ownership_page, [
                ('c7c6', 'd2d4'),
                ('d7d5', 'e4e5'),
                ('c8f5', 'h2h4'),
            ])

            tal_options = ownership_page.locator('#opponent-options')
            tal_be2 = tal_options.locator('[data-opponent-move="4.Be2"]')
            expect(tal_be2).to_contain_text('Covered elsewhere')
            expect(tal_be2).to_contain_text('Advance — Main setup')
            expect(tal_be2).not_to_contain_text('New response')
            expect(tal_be2.get_by_role('button', name='Learn lesson')).to_be_visible()
            ownership_page.close()

            # Finish the canonical lesson first. Completion state belongs to the
            # workflow controls; the prompt remains the final move's advice.
            play_black_moves(page, [
                ('e7e6', 'f1e2'),
                ('c6c5', 'e1g1'),
                ('b8c6', 'c2c3'),
                ('g8e7', None),
            ])

            expect_decision_prompt(page)
            expect(page.locator('#prompt')).not_to_contain_text('Complete')
            response_summary = page.locator('#response-summary')
            expect(response_summary).to_be_visible()
            expect(response_summary).to_contain_text('Responses to learn')
            expect(response_summary).to_contain_text('0/1 learned')
            expect(response_summary).to_contain_text('4.Be2')
            expect(response_summary).not_to_contain_text('4.h4')

            response_summary.get_by_role('button', name='Learn response').click()
            expect(page.locator('#line-title')).to_have_text('Another good move: 4.Be2')
            expect(page.locator('#line-variation')).to_contain_text('New response')
            wait_for_last_move(page, 'f1e2')
            expect_decision_prompt(page)
            expect(page.locator('#prompt')).not_to_contain_text('How should Black respond?')

            # One correct repertoire response is enough to learn the response.
            # The prompt keeps the same advice-only presentation after completion.
            click_move(page, 'e7e6')
            expect_decision_prompt(page)
            expect(page.locator('#prompt')).not_to_contain_text('Response learned')
            expect(page.locator('#prompt')).not_to_contain_text('Typical continuation')
            expect(page.locator('#next-line')).to_have_text('Return to lesson')

            progress = page.evaluate("""() => {
              const raw = localStorage.getItem('openrep:v1:caro-kann-black');
              return JSON.parse(raw);
            }""")
            assert progress['learnedResponses'] == ['advance-quiet-be2']
            assert 'learnedDeviations' not in progress

            # Returning from a response learned at lesson-end restores the completed
            # lesson instead of restarting it, while preserving final-move advice.
            page.get_by_role('button', name='Return to lesson').click()
            expect(page.locator('#line-title')).to_have_text('Advance — Main setup')
            expect_decision_prompt(page)
            expect(page.locator('#prompt')).not_to_contain_text('Complete')
            expect(response_summary).to_contain_text('1/1 learned')
            expect(response_summary.get_by_role('button', name='Review response')).to_be_visible()

            # Remount with deterministic randomness so Practice must choose the newly
            # learned response route. Use the production trainer class so this test
            # retains the same prompt-presentation contract as the shipped app.
            page.evaluate("""async () => {
              const [{caroKann}, {caroKannResponses}, {OpenRepTrainerApp}] = await Promise.all([
                import('./src/openings/caro-kann.js'),
                import('./src/openings/caro-kann-responses.js?v=response-learning-v2'),
                import('./src/practice-trainer.js?v=advice-only-v1')
              ]);
              document.querySelector('#app').replaceChildren();
              const app = new OpenRepTrainerApp(
                document.querySelector('#app'),
                {...caroKann, responses: caroKannResponses},
                {evaluator: null, random: () => 0}
              );
              app.mount();
            }""")

            page.get_by_role('button', name='Practice test your recall').click()
            play_black_moves(page, [
                ('c7c6', 'd2d4'),
                ('d7d5', 'e4e5'),
                ('c8f5', 'f1e2'),
            ])

            expect_decision_prompt(page)
            assert is_highlighted(page, 'e2')
            expect(page.locator('#line-title')).to_have_text('Advance — Main setup — Quiet development')
            expect(page.locator('#line-variation')).to_have_text('1.e4 c6 2.d4 d5 3.e5 Bf5 4.Be2 e6')

            click_move(page, 'e7e6')
            wait_for_last_move(page, 'g1f3')
            expect_decision_prompt(page)
            click_move(page, 'c6c5')
            expect_decision_prompt(page)
            expect(page.locator('#prompt')).not_to_contain_text('Complete')
            expect(page.locator('#grading')).to_be_visible()

            browser.close()
            print('opponent response ownership Learn/Practice flow passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
