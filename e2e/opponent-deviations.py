from __future__ import annotations

import functools
import http.server
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from run import QuietHandler, click_move, is_highlighted

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
            expect(page.get_by_role('heading', name='Caro-Kann Defense')).to_be_visible()

            for move in ['c7c6', 'd7d5', 'c8f5']:
                expect(page.locator('#prompt')).to_contain_text('Your move as Black')
                click_move(page, move)

            options = page.locator('#opponent-options')
            expect(options).to_be_visible()
            expect(options).to_contain_text('4.h4')
            expect(options).to_contain_text('4.Nc3')
            expect(options).to_contain_text('4.Be2')
            expect(options).to_contain_text('Advance — Quiet Be2')

            page.get_by_role('button', name='Try 4.Be2').click()
            expect(page.locator('#prompt')).to_contain_text('Your move as Black')
            click_move(page, 'e7e6')
            expect(page.locator('#prompt')).to_contain_text('Your move as Black')
            click_move(page, 'c6c5')
            expect(page.locator('#feedback')).to_contain_text('Variation complete — Advance — Quiet Be2')
            expect(page.locator('#next-line')).to_have_text('Return to main line')

            learned = page.evaluate("""() => {
              const raw = localStorage.getItem('openrep:v1:caro-kann-black');
              return JSON.parse(raw).learnedDeviations;
            }""")
            assert 'micro:advance-quiet-be2' in learned

            page.evaluate("""async () => {
              const [{caroKann}, {caroKannDeviations}, {CoachingTrainerApp}] = await Promise.all([
                import('./src/openings/caro-kann.js'),
                import('./src/openings/caro-kann-deviations.js?v=opponent-deviations-v1'),
                import('./src/coaching-trainer.js?v=opponent-deviations-v1')
              ]);
              document.querySelector('#app').replaceChildren();
              const app = new CoachingTrainerApp(
                document.querySelector('#app'),
                {...caroKann, deviations: caroKannDeviations},
                {evaluator: null, random: () => 0}
              );
              app.mount();
            }""")

            page.get_by_role('button', name='Practice test your recall').click()
            for move in ['c7c6', 'd7d5', 'c8f5']:
                expect(page.locator('#prompt')).to_contain_text('Your move as Black')
                click_move(page, move)

            expect(page.locator('#prompt')).to_contain_text('Your move as Black')
            assert is_highlighted(page, 'e2')
            expect(page.locator('#line-variation')).to_contain_text('4.Be2')
            expect(page.locator('#line-variation')).to_contain_text('Advance — Quiet Be2')

            browser.close()
            print('opponent deviation Learn/Practice flow passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
