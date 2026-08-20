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


def mount_fixture(page, fixture_id: str, mode: str, accepted_moves=None):
    if accepted_moves is None:
        accepted_moves = ['c7c5', 'e7e5']
    page.evaluate(
        """async ({fixtureId, mode, acceptedMoves}) => {
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
              },
              {
                anchor: {lineId: 'line', ply: 1},
                move: 'e7e5',
                rationale: 'Also challenges White’s center directly with a second accepted setup.'
              }
            ],
            lessonDecisions: [{
              id: 'terminal-center-choice',
              anchor: {lineId: 'line', ply: 1},
              objective: 'Challenge White’s center immediately.',
              acceptedMoves
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
        {'fixtureId': fixture_id, 'mode': mode, 'acceptedMoves': accepted_moves}
    )
    page.wait_for_function(
        "fixtureId => window[fixtureId]?.ply === 1 && window[fixtureId]?.chess.turn() === 'b'",
        arg=fixture_id
    )


def complete_move(page, fixture_id: str, from_square: str, to_square: str):
    page.evaluate(
        "([fixtureId, fromSquare, toSquare]) => window[fixtureId].onUserMove(fromSquare, toSquare)",
        [fixture_id, from_square, to_square]
    )
    page.wait_for_function(
        "fixtureId => window[fixtureId]?.lineFinished === true",
        arg=fixture_id
    )


def completion_contrast_ratios(page, fixture_id: str):
    return page.evaluate(
        """fixtureId => {
          const root = document.getElementById(fixtureId);
          const targets = {
            panel: '#completion-theory',
            objective: '.completion-theory-heading > strong',
            rationale: '.completion-theory-choice p',
            primary: '.completion-theory-badge.primary',
            accepted: '.completion-theory-badge.accepted',
            played: '.completion-theory-badge.played'
          };

          const rgba = value => {
            const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
            return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 1];
          };
          const channel = value => {
            const normalized = value / 255;
            return normalized <= 0.03928
              ? normalized / 12.92
              : Math.pow((normalized + 0.055) / 1.055, 2.4);
          };
          const luminance = rgb => (
            0.2126 * channel(rgb[0]) +
            0.7152 * channel(rgb[1]) +
            0.0722 * channel(rgb[2])
          );
          const effectiveBackground = element => {
            let current = element;
            while (current) {
              const background = rgba(getComputedStyle(current).backgroundColor);
              if (background[3] > 0) return background;
              current = current.parentElement;
            }
            return [17, 19, 15, 1];
          };
          const contrast = element => {
            const foreground = rgba(getComputedStyle(element).color);
            const background = effectiveBackground(element);
            const foregroundLuminance = luminance(foreground);
            const backgroundLuminance = luminance(background);
            const lighter = Math.max(foregroundLuminance, backgroundLuminance);
            const darker = Math.min(foregroundLuminance, backgroundLuminance);
            return (lighter + 0.05) / (darker + 0.05);
          };

          return Object.fromEntries(
            Object.entries(targets).map(([name, selector]) => [
              name,
              contrast(root.querySelector(selector))
            ])
          );
        }""",
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
            learn = page.locator('#learn-terminal-fixture')
            learn_panel = learn.locator('#completion-theory')
            expect(learn_panel).to_be_hidden()
            assert learn_panel.get_attribute('hidden') is not None
            checks.append('completion teaching occupies no visible box before the line is complete')

            complete_move(page, 'learn-terminal-fixture', 'c7', 'c5')
            expect(learn_panel).to_be_visible()
            expect(learn_panel).to_contain_text('What to remember')
            expect(learn_panel).to_contain_text('Challenge White’s center immediately.')
            expect(learn_panel).to_contain_text('d5')
            expect(learn_panel).to_contain_text('Primary')
            expect(learn_panel).to_contain_text('c5')
            expect(learn_panel).to_contain_text('e5')
            expect(learn_panel.locator('.completion-theory-choice.accepted')).to_have_count(2)
            expect(learn_panel).to_contain_text('Also works')
            accepted_row = learn_panel.locator('.completion-theory-choice.accepted').filter(has_text='c5')
            expect(accepted_row).to_contain_text('You played')
            expect(learn_panel.locator('.completion-theory-badge.played')).to_have_count(1)
            expect(learn.locator('#feedback')).to_contain_text('Line complete — clean rep.')
            assert page.evaluate("window['learn-terminal-fixture'].mistakesThisLine") == 0
            checks.append('accepted terminal move completes cleanly and explains primary plus multiple accepted choices')

            ratios = completion_contrast_ratios(page, 'learn-terminal-fixture')
            assert all(value >= 4.5 for value in ratios.values()), ratios
            checks.append('completion panel text and badges meet at least 4.5:1 contrast')

            mount_fixture(page, 'exact-terminal-fixture', 'learn', accepted_moves=[])
            exact = page.locator('#exact-terminal-fixture')
            exact_panel = exact.locator('#completion-theory')
            expect(exact_panel).to_be_hidden()
            complete_move(page, 'exact-terminal-fixture', 'd7', 'd5')
            expect(exact_panel).to_be_visible()
            expect(exact_panel).to_contain_text('What to remember')
            expect(exact_panel).to_contain_text('d5')
            expect(exact_panel).to_contain_text('Primary')
            expect(exact_panel.locator('.completion-theory-choice.accepted')).to_have_count(0)
            expect(exact_panel).not_to_contain_text('Also works')
            checks.append('completion takeaway renders for an exact-only line with zero accepted alternatives')

            mount_fixture(page, 'practice-terminal-fixture', 'practice')
            complete_move(page, 'practice-terminal-fixture', 'c7', 'c5')
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
