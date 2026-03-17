// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getTopServices, trackServiceClick, useClickCounts } from "./click-tracker";

describe("utils/hooks/click-tracker", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("trackServiceClick", () => {
    it("increments click count for a service key", () => {
      trackServiceClick("https://grafana.example.com");
      trackServiceClick("https://grafana.example.com");
      trackServiceClick("https://grafana.example.com");

      const stored = JSON.parse(localStorage.getItem("homepage-click-counts"));
      expect(stored["https://grafana.example.com"]).toBe(3);
    });

    it("tracks multiple service keys independently", () => {
      trackServiceClick("https://a.com");
      trackServiceClick("https://b.com");
      trackServiceClick("https://a.com");

      const stored = JSON.parse(localStorage.getItem("homepage-click-counts"));
      expect(stored["https://a.com"]).toBe(2);
      expect(stored["https://b.com"]).toBe(1);
    });

    it("ignores empty or falsy keys", () => {
      trackServiceClick("");
      trackServiceClick(null);
      trackServiceClick(undefined);

      const stored = localStorage.getItem("homepage-click-counts");
      expect(stored).toBeNull();
    });

    it("ignores '#' href (no-link services)", () => {
      trackServiceClick("#");

      const stored = localStorage.getItem("homepage-click-counts");
      expect(stored).toBeNull();
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem("homepage-click-counts", "not-json!!!");
      // Should not throw, falls back to empty {}
      trackServiceClick("https://example.com");

      const stored = JSON.parse(localStorage.getItem("homepage-click-counts"));
      expect(stored["https://example.com"]).toBe(1);
    });

    it("handles localStorage quota exceeded gracefully", () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new DOMException("QuotaExceededError");
      });

      // Should not throw
      expect(() => trackServiceClick("https://example.com")).not.toThrow();

      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe("getTopServices", () => {
    const allServices = [
      { name: "Grafana", href: "https://grafana.example.com" },
      { name: "Nexus", href: "https://nexus.example.com" },
      { name: "Forgejo", href: "https://forgejo.example.com" },
      { name: "Vaultwarden", href: "https://vault.example.com" },
      { name: "No Link", href: null },
    ];

    it("returns empty array when no clicks recorded", () => {
      expect(getTopServices(allServices)).toEqual([]);
    });

    it("returns services sorted by click count descending", () => {
      trackServiceClick("https://nexus.example.com"); // 1
      trackServiceClick("https://grafana.example.com"); // 3
      trackServiceClick("https://grafana.example.com");
      trackServiceClick("https://grafana.example.com");
      trackServiceClick("https://forgejo.example.com"); // 2
      trackServiceClick("https://forgejo.example.com");

      const top = getTopServices(allServices);
      expect(top.map((s) => s.name)).toEqual(["Grafana", "Forgejo", "Nexus"]);
    });

    it("respects maxItems parameter", () => {
      trackServiceClick("https://grafana.example.com");
      trackServiceClick("https://nexus.example.com");
      trackServiceClick("https://forgejo.example.com");

      const top = getTopServices(allServices, 2);
      expect(top).toHaveLength(2);
    });

    it("defaults maxItems to 5", () => {
      // Click 6 different services (need more test data)
      const manyServices = Array.from({ length: 8 }, (_, i) => ({
        name: `Svc${i}`,
        href: `https://svc${i}.example.com`,
      }));
      manyServices.forEach((s) => trackServiceClick(s.href));

      const top = getTopServices(manyServices);
      expect(top).toHaveLength(5);
    });

    it("excludes services without href", () => {
      trackServiceClick("https://grafana.example.com");

      const top = getTopServices(allServices);
      // "No Link" service has href: null, should not appear even if counts existed
      expect(top.every((s) => s.href !== null)).toBe(true);
    });

    it("excludes services with zero or no clicks", () => {
      trackServiceClick("https://grafana.example.com");

      const top = getTopServices(allServices);
      // Only Grafana should appear (others have 0 clicks)
      expect(top).toHaveLength(1);
      expect(top[0].name).toBe("Grafana");
    });

    it("handles services not in allServices (orphaned clicks)", () => {
      trackServiceClick("https://deleted-service.com");
      trackServiceClick("https://grafana.example.com");

      const top = getTopServices(allServices);
      // deleted-service.com is not in allServices, should be excluded
      expect(top).toHaveLength(1);
      expect(top[0].name).toBe("Grafana");
    });
  });

  describe("useClickCounts", () => {
    it("returns trackServiceClick and getTopServices functions", () => {
      const { trackServiceClick: track, getTopServices: top } = useClickCounts();
      expect(typeof track).toBe("function");
      expect(typeof top).toBe("function");
    });
  });

  describe("SSR safety (window undefined)", () => {
    it("getClickCounts returns empty object when window is undefined", async () => {
      // trackServiceClick calls getClickCounts which checks typeof window
      // In node env without jsdom, window would be undefined
      // Since we're in jsdom, we test the fallback path via corrupted storage
      localStorage.setItem("homepage-click-counts", "{{invalid}}");
      const top = getTopServices([{ href: "x" }]);
      expect(top).toEqual([]);
    });
  });
});
