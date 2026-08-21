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


def line_progress(recent_attempts):
    return {
        'repetitions': 0,
        'intervalDays': 0,
        'ease': 2.5,
        'dueAt': 0,
        'mistakes': 0,
        'completions': 0,
        'recentAttempts': recent_attempts,
    }


def complete_current_line(page):
    feedback = page.locator('#feedback')
    for _ in range(24):
        if 'Line complete' in feedback.inner_text():
            return

        hint_from = page.locator('.square.hint-from')
        hint_to = page.locator('.square.hint-to')
        expect(hint_from).to_have_count(1)
        expect(hint_to).to_have_count(1)
        uci = f"{hint_from.get_attribute('data-square')}{hint_to.get_attribute('data-square')}"
        click_move(page, uci)
        expect(feedback).not_to_have_class(re.compile(r'\bwrong\b'))

    raise AssertionError('Line did not complete within 24 user moves')


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
            context.add_init_script('Math.random = () => 0;')
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
            weak_line = lines[1]
            storage_key = f'openrep:v1:{course_id(page, injected)}'
            progress = {
                'discovered': [first_line['id'], weak_line['id']],
                'learnedResponses': [],
                'lines': {
                    first_line['id']: line_progress([0, 0, 0, 0]),
                    weak_line['id']: line_progress([3, 2, 0, 0, 0]),
                },
                'totalSessions': 0,
            }
            page.evaluate(
                '([key, value]) => localStorage.setItem(key, value)',
                [storage_key, json.dumps(progress)],
            )
            restore_app(page, injected)

            first_item = page.locator('[data-line-index="0"]')
            weak_item = page.locator('[data-line-index="1"]')
            expect(first_item.locator('.status-pill')).to_have_text('Learning')
            expect(weak_item.locator('.status-pill')).to_have_text('Learning')
            expect(page.locator('#course-progress')).to_contain_text('0mastered')

            first_item.click()
            complete_current_line(page)
            expect(first_item.locator('.status-pill')).to_have_text('Mastered')
            expect(page.locator('#course-progress')).to_contain_text('1mastered')

            stored = json.loads(page.evaluate('(key) => localStorage.getItem(key)', storage_key))
            assert stored['lines'][first_line['id']]['recentAttempts'] == [0, 0, 0, 0, 0]

            first_item.click()
            expect(page.locator('.square.hint-from')).to_have_count(1)
            click_move(page, 'g8f6')
            expect(page.locator('#feedback')).to_have_class(re.compile(r'\bwrong\b'))
            complete_current_line(page)

            expect(first_item.locator('.status-pill')).to_have_text('Learning')
            expect(page.locator('#course-progress')).to_contain_text('0mastered')
            stored = json.loads(page.evaluate('(key) => localStorage.getItem(key)', storage_key))
            assert stored['lines'][first_line['id']]['recentAttempts'] == [0, 0, 0, 0, 1]

            page.get_by_role('button', name='Practice test your recall').click()
            page.get_by_role('button', name='Weak focus weakest lines').click()
            expect(page.locator('#line-counter')).to_contain_text('PRACTICE · WEAK')
            expect(page.locator('#line-counter')).to_contain_text('Line 2/')

            browser.close()
            print('recent attempt mastery regression passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
