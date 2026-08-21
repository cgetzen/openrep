from __future__ import annotations

import functools
import http.server
import os
import threading

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect, sync_playwright

from run import QuietHandler, click_move, load_injected, wait_for_last_move


def ensure_hint_off(page):
    hint = page.locator('#hint-toggle')
    if 'Hint: on' in hint.inner_text():
        hint.click()
    expect(hint).to_have_text('Hint: off')


def assert_history_shows_advice(page):
    ensure_hint_off(page)
    prompt = page.locator('#prompt')
    history_status = page.locator('#history-status')

    expect(prompt).to_contain_text('Prepare to challenge White’s center with ...d5.')
    click_move(page, 'c7c6')
    wait_for_last_move(page, 'd2d4')
    expect(prompt).to_contain_text('Challenge White’s pawn center before it can consolidate.')

    page.locator('#history-back').click()
    expect(history_status).to_have_text('Position 2 / 3')
    expect(prompt).to_contain_text('Advice for c6.')
    expect(prompt).to_contain_text('Prepare to challenge White’s center with ...d5.')
    expect(prompt).not_to_contain_text('Reviewing this route')
    expect(prompt).not_to_contain_text('Use → to return')

    page.locator('#history-back').click()
    expect(history_status).to_have_text('Position 1 / 3')
    expect(prompt).to_contain_text('Your move as Black')
    expect(prompt).to_contain_text('Prepare to challenge White’s center with ...d5.')
    expect(prompt).not_to_contain_text('Reviewing this route')
    expect(prompt).not_to_contain_text('Position 1 of 3')

    page.locator('#history-forward').click()
    page.locator('#history-forward').click()
    expect(history_status).to_have_text('Current position')
    expect(prompt).to_contain_text('Challenge White’s pawn center before it can consolidate.')


def run():
    root = __import__('pathlib').Path(__file__).resolve().parents[1]
    handler = functools.partial(QuietHandler, directory=str(root))
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
            context = browser.new_context(viewport={"width": 1440, "height": 1050})
            page = context.new_page()
            try:
                page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load', timeout=8000)
            except PlaywrightError as error:
                if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(error):
                    raise
                page.close()
                page = context.new_page()
                load_injected(page)

            assert_history_shows_advice(page)

            page.get_by_role('button', name='Practice').click()
            expect(page.locator('#prompt')).to_contain_text('Your move as Black')
            assert_history_shows_advice(page)

            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
    print('history advice Learn/Practice regression passed')
