const { describe, it } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const rootDir = path.join(__dirname, "..")
const vercelJsonPath = path.join(rootDir, "vercel.json")
const robotsTxtPath = path.join(rootDir, "public/robots.txt")
const faviconIcoPath = path.join(rootDir, "public/favicon.ico")

describe("vercel.json routing configuration", () => {
  it("rewrites root path to api/index without catch-all wildcard", () => {
    const config = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"))
    assert.ok(Array.isArray(config.rewrites), "rewrites should be an array")
    assert.deepEqual(config.rewrites, [{ source: "/", destination: "api/index" }])
  })

  it("does not contain catch-all rewrites that hijack static assets or scanner paths", () => {
    const config = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"))
    for (const rule of config.rewrites) {
      assert.notEqual(rule.source, "/(.*)", "must not use /(.*) catch-all rewrite")
      assert.doesNotMatch(rule.source, /\(.*\)/, "must not use wildcard capture groups in rewrites")
    }
  })
})

describe("public static assets", () => {
  it("provides a static robots.txt disallowing crawlers from invoking functions", () => {
    assert.ok(fs.existsSync(robotsTxtPath), "public/robots.txt must exist")
    const robotsContent = fs.readFileSync(robotsTxtPath, "utf8")
    assert.match(robotsContent, /User-agent:\s*\*/i)
    assert.match(robotsContent, /Disallow:\s*\//i)
  })

  it("provides a static favicon.ico", () => {
    assert.ok(fs.existsSync(faviconIcoPath), "public/favicon.ico must exist")
    const stats = fs.statSync(faviconIcoPath)
    assert.ok(stats.size > 0, "public/favicon.ico must not be empty")
  })
})
