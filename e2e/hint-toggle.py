from __future__ import annotations

import functools
import http.server
import re
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from run import QuietHandler

ROOT = Path(__file__).resolve().parents[1]


def assert_cue_only(prompt):
    expect(prompt).not_to_be_empty(timeout=3000)
    expect(prompt.locator('strong')).to_have_count(0)
    expect(prompt).not_to_contain_text('Your move as Black')


def assert_hint_on(page, prompt, target):
    assert_cue_only(prompt)
    expect(page.get_by_role('button', name='Hint: on')).to_be_visible()
    expect(prompt).to_contain_text('Find c6.')
    expect(target.locator('.hint-target-indicator')).to_have_count(1)
    expect(page.locator('.square.hint-from')).to_have_count(1)
    expect(page.locator('.square.hint-to')).to_have_count(1)


def assert_hint_off(page, prompt, target):
    assert_cue_only(prompt)
    expect(page.get_by_role('button', name='Hint: off')).to_be_visible()
    expect(prompt).not_to_contain_text('Find c6.')
    expect(target.locator('.hint-target-indicator')).to_have_count(0)
    expect(page.locator('.square.hint-from')).to_have_count(0)
    expect(page.locator('.square.hint-to')).to_have_count(0)


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

            prompt = page.locator('#prompt')
            target = page.locator('.square[data-square="c6"]')
            assert_cue_only(prompt)

            # Learn and Practice share one hint contract: text clue + board marker.
            assert_hint_on(page, prompt, target)
            page.get_by_role('button', name='Hint: on').click()
            assert_hint_off(page, prompt, target)

            # Legal destinations remain normal board interaction, not proactive hints.
            page.locator('.square[data-square="c7"]').click()
            expect(target).to_have_class(re.compile(r'\blegal-target\b'))
            expect(target.locator('.hint-target-indicator')).to_have_count(0)

            # Switching modes must preserve the same hint choice and semantics.
            page.get_by_role('button', name='Practice test your recall').click()
            assert_hint_off(page, prompt, target)

            # Changing Practice strategy must not reset the hint choice either.
            page.get_by_role('button', name='Weak focus weakest lines').click()
            assert_hint_off(page, prompt, target)

            page.get_by_role('button', name='Hint: off').click()
            assert_hint_on(page, prompt, target)

            # The same enabled state carries back into Learn without mode overrides.
            page.get_by_role('button', name='Learn discover lines').click()
            assert_hint_on(page, prompt, target)

            page.get_by_role('button', name='Hint: on').click()
            assert_hint_off(page, prompt, target)

            browser.close()
            print('Learn/Practice cue-only hint toggle regression passed')
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
