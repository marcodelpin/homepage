import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

// ── global fetch mock (hoisted) ─────────────────────────────────────────────
const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

// ── import handler (dynamic so cache resets per test) ───────────────────────
// The module caches icon results in-memory, so we re-import to get a clean
// module state per describe block.  For per-test isolation we manipulate
// the cache TTL via Date.now() instead.

let handler;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset module to clear in-memory cache between test groups
  vi.resetModules();
  const mod = await import("pages/api/services/icons");
  handler = mod.default;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── helpers ─────────────────────────────────────────────────────────────────
function mockGitHubTree(repo, branch, subdir, sha, files) {
  // First call: get root tree to find subdir SHA
  // Second call: get subdir tree to list files
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [{ path: subdir, type: "tree", sha }],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: files.map((f) => ({ path: f, type: "blob" })),
      }),
    });
}

function makeReq(query = {}) {
  return { query };
}

// ── tests ───────────────────────────────────────────────────────────────────
describe("pages/api/services/icons", () => {
  describe("source validation", () => {
    it("returns 400 for unknown source", async () => {
      const res = createMockRes();
      await handler(makeReq({ source: "bogus" }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Unknown source "bogus"');
      expect(res.body.error).toContain("dashboard");
      expect(res.body.error).toContain("selfhst");
      expect(res.body.error).toContain("mdi");
    });
  });

  describe("dashboard source", () => {
    it("fetches icons from GitHub Tree API and returns them", async () => {
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "abc123", [
        "gitlab.png",
        "nexus.png",
        "grafana.png",
      ]);

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard", limit: "10" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.icons).toHaveLength(3);
      expect(res.body.icons[0]).toEqual({
        name: "gitlab",
        value: "gitlab",
        preview: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main/png/gitlab.png",
      });
    });

    it("defaults to dashboard source when none specified", async () => {
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha1", ["test.png"]);

      const res = createMockRes();
      await handler(makeReq({}), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons[0].value).toBe("test");
    });
  });

  describe("selfhst source", () => {
    it("prefixes values with sh- and uses svg subdir (not svg/color)", async () => {
      // After fix 4f94886: selfhst icons moved from svg/color to svg
      mockGitHubTree("selfhst/icons", "main", "svg", "sha2", ["grafana.svg"]);

      const res = createMockRes();
      await handler(makeReq({ source: "selfhst" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons[0]).toEqual({
        name: "grafana",
        value: "sh-grafana",
        preview: "https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/grafana.svg",
      });
    });
  });

  describe("mdi source", () => {
    it("prefixes values with mdi-", async () => {
      mockGitHubTree("Templarian/MaterialDesign-SVG", "master", "svg", "sha3", ["server.svg"]);

      const res = createMockRes();
      await handler(makeReq({ source: "mdi" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons[0]).toEqual({
        name: "server",
        value: "mdi-server",
        preview: "https://cdn.jsdelivr.net/gh/Templarian/MaterialDesign-SVG@master/svg/server.svg",
      });
    });
  });

  describe("search filtering", () => {
    it("filters icons by search query (case-insensitive)", async () => {
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha4", [
        "gitlab.png",
        "grafana.png",
        "nexus.png",
        "gitea.png",
      ]);

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard", search: "git" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons).toHaveLength(2);
      expect(res.body.icons.map((i) => i.name)).toEqual(["gitlab", "gitea"]);
      // total reflects the filtered count
      expect(res.body.total).toBe(2);
    });

    it("returns empty array when search matches nothing", async () => {
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha5", ["gitlab.png"]);

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard", search: "zzz_no_match" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  describe("limit / pagination", () => {
    it("limits results to the requested count", async () => {
      const files = Array.from({ length: 10 }, (_, i) => `icon-${i}.png`);
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha6", files);

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard", limit: "3" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons).toHaveLength(3);
      expect(res.body.total).toBe(10);
    });

    it("defaults to 50 when limit is not specified", async () => {
      const files = Array.from({ length: 60 }, (_, i) => `icon-${i}.png`);
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha7", files);

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons).toHaveLength(50);
      expect(res.body.total).toBe(60);
    });

    it("caps limit at 200", async () => {
      const files = Array.from({ length: 250 }, (_, i) => `icon-${i}.png`);
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha8", files);

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard", limit: "999" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons).toHaveLength(200);
    });

    it("falls back to 50 when limit is not a valid number", async () => {
      const files = Array.from({ length: 60 }, (_, i) => `icon-${i}.png`);
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha9", files);

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard", limit: "abc" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons).toHaveLength(50);
    });
  });

  describe("GitHub API errors", () => {
    it("returns 500 when root tree fetch fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard" }), res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toContain("GitHub API error");
    });

    it("returns 500 when subdir is not found in tree", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: [{ path: "other", type: "tree", sha: "x" }] }),
      });

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard" }), res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toContain("Subdir");
    });

    it("returns 500 when file tree fetch fails", async () => {
      // Root tree succeeds, file tree fails
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tree: [{ path: "png", type: "tree", sha: "abc" }] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard" }), res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toContain("GitHub API error");
    });
  });

  describe("caching", () => {
    it("uses cached results on second call without re-fetching", async () => {
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha10", ["cached.png"]);

      const res1 = createMockRes();
      await handler(makeReq({ source: "dashboard" }), res1);
      expect(res1.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2); // root tree + file tree

      // Second call — should use cache
      const res2 = createMockRes();
      await handler(makeReq({ source: "dashboard" }), res2);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.icons[0].name).toBe("cached");
      // No additional fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("file filtering", () => {
    it("only includes files with the correct extension", async () => {
      mockGitHubTree("homarr-labs/dashboard-icons", "main", "png", "sha11", [
        "good.png",
        "readme.md",
        "other.svg",
        "also-good.png",
      ]);

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons.map((i) => i.name)).toEqual(["good", "also-good"]);
    });

    it("skips non-blob entries (subdirectories)", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tree: [{ path: "png", type: "tree", sha: "sha12" }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tree: [
              { path: "icon.png", type: "blob" },
              { path: "subdir", type: "tree" },
              { path: "other.png", type: "blob" },
            ],
          }),
        });

      const res = createMockRes();
      await handler(makeReq({ source: "dashboard" }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.icons).toHaveLength(2);
    });
  });
});
