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


def begin_lesson_mutation_guard(page):
    page.evaluate(
        """
        () => {
          window.__historyLessonObserver?.disconnect();
          window.__historyLessonMutations = [];
          const lessonCard = document.querySelector('.lesson-card');
          window.__historyLessonObserver = new MutationObserver(records => {
            for (const record of records) {
              const target = record.target.nodeType === Node.ELEMENT_NODE
                ? record.target
                : record.target.parentElement;
              if (target?.closest?.('#prompt')) continue;
              window.__historyLessonMutations.push({
                type: record.type,
                target: target?.id || target?.className || target?.tagName || 'unknown'
              });
            }
          });
          window.__historyLessonObserver.observe(lessonCard, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true
          });
        }
        """
    )


def assert_only_advice_mutated(page):
    page.wait_for_timeout(25)
    unexpected = page.evaluate('() => window.__historyLessonMutations ?? []')
    assert unexpected == [], f'history navigation mutated stable lesson UI: {unexpected}'
    page.evaluate('() => { window.__historyLessonMutations = []; }')


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

    feedback_before = page.locator('#feedback').evaluate('(el) => el.outerHTML')
    opponent_options_before = page.locator('#opponent-options').evaluate('(el) => el.outerHTML')
    begin_lesson_mutation_guard(page)

    page.locator('#history-back').click()
    expect(history_status).to_have_text('Position 2 / 3')
    expect(prompt).to_have_text('Prepare to challenge White’s center with ...d5.')
    assert_cue_only(prompt)
    expect(prompt).not_to_contain_text('Advice for')
    expect(prompt).not_to_contain_text('Reviewing this route')
    assert_only_advice_mutated(page)

    page.locator('#history-back').click()
    expect(history_status).to_have_text('Position 1 / 3')
    expect(prompt).to_have_text('Prepare to challenge White’s center with ...d5.')
    assert_cue_only(prompt)
    assert_only_advice_mutated(page)

    page.locator('#history-back').click()
    expect(history_status).to_have_text('Position 0 / 3')
    expect(prompt).to_be_empty()
    expect(prompt).not_to_contain_text('Reviewing this route')
    expect(prompt).not_to_contain_text('Use → to return')
    assert_only_advice_mutated(page)

    page.locator('#history-forward').click()
    expect(prompt).to_have_text('Prepare to challenge White’s center with ...d5.')
    assert_only_advice_mutated(page)
    page.locator('#history-forward').click()
    expect(prompt).to_have_text('Prepare to challenge White’s center with ...d5.')
    assert_only_advice_mutated(page)
    page.locator('#history-forward').click()
    expect(history_status).to_have_text('Current position')
    assert_cue_only(prompt)
    expect(prompt).to_contain_text('Challenge White’s pawn center before it can consolidate.')
    assert_only_advice_mutated(page)

    assert page.locator('#feedback').evaluate('(el) => el.outerHTML') == feedback_before
    assert page.locator('#opponent-options').evaluate('(el) => el.outerHTML') == opponent_options_before
    page.evaluate('() => window.__historyLessonObserver?.disconnect()')


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
            assert_history_shows_advice(page)

            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
    print('advice-only history mutation invariant Learn/Practice regression passed')
