import assert from "node:assert/strict";

const origin = process.argv[2];
if (!origin)
  throw Error("Usage: node scripts/verify-hosting.mjs <frontend-url>");
const page = await fetch(origin);
assert.equal(page.status, 200, "The hosted HTML must return 200");
const html = await page.text();
assert.match(html, /id="root"/, "React mount point is present");
const assets = [...html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)].map(
  (match) => match[1],
);
assert.ok(
  assets.some((asset) => asset.endsWith(".js")),
  "An application script must be referenced",
);
assert.ok(
  assets.some((asset) => asset.endsWith(".css")),
  "An application stylesheet must be referenced",
);
for (const asset of assets) {
  const url = new URL(asset, origin);
  const response = await fetch(url);
  assert.equal(response.status, 200, `Hosted asset ${asset} must return 200`);
  assert.match(
    response.headers.get("content-type") || "",
    asset.endsWith(".js") ? /javascript/ : /text\/css/,
    `Correct MIME type for ${asset}`,
  );
  const content = await response.text();
  assert.ok(
    content.length > 0 && !content.trimStart().startsWith("<!doctype"),
    `Asset ${asset} must contain its build content`,
  );
  console.log(`PASS: ${asset} (${content.length} characters)`);
}
console.log(
  "Hosted HTML and all referenced JavaScript/CSS assets are accessible.",
);
