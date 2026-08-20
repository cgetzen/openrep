from __future__ import annotations

import functools
import http.server
import json
import os
import re
import threading

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect, sync_playwright

from run import ROOT, QuietHandler, click_move, get_course_lines, load_injected


def course_id(page, injected: bool):
    if injected:
        return page.evaluate('window.__OpenRep.caroKann.id')
    return page.evaluate("async () => (await import('./src/openings/caro-kann.js')).caroKann.id")


def mount_deterministic_app(page, injected: bool):
    if injected:
        page.evaluate("""
          () => {
            const values = [0.9, 0, 0];
            const random = () => values.length ? values.shift() : 0;
            document.querySelector('#app').replaceChildren();
            new window.__OpenRep.CoachingTrainerApp(
              document.querySelector('#app'),
              window.__OpenRep.caroKann,
              { random, evaluator: null }
            ).mount();
          }
        """)
        return

    page.evaluate("""
      async () => {
        const [{ CoachingTrainerApp }, { caroKann }] = await Promise.all([
          import('./src/coaching-trainer.js?v=practice-route-label-v1'),
          import('./src/openings/caro-kann.js')
        ]);
        const values = [0.9, 0, 0];
        const random = () => values.length ? values.shift() : 0;
        document.querySelector('#app').replaceChildren();
        new CoachingTrainerApp(
          document.querySelector('#app'),
          caroKann,
          { random, evaluator: null }
        ).mount();
      }
    """)


def complete_current_practice_route(page):
    prompt = page.locator('#prompt')
    for _ in range(20):
        expect(prompt).to_have_text(re.compile(r'(Your move as Black|Complete)'))
        if 'Complete' in prompt.inner_text():
            return

        hint_from = page.locator('.square.hint-from')
        hint_to = page.locator('.square.hint-to')
        expect(hint_from).to_have_count(1)
        expect(hint_to).to_have_count(1)
        uci = f"{hint_from.get_attribute('data-square')}{hint_to.get_attribute('data-square')}"
        click_move(page, uci)

    raise AssertionError('Practice route did not complete within 20 user moves')


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
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()
            injected = False
            try:
                page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load', timeout=8000)
            except PlaywrightError as error:
                if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(error):
                    raise
                page.close()
                page = context.new_page()
                load_injected(page)
                injected = True

            lines = get_course_lines(page, injected)
            first_line = lines[0]
            hillbilly = next(line for line in lines if line['id'] == 'hillbilly')
            early_nf3 = next(line for line in lines if line['id'] == 'early-nf3')
            now = page.evaluate('Date.now()')
            future = now + 24 * 60 * 60 * 1000
            progress = {
                'discovered': [early_nf3['id']],
                'learnedResponses': [],
                'lines': {
                    line['id']: {
                        'repetitions': 1,
                        'intervalDays': 1,
                        'ease': 2.5,
                        'dueAt': future + index,
                        'mistakes': 0,
                        'completions': 1,
                        'lastGrade': 'good',
                    }
                    for index, line in enumerate(lines)
                },
                'totalSessions': len(lines),
            }
            progress['lines'][first_line['id']]['dueAt'] = now - 2000
            progress['lines'][hillbilly['id']]['dueAt'] = now - 1000
            storage_key = f'openrep:v1:{course_id(page, injected)}'
            page.evaluate(
                '([key, value]) => localStorage.setItem(key, value)',
                [storage_key, json.dumps(progress)],
            )
            mount_deterministic_app(page, injected)

            page.get_by_role('button', name='Practice test your recall').click()
            expect(page.locator('#line-title')).to_have_text(first_line['title'])
            complete_current_practice_route(page)
            page.get_by_role('button', name='Good').click()

            expect(page.locator('#line-title')).to_have_text(early_nf3['title'])
            expect(page.locator('#line-variation')).to_have_text('1.e4 c6 2.Nf3 d5')
            expect(page.locator('#line-title')).not_to_have_text(hillbilly['title'])

            expect(page.locator('#prompt')).to_contain_text('c6')
            click_move(page, 'c7c6')
            expect(page.locator('.piece[data-piece-square="f3"]')).to_have_count(1)
            expect(page.locator('#prompt')).to_contain_text('d5')
            expect(page.locator('#line-title')).to_have_text(early_nf3['title'])

            browser.close()
            print('practice route label regression passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
