import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

// ── fs + yaml mocks (hoisted before imports) ────────────────────────────────
const mockFs = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("fs", () => ({
  readFileSync: mockFs.readFileSync,
  writeFileSync: mockFs.writeFileSync,
}));

vi.mock("utils/logger", () => ({
  default: () => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

import handler from "pages/api/services/manage";

// ── helpers ─────────────────────────────────────────────────────────────────
/** Build a services.yaml-shaped array from a simple map: { Category: [svcName, ...] } */
function makeGroups(map) {
  return Object.entries(map).map(([cat, svcs]) => ({
    [cat]: svcs.map((name) => ({ [name]: { href: "#", description: "", icon: "" } })),
  }));
}

function yamlContent(groups) {
  // The handler uses yaml.load(readFileSync(…)), so return a yaml string
  // We just use JSON here – js-yaml parses it fine since JSON is valid YAML.
  return JSON.stringify(groups);
}

// ── tests ───────────────────────────────────────────────────────────────────
describe("pages/api/services/manage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET ─────────────────────────────────────────────────────────────────
  describe("GET — list categories", () => {
    it("returns category names from services.yaml", () => {
      const groups = makeGroups({ Infra: ["GitLab"], Media: ["Plex"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const res = createMockRes();
      handler({ method: "GET" }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ categories: ["Infra", "Media"] });
    });

    it("returns empty array when file is missing", () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const res = createMockRes();
      handler({ method: "GET" }, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ categories: [] });
    });
  });

  // ── POST ────────────────────────────────────────────────────────────────
  describe("POST — add service", () => {
    it("adds a service to an existing category", () => {
      const groups = makeGroups({ Infra: ["GitLab"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "POST",
        body: { category: "Infra", name: "Nexus", href: "http://nexus", description: "Artifacts", icon: "nexus" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ ok: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it("creates a new category if it does not exist", () => {
      mockFs.readFileSync.mockReturnValue("[]");

      const req = {
        method: "POST",
        body: { category: "New", name: "Service1" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(201);
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it("returns 400 when category or name is missing", () => {
      const res1 = createMockRes();
      handler({ method: "POST", body: { name: "x" } }, res1);
      expect(res1.statusCode).toBe(400);

      const res2 = createMockRes();
      handler({ method: "POST", body: { category: "x" } }, res2);
      expect(res2.statusCode).toBe(400);
    });

    it("returns 409 when service already exists", () => {
      const groups = makeGroups({ Infra: ["GitLab"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "POST",
        body: { category: "Infra", name: "GitLab" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toContain("already exists");
    });

    it("uses defaults for optional fields", () => {
      mockFs.readFileSync.mockReturnValue("[]");

      const req = {
        method: "POST",
        body: { category: "Cat", name: "Svc" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(201);
      // Verify the written YAML contains default values
      const writtenYaml = mockFs.writeFileSync.mock.calls[0][1];
      expect(writtenYaml).toContain("href: '#'");
    });
  });

  // ── PUT ─────────────────────────────────────────────────────────────────
  describe("PUT — edit service", () => {
    it("edits a service in the same category", () => {
      const groups = makeGroups({ Infra: ["GitLab"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "PUT",
        body: {
          originalName: "GitLab",
          originalCategory: "Infra",
          name: "GitLab CE",
          href: "http://gitlab.example",
          description: "Updated",
          icon: "gitlab",
        },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it("moves a service to a different category", () => {
      const groups = makeGroups({ Infra: ["GitLab", "Nexus"], Media: ["Plex"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "PUT",
        body: {
          originalName: "Nexus",
          originalCategory: "Infra",
          name: "Nexus",
          category: "Media",
          href: "#",
          description: "",
          icon: "",
        },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it("creates a new target category if it does not exist", () => {
      const groups = makeGroups({ Infra: ["GitLab"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "PUT",
        body: {
          originalName: "GitLab",
          originalCategory: "Infra",
          name: "GitLab",
          category: "DevOps",
          href: "#",
        },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(200);
    });

    it("cleans up empty source category after move", () => {
      const groups = makeGroups({ Solo: ["OnlyService"], Other: ["Plex"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "PUT",
        body: {
          originalName: "OnlyService",
          originalCategory: "Solo",
          name: "OnlyService",
          category: "Other",
          href: "#",
        },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(200);
      // The written output should not contain the empty "Solo" category
      const writtenYaml = mockFs.writeFileSync.mock.calls[0][1];
      expect(writtenYaml).not.toContain("Solo");
    });

    it("returns 400 when originalName or originalCategory is missing", () => {
      const res1 = createMockRes();
      handler({ method: "PUT", body: { originalCategory: "x" } }, res1);
      expect(res1.statusCode).toBe(400);

      const res2 = createMockRes();
      handler({ method: "PUT", body: { originalName: "x" } }, res2);
      expect(res2.statusCode).toBe(400);
    });

    it("returns 404 when source category not found", () => {
      mockFs.readFileSync.mockReturnValue("[]");

      const req = {
        method: "PUT",
        body: { originalName: "Ghost", originalCategory: "Missing" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain("category not found");
    });

    it("returns 404 when service not found in category", () => {
      const groups = makeGroups({ Infra: ["GitLab"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "PUT",
        body: { originalName: "Ghost", originalCategory: "Infra" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain("Service not found");
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────────────
  describe("DELETE — remove service", () => {
    it("deletes a service and writes updated file", () => {
      const groups = makeGroups({ Infra: ["GitLab", "Nexus"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "DELETE",
        body: { name: "GitLab", category: "Infra" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it("removes empty category after last service deleted", () => {
      const groups = makeGroups({ Solo: ["OnlyOne"], Other: ["Plex"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "DELETE",
        body: { name: "OnlyOne", category: "Solo" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(200);
      const writtenYaml = mockFs.writeFileSync.mock.calls[0][1];
      expect(writtenYaml).not.toContain("Solo");
    });

    it("returns 400 when name or category is missing", () => {
      const res1 = createMockRes();
      handler({ method: "DELETE", body: { category: "x" } }, res1);
      expect(res1.statusCode).toBe(400);

      const res2 = createMockRes();
      handler({ method: "DELETE", body: { name: "x" } }, res2);
      expect(res2.statusCode).toBe(400);
    });

    it("returns 404 when category not found", () => {
      mockFs.readFileSync.mockReturnValue("[]");

      const req = {
        method: "DELETE",
        body: { name: "x", category: "Ghost" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain("Category not found");
    });

    it("returns 404 when service not found in category", () => {
      const groups = makeGroups({ Infra: ["GitLab"] });
      mockFs.readFileSync.mockReturnValue(yamlContent(groups));

      const req = {
        method: "DELETE",
        body: { name: "Ghost", category: "Infra" },
      };
      const res = createMockRes();
      handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain("Service not found");
    });
  });

  // ── Method not allowed ──────────────────────────────────────────────────
  it("returns 405 for unsupported HTTP methods", () => {
    const res = createMockRes();
    handler({ method: "PATCH", body: {} }, res);

    expect(res.statusCode).toBe(405);
    expect(res.body.error).toContain("Method not allowed");
  });
});
