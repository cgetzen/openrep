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
            # Practice may intentionally sample learned alternate routes. This test is
            # specifically about spaced scheduling, so always choose the canonical
            # route; alternate-route sampling has dedicated coverage elsewhere.
            context.add_init_script(script='Math.random = () => 1;')
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
            future = now + 24 * 60 * 60 * 1000
            scheduled_line = lines[-1]
            progress = {
                # This fixture isolates the spaced scheduler. Marking every lesson
                # discovered makes learned alternate routes intentionally eligible in
                # Practice, which is tested separately in opponent-deviations.py.
                'discovered': [scheduled_line['id']],
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

            for uci in scheduled_line['moves'][1::2]:
                expect(page.locator('#prompt')).to_contain_text('Your move as Black')
                print(f'spaced regression move: {uci}', flush=True)
                click_move(page, uci)
                expect(page.locator('#feedback')).not_to_have_class(re.compile(r'\bwrong\b'))

            expect(page.locator('#prompt')).to_contain_text('Complete')
            next_button = page.locator('#next-line')
            expect(next_button).to_be_disabled()
            expect(next_button).to_have_text('Grade to continue')

            page.get_by_role('button', name='Good').click()
            expect(page.locator('#line-title')).to_have_text('Spaced reviews complete')
            expect(page.locator('#prompt')).to_contain_text('You’re caught up')
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
            print('spaced practice final-review regression passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
