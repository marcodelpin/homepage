import { expect, test } from "@playwright/test";

test.describe("Homepage Dashboard", () => {
  test("loads the main page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Homepage/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("renders service widgets", async ({ page }) => {
    await page.goto("/");
    // Wait for widgets to appear — service entries are rendered as links
    const links = page.locator('a[href*="http"]');
    await expect(links.first()).toBeVisible({ timeout: 10000 });
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
  });
});

test.describe("Services Manage API", () => {
  test("GET /api/services/manage returns categories array", async ({ request }) => {
    const res = await request.get("/api/services/manage");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.categories).toBeDefined();
    expect(Array.isArray(data.categories)).toBeTruthy();
    expect(data.categories.length).toBeGreaterThan(0);
  });

  test("POST + DELETE /api/services/manage round-trip", async ({ request }) => {
    // Clean up any leftovers from previous runs
    await request.delete("/api/services/manage", {
      data: { category: "E2E-Test-Category", name: "e2e-test-service" },
    });

    // Create a test service (flat fields, not nested service object)
    const createRes = await request.post("/api/services/manage", {
      data: {
        category: "E2E-Test-Category",
        name: "e2e-test-service",
        href: "http://e2e-test.example.com",
        description: "Playwright E2E test entry",
        icon: "mdi-test-tube",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.ok).toBeTruthy();

    // Verify it exists
    const getRes = await request.get("/api/services/manage");
    const data = await getRes.json();
    expect(data.categories).toContain("E2E-Test-Category");

    // Delete it
    const delRes = await request.delete("/api/services/manage", {
      data: {
        category: "E2E-Test-Category",
        name: "e2e-test-service",
      },
    });
    expect(delRes.ok()).toBeTruthy();

    // Verify it's gone
    const getRes2 = await request.get("/api/services/manage");
    const data2 = await getRes2.json();
    expect(data2.categories).not.toContain("E2E-Test-Category");
  });

  test("POST rejects missing fields", async ({ request }) => {
    const res = await request.post("/api/services/manage", {
      data: { category: "Test" },
    });
    expect(res.status()).toBe(400);
  });

  test("DELETE rejects missing fields", async ({ request }) => {
    const res = await request.delete("/api/services/manage", {
      data: { category: "Test" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("Icons API", () => {
  test("GET /api/services/icons returns dashboard icons", async ({ request }) => {
    const res = await request.get("/api/services/icons?source=dashboard&limit=10");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.icons).toBeDefined();
    expect(data.icons.length).toBeGreaterThan(0);
    expect(data.icons.length).toBeLessThanOrEqual(10);
    expect(data.total).toBeGreaterThan(0);
    // Each icon has name, value, preview
    const icon = data.icons[0];
    expect(icon.name).toBeDefined();
    expect(icon.value).toBeDefined();
    expect(icon.preview).toBeDefined();
  });

  test("icons API supports offset pagination", async ({ request }) => {
    const page1 = await (await request.get("/api/services/icons?source=dashboard&limit=5&offset=0")).json();
    const page2 = await (await request.get("/api/services/icons?source=dashboard&limit=5&offset=5")).json();

    expect(page1.icons.length).toBe(5);
    expect(page2.icons.length).toBe(5);
    // Pages should not overlap
    const names1 = page1.icons.map((i) => i.name);
    const names2 = page2.icons.map((i) => i.name);
    const overlap = names1.filter((n) => names2.includes(n));
    expect(overlap.length).toBe(0);
  });

  test("icons API search filters results", async ({ request }) => {
    const res = await request.get("/api/services/icons?source=dashboard&search=git&limit=50");
    const data = await res.json();
    expect(data.icons.length).toBeGreaterThan(0);
    for (const icon of data.icons) {
      expect(icon.name.toLowerCase()).toContain("git");
    }
  });

  test("icons API rejects unknown source", async ({ request }) => {
    const res = await request.get("/api/services/icons?source=invalid");
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unknown source");
  });

  // selfhst and mdi may fail due to GitHub API rate limiting — test conditionally
  test("icons API returns selfhst or mdi icons (if not rate-limited)", async ({ request }) => {
    // Try selfhst first, fall back to mdi
    let res = await request.get("/api/services/icons?source=selfhst&limit=5");
    if (!res.ok()) {
      res = await request.get("/api/services/icons?source=mdi&limit=5");
    }
    if (res.ok()) {
      const data = await res.json();
      expect(data.icons.length).toBeGreaterThan(0);
      // Should have prefixed values
      expect(data.icons[0].value).toMatch(/^(sh-|mdi-)/);
    } else {
      // GitHub rate limited — skip gracefully
      console.log("GitHub API rate limited, skipping external icon sources test");
    }
  });
});
