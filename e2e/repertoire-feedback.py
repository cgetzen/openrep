from __future__ import annotations

import functools
import http.server
import json
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def render_feedback(page, exact_titles: list[str], transposition_titles: list[str]):
    page.evaluate(
        """async ({exactTitles, transpositionTitles}) => {
          document.querySelector('#feedback-fixture')?.remove();
          const { CoachingTrainerApp } = await import('./src/coaching-trainer.js?v=move-quality-v1');
          const root = document.createElement('div');
          root.id = 'feedback-fixture';
          root.innerHTML = '<div id="feedback"></div>';
          document.body.append(root);
          const course = {
            id: 'feedback-fixture-course',
            side: 'b',
            lines: [{id: 'current', title: 'Current branch', moves: []}]
          };
          const app = new CoachingTrainerApp(root, course, {evaluator: null});
          app.line = course.lines[0];
          app.showRepertoireAlternativeFeedback({
            exactPathMatches: exactTitles.map((title, index) => ({line: {id: `exact-${index}`, title}})),
            transpositionMatches: transpositionTitles.map((title, index) => ({line: {id: `trans-${index}`, title}}))
          }, 'c5', 'Bf5');
        }""",
        {'exactTitles': exact_titles, 'transpositionTitles': transposition_titles}
    )


def render_quality_feedback(page):
    page.evaluate(
        """async () => {
          document.querySelector('#quality-feedback-fixture')?.remove();
          const { CoachingTrainerApp } = await import('./src/coaching-trainer.js?v=move-quality-v1');
          const root = document.createElement('div');
          root.id = 'quality-feedback-fixture';
          root.innerHTML = '<div id="feedback"></div>';
          document.body.append(root);
          const course = {
            id: 'quality-feedback-course',
            side: 'b',
            lines: [{id: 'current', title: 'Current branch', moves: []}]
          };
          const evaluator = {
            evaluateMove() {
              return Promise.resolve({
                before: {type: 'cp', value: -50},
                move: {type: 'cp', value: 75}
              });
            }
          };
          const app = new CoachingTrainerApp(root, course, {evaluator});
          app.showFeedback('Why this is inaccurate. Play c6.', 'wrong');
          app.refreshWrongMoveQuality('g8f6');
        }"""
    )


def run():
    results = []
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1200, "height": 800})
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load')
            expect(page.get_by_role('heading', name='Caro-Kann Defense')).to_be_visible()
            page.wait_for_function(
                "Array.from(document.styleSheets).some(sheet => sheet.href && sheet.href.includes('coach-overrides.css'))"
            )

            render_quality_feedback(page)
            quality_feedback = page.locator('#quality-feedback-fixture #feedback')
            expect(quality_feedback).to_contain_text('Mistake (-1.25)')
            expect(quality_feedback).to_contain_text('Why this is inaccurate. Play c6.')
            results.append('wrong-move feedback prepends move classification and mover-relative score loss')

            render_feedback(
                page,
                ['Immediate counterplay', 'Sharp counterplay', 'Positional counterplay'],
                []
            )
            feedback = page.locator('#feedback-fixture #feedback')
            expect(feedback).to_contain_text('Immediate counterplay')
            more = feedback.locator('.branch-more')
            expect(more).to_contain_text('and more')
            items = feedback.locator('.branch-more-tooltip-item')
            expect(items).to_have_count(2)
            expect(items.nth(0)).to_have_text('Sharp counterplay')
            expect(items.nth(1)).to_have_text('Positional counterplay')
            more.hover()
            expect(feedback.locator('.branch-more-tooltip')).to_be_visible()
            more.focus()
            expect(feedback.locator('.branch-more-tooltip')).to_be_visible()
            results.append('2+ exact matches show first branch plus hover/focus and-more tooltip')

            render_feedback(page, [], ['Fianchetto-first transposition'])
            feedback = page.locator('#feedback-fixture #feedback')
            expect(feedback).to_contain_text('repertoire move from this position')
            expect(feedback).not_to_contain_text('Fianchetto-first transposition')
            expect(feedback.locator('.branch-more')).to_have_count(0)
            results.append('transposition-only matches remain unnamed in feedback')

            browser.close()

        print(json.dumps({"passed": len(results), "checks": results}, indent=2))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
