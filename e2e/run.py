from __future__ import annotations

import functools
import http.server
import json
import re
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def square(page, name):
    return page.locator(f'.square[data-square="{name}"]')


def click_move(page, uci):
    square(page, uci[:2]).click()
    square(page, uci[2:4]).click()


def drag_move(page, uci):
    source = square(page, uci[:2])
    target = square(page, uci[2:4])
    source_box = source.bounding_box()
    target_box = target.bounding_box()
    assert source_box and target_box
    page.mouse.move(source_box['x'] + source_box['width'] / 2, source_box['y'] + source_box['height'] / 2)
    page.mouse.down()
    page.mouse.move(target_box['x'] + target_box['width'] / 2, target_box['y'] + target_box['height'] / 2, steps=8)
    page.mouse.up()


def is_highlighted(page, square_name):
    return 'last-move' in (square(page, square_name).get_attribute('class') or '')


def wait_for_last_move(page, uci):
    expect(square(page, uci[:2])).to_have_class(re.compile(r'last-move'))
    expect(square(page, uci[2:4])).to_have_class(re.compile(r'last-move'))


def expect_decision_prompt(page):
    expect(page.locator('#prompt')).not_to_be_empty()


def get_course_lines(page, injected):
    return page.evaluate("""async (courseModule) => {
        const module = await import(courseModule);
        return module.caroKann.lines;
    }""", injected)


def run():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    results = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            base = f'http://127.0.0.1:{server.server_port}'
            page.goto(base, wait_until='load')
            injected = f'{base}/src/openings/caro-kann.js'

            expect(page.locator('h1')).to_have_text('Caro-Kann Defense')
            expect(page.locator('#line-title')).not_to_be_empty()
            results.append('loads the Caro-Kann trainer')

            # The course map should expose every branch from the data model.
            line_count = len(get_course_lines(page, injected))
            expect(page.locator('.line-item')).to_have_count(line_count)
            results.append(f'renders all {line_count} course lines')

            # The first opponent move should autoplay and present Black's first decision.
            wait_for_last_move(page, 'e2e4')
            expect_decision_prompt(page)
            expect(page.locator('.piece[data-piece-square="e4"]')).to_have_count(1)
            expect(page.locator('.piece[data-piece-square="e2"]')).to_have_count(0)
            results.append('autoplays White and presents the Black decision')

            # Hint toggle controls target decoration without changing the position.
            expect(square(page, 'c6').locator('.hint-target-indicator')).to_have_count(1)
            page.locator('#hint-toggle').click()
            expect(square(page, 'c6').locator('.hint-target-indicator')).to_have_count(0)
            page.locator('#hint-toggle').click()
            expect(square(page, 'c6').locator('.hint-target-indicator')).to_have_count(1)
            results.append('toggles move hint decoration')

            # A wrong move should not advance and should explain the repertoire choice.
            click_move(page, 'g8f6')
            expect(page.locator('#feedback')).to_contain_text('not the move this line teaches')
            expect(page.locator('#feedback')).to_contain_text('c6')
            expect(page.locator('.piece[data-piece-square="g8"]')).to_have_count(1)
            expect(page.locator('.piece[data-piece-square="f6"]')).to_have_count(0)
            results.append('keeps wrong moves non-mutating and explains the target')

            # A correct move should advance, then White should autoplay.
            click_move(page, 'c7c6')
            expect(page.locator('.piece[data-piece-square="c6"]')).to_have_count(1)
            wait_for_last_move(page, 'd2d4')
            expect_decision_prompt(page)
            results.append('advances correct moves and autoplays White replies')

            # A valid move taught in another line should name the matching branch, not call it bad.
            page.locator('#reset-line').click()
            expect(page.locator('#prompt')).to_contain_text('c6')
            click_move(page, 'c7c6')
            wait_for_last_move(page, 'd2d4')
            click_move(page, 'd7d5')
            wait_for_last_move(page, 'e4e5')
            click_move(page, 'c8f5')
            wait_for_last_move(page, 'b1c3')
            click_move(page, 'e7e6')
            wait_for_last_move(page, 'g1f3')
            click_move(page, 'c6c5')
            expect(page.locator('#feedback')).to_contain_text('Advance — Immediate counterplay')
            expect(page.locator('#feedback')).to_contain_text('Advance — Main setup')
            expect(page.locator('#feedback')).to_contain_text('Bf5')
            expect(page.locator('#feedback')).not_to_contain_text('Why this is bad')
            expect(page.locator('.explanation-arrow')).to_have_count(0)
            expect(page.locator('#prompt')).to_contain_text('Bf5')
            results.append('routes valid moves from other repertoire branches to branch-specific feedback')

            # A tactically bad deviation should show the concrete punishment and draw it.
            page.locator('#reset-line').click()
            expect(page.locator('#prompt')).to_contain_text('c6')
            click_move(page, 'b7b5')
            expect(page.locator('#feedback')).to_contain_text('Why this is bad')
            expect(page.locator('#feedback')).to_contain_text('Bxb5')
            expect(page.locator('.explanation-arrow[data-from="f1"][data-to="b5"]')).to_have_count(1)
            expect(page.locator('#prompt')).to_contain_text('c6')
            page.locator('#reset-line').click()
            expect(page.locator('.explanation-arrow')).to_have_count(0)
            results.append('explains 1...b5 with Bxb5 and an f1-to-b5 teaching arrow')

            # Exercise drag-to-move, opponent highlight update, and history review.
            page.locator('#reset-line').click()
            expect(page.locator('#prompt')).to_contain_text('c6')
            drag_move(page, 'c7c6')
            expect(page.locator('.piece[data-piece-square="c6"]')).to_have_count(1)
            expect(page.locator('.piece[data-piece-square="c7"]')).to_have_count(0)
            wait_for_last_move(page, 'd2d4')
            expect_decision_prompt(page)
            assert is_highlighted(page, 'd2') and is_highlighted(page, 'd4')

            # ArrowLeft rewinds without mutating training state. Opponent-turn
            # history positions are interactive analysis projections; repertoire
            # turns retain the canonical replay behavior.
            page.keyboard.press('ArrowLeft')
            expect(page.locator('.chessboard')).not_to_have_class(re.compile(r'board-readonly'))
            expect(square(page, 'd2')).to_be_enabled()
            expect(square(page, 'd7')).to_be_enabled()
            expect(page.locator('.piece[data-piece-square="c6"]')).to_have_count(1)
            expect(page.locator('.piece[data-piece-square="d2"]')).to_have_count(1)
            assert is_highlighted(page, 'e2') and is_highlighted(page, 'e4')

            page.keyboard.press('ArrowLeft')
            expect(page.locator('.piece[data-piece-square="c7"]')).to_have_count(1)
            expect(page.locator('.piece[data-piece-square="e4"]')).to_have_count(1)
            page.keyboard.press('ArrowRight')
            page.keyboard.press('ArrowRight')
            expect(page.locator('.chessboard')).not_to_have_class(re.compile(r'board-readonly'))
            expect(square(page, 'd7')).to_be_enabled()
            expect(page.locator('.piece[data-piece-square="d4"]')).to_have_count(1)
            results.append('supports drag moves plus interactive analysis/replay history navigation')

            # Complete line 1 once, schedule it automatically, then prove browser persistence.
            page.locator('#reset-line').click()
            first_line = get_course_lines(page, injected)[0]
            line_count = len(get_course_lines(page, injected))
            for ply in range(1, len(first_line['moves']), 2):
                expect_decision_prompt(page)
                click_move(page, first_line['moves'][ply])
                if ply + 1 < len(first_line['moves']):
                    wait_for_last_move(page, first_line['moves'][ply + 1])
            expect_decision_prompt(page)
            expect(page.locator('#prompt')).not_to_contain_text('Complete')
            expect(page.locator('#feedback')).to_contain_text('clean rep')
            expect(page.locator('#grading')).to_be_hidden()
            results.append('completes a clean line with automatic scheduling')

            before_reload = page.evaluate("""() => JSON.parse(localStorage.getItem('openrep:caro-kann'))""")
            assert before_reload and before_reload['totalSessions'] >= 1
            page.reload(wait_until='load')
            after_reload = page.evaluate("""() => JSON.parse(localStorage.getItem('openrep:caro-kann'))""")
            assert after_reload and after_reload['totalSessions'] == before_reload['totalSessions']
            results.append('persists progress in localStorage')

            # Practice should expose only Spaced/Weak selection and no manual grading buttons.
            page.get_by_role('button', name=re.compile(r'^Practice')).click()
            expect(page.locator('#practice-options')).to_be_visible()
            expect(page.locator('[data-practice-selection="spaced"]')).to_have_count(1)
            expect(page.locator('[data-practice-selection="weak"]')).to_have_count(1)
            expect(page.locator('[data-grade]')).to_have_count(0)
            results.append('uses automatic practice scheduling without manual grading')

            # Switching back to Learn should preserve the branch map and normal lesson controls.
            page.get_by_role('button', name=re.compile(r'^Learn')).click()
            expect(page.locator('#practice-options')).to_be_hidden()
            expect(page.locator('.line-item')).to_have_count(line_count)
            results.append('switches cleanly between Learn and Practice')

            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    run()
