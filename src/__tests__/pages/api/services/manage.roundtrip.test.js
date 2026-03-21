/**
 * Round-trip integration tests for the services/manage API.
 *
 * Unlike manage.test.js (which mocks fs), these tests use a real temp file
 * and verify the YAML content after each CRUD operation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import yaml from "js-yaml";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

// ── Set up a real temp config dir (must be set before handler import) ─────
const TEMP_DIR = join(tmpdir(), `homepage-manage-test-${Date.now()}`);
process.env.HOMEPAGE_CONFIG_DIR = TEMP_DIR;

// Suppress logger output
vi.mock("utils/logger", () => ({
  default: () => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

// Dynamic import so HOMEPAGE_CONFIG_DIR is read after process.env is set
let handler;
beforeAll(async () => {
  mkdirSync(TEMP_DIR, { recursive: true });
  const mod = await import("pages/api/services/manage");
  handler = mod.default;
});

// ── helpers ────────────────────────────────────────────────────────────────

function readYaml() {
  const content = readFileSync(join(TEMP_DIR, "services.yaml"), "utf8");
  return yaml.load(content) || [];
}

function getCategories(groups) {
  return groups.map((g) => Object.keys(g)[0]);
}

function getServicesInCategory(groups, category) {
  const group = groups.find((g) => Object.keys(g)[0] === category);
  if (!group) return [];
  return (group[category] || []).map((s) => Object.keys(s)[0]);
}

function getServiceData(groups, category, name) {
  const group = groups.find((g) => Object.keys(g)[0] === category);
  if (!group) return null;
  const svc = (group[category] || []).find((s) => Object.keys(s)[0] === name);
  return svc ? svc[name] : null;
}

function call(method, body = {}) {
  const res = createMockRes();
  handler({ method, body }, res);
  return res;
}

// ── setup / teardown ───────────────────────────────────────────────────────

// beforeAll is in the dynamic import block above

afterAll(() => {
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }
});

beforeEach(() => {
  // Start each test with an empty services.yaml
  writeFileSync(join(TEMP_DIR, "services.yaml"), yaml.dump([]), "utf8");
});

// ── tests ──────────────────────────────────────────────────────────────────

describe("services/manage — round-trip YAML lifecycle", () => {
  it("POST creates a service and GET confirms it", () => {
    const res1 = call("POST", {
      category: "Infrastructure",
      name: "GitLab",
      href: "http://gitlab.mdp",
      description: "Code hosting",
      icon: "gitlab.png",
    });
    expect(res1.statusCode).toBe(201);

    // Verify GET returns the category
    const res2 = call("GET");
    expect(res2.statusCode).toBe(200);
    expect(res2.body.categories).toContain("Infrastructure");

    // Verify YAML file content
    const groups = readYaml();
    expect(getServicesInCategory(groups, "Infrastructure")).toContain("GitLab");

    const data = getServiceData(groups, "Infrastructure", "GitLab");
    expect(data.href).toBe("http://gitlab.mdp");
    expect(data.description).toBe("Code hosting");
    expect(data.icon).toBe("gitlab.png");
  });

  it("POST with defaults fills href=#, description='', icon=''", () => {
    call("POST", { category: "Test", name: "MinimalService" });

    const groups = readYaml();
    const data = getServiceData(groups, "Test", "MinimalService");
    expect(data.href).toBe("#");
    expect(data.description).toBe("");
    expect(data.icon).toBe("");
  });

  it("POST rejects duplicate service names in same category", () => {
    call("POST", { category: "Infra", name: "Svc" });
    const res = call("POST", { category: "Infra", name: "Svc" });
    expect(res.statusCode).toBe(409);

    // Only one service in YAML
    const groups = readYaml();
    expect(getServicesInCategory(groups, "Infra")).toEqual(["Svc"]);
  });

  it("PUT renames a service in the same category", () => {
    call("POST", { category: "Infra", name: "OldName", href: "http://old" });

    const res = call("PUT", {
      originalName: "OldName",
      originalCategory: "Infra",
      name: "NewName",
      href: "http://new",
      description: "Updated desc",
      icon: "new-icon",
    });
    expect(res.statusCode).toBe(200);

    const groups = readYaml();
    expect(getServicesInCategory(groups, "Infra")).toEqual(["NewName"]);
    expect(getServicesInCategory(groups, "Infra")).not.toContain("OldName");

    const data = getServiceData(groups, "Infra", "NewName");
    expect(data.href).toBe("http://new");
    expect(data.description).toBe("Updated desc");
  });

  it("PUT moves a service to a different category", () => {
    call("POST", { category: "Infra", name: "Grafana", href: "http://grafana" });
    call("POST", { category: "Infra", name: "Nexus", href: "http://nexus" });
    call("POST", { category: "Monitoring", name: "Gatus", href: "http://gatus" });

    const res = call("PUT", {
      originalName: "Grafana",
      originalCategory: "Infra",
      name: "Grafana",
      category: "Monitoring",
      href: "http://grafana",
    });
    expect(res.statusCode).toBe(200);

    const groups = readYaml();
    // Grafana moved from Infra to Monitoring
    expect(getServicesInCategory(groups, "Infra")).toEqual(["Nexus"]);
    expect(getServicesInCategory(groups, "Monitoring")).toContain("Gatus");
    expect(getServicesInCategory(groups, "Monitoring")).toContain("Grafana");
  });

  it("PUT cleans up empty source category after move", () => {
    call("POST", { category: "Solo", name: "OnlyOne" });

    call("PUT", {
      originalName: "OnlyOne",
      originalCategory: "Solo",
      name: "OnlyOne",
      category: "NewHome",
    });

    const groups = readYaml();
    expect(getCategories(groups)).not.toContain("Solo");
    expect(getServicesInCategory(groups, "NewHome")).toContain("OnlyOne");
  });

  it("PUT to non-existent target category creates it", () => {
    call("POST", { category: "Source", name: "Svc" });

    call("PUT", {
      originalName: "Svc",
      originalCategory: "Source",
      name: "Svc",
      category: "BrandNew",
    });

    const groups = readYaml();
    expect(getCategories(groups)).toContain("BrandNew");
    expect(getServicesInCategory(groups, "BrandNew")).toContain("Svc");
  });

  it("DELETE removes a service and cleans up empty category", () => {
    call("POST", { category: "ToDelete", name: "Doomed" });
    call("POST", { category: "ToDelete", name: "Survivor" });

    // Delete one — category stays
    let res = call("DELETE", { name: "Doomed", category: "ToDelete" });
    expect(res.statusCode).toBe(200);

    let groups = readYaml();
    expect(getServicesInCategory(groups, "ToDelete")).toEqual(["Survivor"]);

    // Delete last — category removed
    res = call("DELETE", { name: "Survivor", category: "ToDelete" });
    expect(res.statusCode).toBe(200);

    groups = readYaml();
    expect(getCategories(groups)).not.toContain("ToDelete");
  });

  it("full CRUD lifecycle: create → rename → move → delete", () => {
    // 1. Create
    call("POST", { category: "Dev", name: "Forge", href: "http://forge", icon: "forge.png" });
    let groups = readYaml();
    expect(getServiceData(groups, "Dev", "Forge").href).toBe("http://forge");

    // 2. Rename (same category)
    call("PUT", {
      originalName: "Forge",
      originalCategory: "Dev",
      name: "Forgejo",
      href: "http://forgejo.mdp",
      description: "Git hosting",
      icon: "forgejo.png",
    });
    groups = readYaml();
    expect(getServicesInCategory(groups, "Dev")).toEqual(["Forgejo"]);
    expect(getServiceData(groups, "Dev", "Forgejo").href).toBe("http://forgejo.mdp");

    // 3. Move to new category
    call("PUT", {
      originalName: "Forgejo",
      originalCategory: "Dev",
      name: "Forgejo",
      category: "Infrastructure",
      href: "http://forgejo.mdp",
      description: "Git hosting",
      icon: "forgejo.png",
    });
    groups = readYaml();
    expect(getCategories(groups)).not.toContain("Dev"); // source cleaned up
    expect(getServicesInCategory(groups, "Infrastructure")).toContain("Forgejo");

    // 4. Delete
    call("DELETE", { name: "Forgejo", category: "Infrastructure" });
    groups = readYaml();
    expect(getCategories(groups)).not.toContain("Infrastructure");
    expect(groups).toEqual([]);
  });

  it("YAML round-trip preserves valid structure (re-readable)", () => {
    // Create several services
    call("POST", { category: "A", name: "S1", href: "http://s1" });
    call("POST", { category: "A", name: "S2", href: "http://s2" });
    call("POST", { category: "B", name: "S3", href: "http://s3" });

    // Read raw YAML, re-parse, verify structure
    const raw = readFileSync(join(TEMP_DIR, "services.yaml"), "utf8");
    const parsed = yaml.load(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);

    // Each entry is an object with one key (category name)
    for (const group of parsed) {
      const keys = Object.keys(group);
      expect(keys).toHaveLength(1);
      const services = group[keys[0]];
      expect(Array.isArray(services)).toBe(true);
      for (const svc of services) {
        const svcKeys = Object.keys(svc);
        expect(svcKeys).toHaveLength(1);
        const svcData = svc[svcKeys[0]];
        expect(svcData).toHaveProperty("href");
      }
    }
  });
});
