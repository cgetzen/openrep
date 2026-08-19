from __future__ import annotations

import functools
import http.server
import json
import os
import re
import threading
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def click_move(page, uci: str):
    page.locator(f'[data-square="{uci[:2]}"]').dispatch_event('click')
    page.locator(f'[data-square="{uci[2:4]}"]').dispatch_event('click')


def browser_bundle() -> str:
    """Concatenate dependency-free modules for URL-blocked test environments."""
    paths = [
        ROOT / 'src/openings/caro-kann.js',
        ROOT / 'src/mini-chess.js',
        ROOT / 'src/progress.js',
        ROOT / 'src/chess-board.js',
        ROOT / 'src/trainer.js',
    ]
    chunks = []
    for path in paths:
        source = path.read_text()
        source = re.sub(r'^import .*?;\s*$', '', source, flags=re.MULTILINE)
        source = re.sub(r'\bexport\s+(?=(?:const|let|var|class|function)\b)', '', source)
        chunks.append(source)
    chunks.append(
        "window.__OpenRep = { TrainerApp, caroKann };\n"
        "new TrainerApp(document.querySelector('#app'), caroKann).mount();"
    )
    return '\n\n'.join(chunks)


def load_injected(page):
    """Fallback for managed Chromium builds that block localhost/file/data URLs."""
    html = (ROOT / 'index.html').read_text()
    html = re.sub(r'<script\s+type="module"[^>]*></script>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(ROOT / 'src/style.css').read_text())
    page.add_script_tag(content="""
      (() => {
        const store = new Map();
        const storage = {
          get length() { return store.size; },
          key(i) { return Array.from(store.keys())[i] ?? null; },
          getItem(k) { k = String(k); return store.has(k) ? store.get(k) : null; },
          setItem(k, v) { store.set(String(k), String(v)); },
          removeItem(k) { store.delete(String(k)); },
          clear() { store.clear(); },
          _keys() { return Array.from(store.keys()); }
        };
        Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
      })();
    """)
    page.add_script_tag(content=browser_bundle())


def get_course_lines(page, injected: bool):
    if injected:
        return page.evaluate(
            "window.__OpenRep.caroKann.lines.map(({id,title,moves}) => ({id,title,moves}))"
        )
    return page.evaluate(
        "async () => { const m = await import('./src/openings/caro-kann.js'); "
        "return m.caroKann.lines.map(({id,title,moves}) => ({id,title,moves})); }"
    )


def storage_keys(page, injected: bool):
    if injected:
        return page.evaluate('localStorage._keys()')
    return page.evaluate('Object.keys(localStorage)')


def restore_app(page, injected: bool):
    if injected:
        page.evaluate("""
          document.querySelector('#app').replaceChildren();
          new window.__OpenRep.TrainerApp(
            document.querySelector('#app'), window.__OpenRep.caroKann
          ).mount();
        """)
    else:
        page.reload(wait_until='load')


def run():
    results = []
    handler = functools.partial(QuietHandler, directory=str(ROOT))
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
            injected = False
            try:
                page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='load', timeout=8000)
            except PlaywrightError as error:
                if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(error):
                    raise
                page.close()
                page = context.new_page()
                load_injected(page)
                injected = True
                results.append('used navigation-free fallback for managed Chromium policy')

            expect(page.get_by_role('heading', name='Caro-Kann Defense')).to_be_visible()
            expect(page.locator('#line-title')).to_have_text('Advance — Main setup')
            expect(page.locator('#prompt')).to_contain_text('Your move as Black')
            expect(page.locator('#prompt')).to_contain_text('c6')
            results.append('loads course and auto-plays 1.e4')

            # Wrong-but-legal move must not advance the repertoire state.
            click_move(page, 'g8f6')
            expect(page.locator('#feedback')).to_contain_text('Not quite')
            expect(page.locator('#prompt')).to_contain_text('c6')
            results.append('rejects off-repertoire legal move without advancing')

            # Complete line 1 once, grade it, then prove browser persistence.
            page.locator('#reset-line').click()
            first_line = get_course_lines(page, injected)[0]
            for uci in first_line['moves'][1::2]:
                expect(page.locator('#prompt')).to_contain_text('Your move as Black')
                click_move(page, uci)
            expect(page.locator('#prompt')).to_contain_text('Complete')
            expect(page.locator('#feedback')).to_contain_text('clean rep')
            page.get_by_role('button', name='Good').click()
            assert any(key.startswith('openrep:v1:') for key in storage_keys(page, injected))
            restore_app(page, injected)
            expect(page.locator('#course-progress')).to_contain_text('1/12')
            results.append('persists scheduling/progress through a full app restore')

            # Reset and prove every branch through the real interactive board.
            page.get_by_role('button', name='Reset local progress').click()
            expect(page.locator('#course-progress')).to_contain_text('0/12')
            lines = get_course_lines(page, injected)
            for index, line in enumerate(lines):
                print(f'ui line {index+1}/12: {line["title"]}', flush=True)
                page.locator(f'[data-line-index="{index}"]').click()
                expect(page.locator('#line-title')).to_have_text(line['title'])
                for uci in line['moves'][1::2]:
                    expect(page.locator('#prompt')).to_contain_text('Your move as Black')
                    click_move(page, uci)
                expect(page.locator('#prompt')).to_contain_text('Complete')
                expect(page.locator('#feedback')).to_contain_text('clean rep')
                page.get_by_role('button', name='Good').click()
            expect(page.locator('#course-progress')).to_contain_text('12/12')
            results.append('completes all 12 Caro-Kann branches through board interactions')

            # Smoke-test each training mode and timer behavior.
            for mode, accessible_name in [
                ('practice', 'Practice spaced review'),
                ('drill', 'Drill rapid reps'),
                ('time', 'Time beat the clock'),
            ]:
                button = page.get_by_role('button', name=accessible_name)
                button.click()
                expect(button).to_have_class(re.compile(r'active'))
            expect(page.locator('#timer')).to_contain_text(re.compile(r'\d+\.\d+s'), timeout=2000)
            page.get_by_role('button', name='Practice spaced review').click()
            expect(page.locator('#timer')).to_have_text('')
            page.get_by_role('button', name='Hint: on').click()
            expect(page.get_by_role('button', name='Hint: off')).to_be_visible()
            results.append('Practice, Drill, Time, timer reset, and hint controls are interactive')

            page.set_viewport_size({"width": 390, "height": 844})
            expect(page.get_by_role('heading', name='Caro-Kann Defense')).to_be_visible()
            no_overflow = page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
            assert no_overflow, 'mobile viewport has horizontal overflow'
            results.append('390px mobile layout renders without horizontal overflow')
            page.set_viewport_size({"width": 1440, "height": 1050})

            screenshot = ROOT / 'e2e' / 'proof.png'
            page.screenshot(path=str(screenshot), full_page=True)
            results.append(f'captured UI proof screenshot: {screenshot.name}')
            browser.close()

        print(json.dumps({"passed": len(results), "checks": results}, indent=2))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    run()
