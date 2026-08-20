from __future__ import annotations

import functools
import http.server
import threading

from playwright.sync_api import expect, sync_playwright

from run import ROOT, QuietHandler


def run():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread = thread
    thread.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load')

            fixture = page.evaluate("""
              async () => {
                const { OpenRepTrainerApp } = await import('./src/practice-trainer.js?v=practice-branch-identity-v1');
                const root = document.querySelector('#app');
                root.replaceChildren();
                const course = {
                  id: `practice-branch-identity-${Date.now()}`,
                  name: 'Practice identity fixture',
                  tagline: 'Fixture',
                  side: 'b',
                  responses: [],
                  lines: [
                    {
                      id: 'move-order-a',
                      title: 'Knight move-order A',
                      variation: '1.Nf3 Nf6 2.g3 Nc6 3.Bg2',
                      summary: 'Keep the A move order.',
                      moves: ['g1f3', 'g8f6', 'g2g3', 'b8c6', 'f1g2', 'e7e6'],
                      notes: {}
                    },
                    {
                      id: 'move-order-b',
                      title: 'Knight move-order B',
                      variation: '1.Nf3 Nc6 2.g3 Nf6 3.b3',
                      summary: 'Keep the B move order.',
                      moves: ['g1f3', 'b8c6', 'g2g3', 'g8f6', 'b2b3', 'e7e6'],
                      notes: {}
                    }
                  ]
                };
                const app = new OpenRepTrainerApp(root, course, { random: () => 0, evaluator: null });
                app.mount();
                app.progress.discovered = ['move-order-b'];
                app.pickPracticeLineIndex = () => 0;
                const candidate = app.repertoire.pickPracticeRoute(course.lines[0], app.progress, () => 0);
                window.__practiceBranchIdentityApp = app;
                return {
                  candidateKind: candidate.kind,
                  candidateTitle: candidate.label,
                  candidateMoves: candidate.moves,
                  targetMoves: course.lines[1].moves
                };
              }
            """)

            assert fixture['candidateKind'] == 'branch'
            assert fixture['candidateTitle'] == 'Knight move-order B'
            assert fixture['candidateMoves'] != fixture['targetMoves']

            page.get_by_role('button', name='Practice test your recall').click()
            page.get_by_role('button', name='Weak focus weakest lines').click()

            expect(page.locator('#line-title')).to_have_text('Knight move-order A')
            expect(page.locator('#line-variation')).to_have_text('1.Nf3 Nf6 2.g3 Nc6 3.Bg2')
            assert page.evaluate('window.__practiceBranchIdentityApp.sessionRoute.id') == 'canonical:move-order-a'

            browser.close()
            print('practice branch identity regression passed')
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)


if __name__ == '__main__':
    run()
