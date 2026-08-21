from __future__ import annotations

import functools
import http.server
import json
import os
import re
import threading

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect, sync_playwright

from run import QuietHandler, click_move, get_course_lines, load_injected, restore_app

DAY = 24 * 60 * 60 * 1000


def course_id(page, injected: bool):
    if injected:
        return page.evaluate('window.__OpenRep.caroKann.id')
    return page.evaluate("async () => (await import('./src/openings/caro-kann.js')).caroKann.id")


def run():
    handler = functools.partial(QuietHandler)
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
            now = page.evaluate('Date.now()')
            future = now + DAY
            scheduled_line = lines[-1]
            progress = {
                'discovered': [scheduled_line['id']],
                'lines': {
                    line['id']: {
                        'repetitions': 1,
                        'intervalDays': 1,
                        'ease': 2.5,
                        'dueAt': future + index,
                        'mistakes': 0,
                        'completions': 1,
                        'recentAttempts': [0],
                    }
                    for index, line in enumerate(lines)
                },
                'totalSessions': len(lines),
            }
            progress['lines'][scheduled_line['id']]['dueAt'] = now - 1000
            storage_key = f'openrep:v1:{course_id(page, injected)}'
            page.evaluate(
                '([key, value]) => localStorage.setItem(key, value)',
                [storage_key, json.dumps(progress)],
            )
            restore_app(page, injected)

            practice = page.get_by_role('button', name='Practice test your recall')
            practice.click()
            expect(page.locator('#line-title')).to_have_text(scheduled_line['title'])
            expect(page.locator('#line-counter')).to_contain_text('PRACTICE · SPACED')
            expect(page.locator('#grading')).to_be_hidden()

            # Practice may intentionally sample a learned alternate route for this
            # scheduled line. Follow the route the UI presents instead of hard-coding
            # canonical branch moves; completion is workflow state, not prompt copy.
            prompt = page.locator('#prompt')
            next_button = page.locator('#next-line')
            for _ in range(20):
                if next_button.inner_text() == 'Next review →':
                    break

                expect(prompt).not_to_be_empty()
                expect(prompt.locator('strong')).to_have_count(0)
                expect(prompt).not_to_contain_text('Your move as Black')
                expect(prompt).not_to_contain_text('Complete')

                hint_from = page.locator('.square.hint-from')
                hint_to = page.locator('.square.hint-to')
                expect(hint_from).to_have_count(1)
                expect(hint_to).to_have_count(1)
                uci = f"{hint_from.get_attribute('data-square')}{hint_to.get_attribute('data-square')}"
                print(f'spaced regression move: {uci}', flush=True)
                click_move(page, uci)
                expect(page.locator('#feedback')).not_to_have_class(re.compile(r'\bwrong\b'))
            else:
                raise AssertionError('Practice route did not complete within 20 user moves')

            expect(prompt).not_to_be_empty()
            expect(prompt.locator('strong')).to_have_count(0)
            expect(prompt).not_to_contain_text('Complete')
            expect(page.locator('#grading')).to_be_hidden()
            expect(page.get_by_role('button', name='Again')).to_have_count(0)
            expect(page.get_by_role('button', name='Hard')).to_have_count(0)
            expect(page.get_by_role('button', name='Good')).to_have_count(0)
            expect(page.get_by_role('button', name='Easy')).to_have_count(0)
            expect(next_button).to_be_enabled()
            expect(next_button).to_have_text('Next review →')

            stored = page.evaluate(
                'key => JSON.parse(localStorage.getItem(key))',
                storage_key,
            )
            scheduled = stored['lines'][scheduled_line['id']]
            assert scheduled['spacingStage'] == 1, scheduled
            assert scheduled['intervalDays'] == 3, scheduled
            assert scheduled['completions'] == 2, scheduled
            assert scheduled['recentAttempts'][-1] == 0, scheduled
            assert scheduled['dueAt'] >= now + 3 * DAY - 60_000, scheduled

            next_button.click()
            expect(page.locator('#line-title')).to_have_text('Spaced reviews complete')
            expect(page.locator('#prompt')).to_be_empty()
            expect(page.locator('#feedback')).to_contain_text('No spaced reviews are due right now')
            expect(page.locator('#line-counter')).to_contain_text('CAUGHT UP')
            expect(next_button).to_be_disabled()
            expect(next_button).to_have_text('Reviews complete')

            page.wait_for_timeout(250)
            expect(page.locator('#line-title')).to_have_text('Spaced reviews complete')

            page.get_by_role('button', name='Weak focus weakest lines').click()
            expect(page.locator('#line-counter')).to_contain_text('PRACTICE · WEAK')
            expect(page.locator('#line-counter')).not_to_contain_text('CAUGHT UP')

            browser.close()
            print('automatic spaced practice regression passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
