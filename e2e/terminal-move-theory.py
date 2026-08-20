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


def mount_fixture(page, fixture_id: str, mode: str):
    page.evaluate(
        """async ({fixtureId, mode}) => {
          document.querySelector(`#${fixtureId}`)?.remove();
          const { CoachingTrainerApp } = await import('./src/coaching-trainer.js?v=terminal-theory-v1');
          const root = document.createElement('div');
          root.id = fixtureId;
          document.body.append(root);
          const course = {
            id: `terminal-theory-${mode}-${Date.now()}`,
            name: 'Terminal theory fixture',
            tagline: 'Fixture',
            side: 'b',
            responses: [],
            lines: [{
              id: 'line',
              title: 'Center choice',
              variation: '1.e4 d5',
              summary: 'Challenge the center.',
              moves: ['e2e4', 'd7d5'],
              notes: {}
            }],
            moveTheory: [
              {
                anchor: {lineId: 'line', ply: 1},
                move: 'd7d5',
                rationale: 'Immediately challenges the e4 pawn with the repertoire choice.'
              },
              {
                anchor: {lineId: 'line', ply: 1},
                move: 'c7c5',
                rationale: 'Also challenges White’s center with a sound flank pawn break.'
              }
            ],
            lessonDecisions: [{
              id: 'terminal-center-choice',
              anchor: {lineId: 'line', ply: 1},
              objective: 'Challenge White’s center immediately.',
              acceptedMoves: ['c7c5']
            }]
          };
          const app = new CoachingTrainerApp(root, course, {evaluator: null});
          app.mount();
          if (mode === 'practice') {
            app.mode = 'practice';
            app.beginRoute(app.repertoire.canonicalRoute(app.line), 0);
          }
          window[fixtureId] = app;
        }""",
        {'fixtureId': fixture_id, 'mode': mode}
    )
    page.wait_for_function(
        "fixtureId => window[fixtureId]?.ply === 1 && window[fixtureId]?.chess.turn() === 'b'",
        fixture_id
    )


def complete_accepted_move(page, fixture_id: str):
    page.evaluate(
        "fixtureId => window[fixtureId].onUserMove('c7', 'c5')",
        fixture_id
    )
    page.wait_for_function(
        "fixtureId => window[fixtureId]?.lineFinished === true",
        fixture_id
    )


def run():
    checks = []
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1400, "height": 1000})
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load')

            mount_fixture(page, 'learn-terminal-fixture', 'learn')
            complete_accepted_move(page, 'learn-terminal-fixture')
            learn = page.locator('#learn-terminal-fixture')
            learn_panel = learn.locator('#completion-theory')
            expect(learn_panel).to_be_visible()
            expect(learn_panel).to_contain_text('What to remember')
            expect(learn_panel).to_contain_text('Challenge White’s center immediately.')
            expect(learn_panel).to_contain_text('d5')
            expect(learn_panel).to_contain_text('Primary')
            expect(learn_panel).to_contain_text('c5')
            expect(learn_panel).to_contain_text('Also works')
            accepted_row = learn_panel.locator('.completion-theory-choice.accepted')
            expect(accepted_row).to_contain_text('You played')
            expect(learn.locator('#feedback')).to_contain_text('Line complete — clean rep.')
            assert page.evaluate("window['learn-terminal-fixture'].mistakesThisLine") == 0
            checks.append('accepted terminal move completes cleanly and explains primary plus accepted choices')

            mount_fixture(page, 'practice-terminal-fixture', 'practice')
            complete_accepted_move(page, 'practice-terminal-fixture')
            practice = page.locator('#practice-terminal-fixture')
            practice_panel = practice.locator('#completion-theory')
            expect(practice_panel).to_be_visible()
            assert learn_panel.inner_text() == practice_panel.inner_text()
            assert page.evaluate("window['practice-terminal-fixture'].mistakesThisLine") == 0
            checks.append('Learn and Practice render identical terminal teaching content')

            browser.close()

        print(json.dumps({"passed": len(checks), "checks": checks}, indent=2))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
