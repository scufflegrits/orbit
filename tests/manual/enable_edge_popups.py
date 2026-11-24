"""Toggle pop-ups in the isolated visible Edge test profile on port 9334."""

from playwright.sync_api import expect, sync_playwright

read_controls = """element => {
  const all = [];
  const visit = node => {
    if (node instanceof HTMLElement) {
      all.push([node.localName, node.getAttribute('aria-checked'), node.checked, node.getAttribute('role')]);
    }
    if (node.shadowRoot) visit(node.shadowRoot);
    for (const child of node.children) visit(child);
  };
  visit(element);
  return all;
}"""
with sync_playwright() as playwright:
    browser = playwright.chromium.connect_over_cdp("http://127.0.0.1:9334")
    context = next((context for context in browser.contexts if any(
        page.url.startswith("file:///C:/orbit-visible-test/index.html") for page in context.pages
    )), None)
    if context is None:
        raise SystemExit("Open the Orbit fixture in the disposable Edge test profile first.")
    settings = context.new_page()
    settings.goto("edge://settings/content/popups", wait_until="domcontentloaded")
    settings.get_by_text("Blocked (recommended)", exact=True).wait_for()
    toggle = settings.locator("settings-toggle-button")
    expect(toggle).to_have_count(1, timeout=4000)
    print("Before click:", toggle.evaluate(read_controls), flush=True)
    inner = toggle.locator('button:visible, input:visible, [role="switch"]:visible').last
    if inner.count() == 1:
        inner.click(timeout=4000)
    else:
        toggle.click(timeout=4000)
    settings.wait_for_timeout(600)
    print("After click:", toggle.evaluate(read_controls), flush=True)
