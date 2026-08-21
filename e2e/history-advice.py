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


def assert_cue_only(prompt):
    expect(prompt.locator('strong')).to_have_count(0)
    expect(prompt).not_to_contain_text('Your move as Black')


def open_line(page, index, first_move='e2e4'):
    page.locator(f'[data-line-index="{index}"]').click()
    wait_for_last_move(page, first_move)


def assert_history_shows_advice(page):
    ensure_hint_off(page)
    prompt = page.locator('#prompt')
    history_status = page.locator('#history-status')

    assert_cue_only(prompt)
    expect(prompt).to_contain_text('Prepare to challenge White’s center with ...d5.')
    click_move(page, 'c7c6')
    wait_for_last_move(page, 'd2d4')
    assert_cue_only(prompt)
    expect(prompt).to_contain_text('Challenge White’s pawn center before it can consolidate.')

    page.locator('#history-back').click()
    expect(history_status).to_have_text('Position 2 / 3')
    expect(prompt).to_have_text('Prepare to challenge White’s center with ...d5.')
    assert_cue_only(prompt)
    expect(prompt).not_to_contain_text('Advice for')
    expect(prompt).not_to_contain_text('Reviewing this route')

    page.locator('#history-back').click()
    expect(history_status).to_have_text('Position 1 / 3')
    expect(prompt).to_have_text('Prepare to challenge White’s center with ...d5.')
    assert_cue_only(prompt)

    page.locator('#history-back').click()
    expect(history_status).to_have_text('Position 0 / 3')
    expect(prompt).to_be_empty()
    expect(prompt).not_to_contain_text('Reviewing this route')
    expect(prompt).not_to_contain_text('Use → to return')

    page.locator('#history-forward').click()
    expect(prompt).to_have_text('Prepare to challenge White’s center with ...d5.')
    page.locator('#history-forward').click()
    expect(prompt).to_have_text('Prepare to challenge White’s center with ...d5.')
    page.locator('#history-forward').click()
    expect(history_status).to_have_text('Current position')
    assert_cue_only(prompt)
    expect(prompt).to_contain_text('Challenge White’s pawn center before it can consolidate.')


def assert_quiet_d3_feedback_tracks_history(page):
    open_line(page, 9)
    click_move(page, 'c7c6')
    wait_for_last_move(page, 'd2d3')
    click_move(page, 'd7d5')
    wait_for_last_move(page, 'b1d2')
    click_move(page, 'e7e5')
    wait_for_last_move(page, 'g1f3')
    click_move(page, 'f8d6')
    wait_for_last_move(page, 'g2g3')

    live_feedback = page.locator('#feedback')
    history_feedback = page.locator('#history-feedback')
    expect(live_feedback).to_have_text(
        'Bd6 — 4...Bd6 develops toward the kingside and supports the center.'
    )

    page.locator('#history-back').click()
    expect(history_feedback).to_be_visible()
    expect(history_feedback).to_have_text(
        'Bd6 — 4...Bd6 develops toward the kingside and supports the center.'
    )
    expect(live_feedback).to_be_hidden()

    page.locator('#history-back').click()
    expect(history_feedback).to_have_text(
        'e5 — 3...e5 creates a broad center because White has not challenged it.'
    )

    page.locator('#history-back').click()
    page.locator('#history-back').click()
    expect(history_feedback).to_have_text(
        'd5 — 2...d5 claims equal central space immediately.'
    )

    for _ in range(4):
        page.locator('#history-forward').click()
    expect(page.locator('#history-status')).to_have_text('Current position')
    expect(live_feedback).to_be_visible()
    expect(live_feedback).to_have_text(
        'Bd6 — 4...Bd6 develops toward the kingside and supports the center.'
    )
    expect(history_feedback).to_be_hidden()


def assert_opponent_options_track_history(page):
    open_line(page, 0)
    click_move(page, 'c7c6')
    wait_for_last_move(page, 'd2d4')
    click_move(page, 'd7d5')
    wait_for_last_move(page, 'e4e5')

    panel = page.locator('#opponent-options')
    expect(panel).to_be_visible()
    current_options = panel.inner_text()

    page.locator('#history-back').click()
    expect(panel).to_be_visible()
    after_d5_options = panel.inner_text()
    assert after_d5_options == current_options

    page.locator('#history-back').click()
    expect(panel).to_be_visible()
    after_d4_options = panel.inner_text()
    assert after_d4_options != after_d5_options

    page.locator('#history-forward').click()
    page.locator('#history-forward').click()
    expect(page.locator('#history-status')).to_have_text('Current position')
    expect(panel).to_be_visible()
    assert panel.inner_text() == current_options


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
            assert_quiet_d3_feedback_tracks_history(page)
            assert_opponent_options_track_history(page)

            open_line(page, 0)
            page.get_by_role('button', name='Practice').click()
            assert_history_shows_advice(page)

            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
    print('position-projected history context Learn/Practice regression passed')
