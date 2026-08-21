from __future__ import annotations

import functools
import http.server
import os
import threading

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect, sync_playwright

from run import QuietHandler, click_move, load_injected


def hold_opponent_autoplay(page):
    page.evaluate("""
      () => {
        const nativeSetTimeout = window.setTimeout.bind(window);
        window.__promptFlickerNativeSetTimeout = nativeSetTimeout;
        window.__promptFlickerOpponentCallback = null;
        window.setTimeout = (callback, delay, ...args) => {
          if (delay === 130 && window.__promptFlickerOpponentCallback === null) {
            window.__promptFlickerOpponentCallback = () => callback(...args);
            return 424242;
          }
          return nativeSetTimeout(callback, delay, ...args);
        };
      }
    """)


def release_opponent_autoplay(page):
    page.evaluate("""
      () => {
        window.setTimeout = window.__promptFlickerNativeSetTimeout;
        const callback = window.__promptFlickerOpponentCallback;
        window.__promptFlickerOpponentCallback = null;
        if (!callback) throw new Error('Expected opponent autoplay callback to be captured');
        callback();
      }
    """)


def ensure_hint_off(page):
    hint = page.locator('#hint-toggle')
    if 'Hint: on' in hint.inner_text():
        hint.click()
    expect(hint).to_have_text('Hint: off')


def assert_cue_only(prompt):
    expect(prompt.locator('strong')).to_have_count(0)
    expect(prompt).not_to_contain_text('Your move as Black')


def assert_stable_prompt_after_c6(page):
    ensure_hint_off(page)
    prompt = page.locator('#prompt')
    assert_cue_only(prompt)
    expect(prompt).to_contain_text('Prepare to challenge White’s center with ...d5.')
    expect(prompt).not_to_contain_text('Develop outside the pawn chain')
    expect(prompt).not_to_contain_text('Find c6')

    hold_opponent_autoplay(page)
    click_move(page, 'c7c6')

    expect(page.locator('.piece[data-piece-square="c6"]')).to_have_count(1)
    assert_cue_only(prompt)
    expect(prompt).to_contain_text('Prepare to challenge White’s center with ...d5.')
    expect(prompt).not_to_contain_text('Opponent move')
    expect(prompt).not_to_contain_text('Watch White’s choice')

    release_opponent_autoplay(page)
    assert_cue_only(prompt)
    expect(prompt).to_contain_text('Challenge White’s pawn center before it can consolidate.')
    expect(prompt).not_to_contain_text('Find d5')


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

            assert_stable_prompt_after_c6(page)

            page.get_by_role('button', name='Practice').click()
            assert_stable_prompt_after_c6(page)

            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
    print('cue-only prompt flicker regression passed')
