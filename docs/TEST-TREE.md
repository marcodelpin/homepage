# TEST-TREE.md — Homepage Fork Test Coverage

Generated: 2026-03-21

## Summary

| Metric | Value |
|--------|-------|
| Total Source Files | 1,060 |
| Total Test Files | 528 |
| Total Test Cases | 1,411 |
| Test Status | **1411/1411 PASS** |
| Custom Fork Coverage | 100% (13/13 custom files tested) |
| Framework | Vitest 3.2.4 + Playwright |

## Coverage Matrix — Custom Fork Code

| # | Source File | Test File | Tests | Coverage | Cost |
|---|------------|-----------|-------|----------|------|
| 1 | `pages/api/services/manage.js` | `manage.test.js` | 31 | HIGH | FREE |
| 2 | `pages/api/services/icons.js` | `icons.test.js` | 24 | HIGH | FREE |
| 3 | `components/services/service-modal.jsx` | `service-modal.test.jsx` | 17 | HIGH | FREE |
| 4 | `components/services/icon-picker.jsx` | `icon-picker.test.jsx` | 18 | HIGH | FREE |
| 5 | `utils/hooks/click-tracker.js` | `click-tracker.test.js` | 21 | HIGH | FREE |
| 6 | `utils/config/service-helpers.js` | `service-helpers.test.js` | 19 | HIGH | FREE |
| 7 | `pages/index.jsx` | `index.test.jsx` | ~25 | PARTIAL | FREE |
| 8 | `widgets/tracearr/component.jsx` | `component.test.jsx` | ~10 | HIGH | FREE |
| 9 | `widgets/sparkyfitness/component.jsx` | `component.test.jsx` | ~5 | HIGH | FREE |
| 10 | `components/widgets/snippets/snippets.jsx` | `snippets.test.jsx` | 5 | HIGH | FREE |
| 11 | `components/services/item.jsx` | `item.test.jsx` | 10 | HIGH | FREE |
| 12 | `components/services/group.jsx` | `group.test.jsx` | 2 | PARTIAL | FREE |
| 13 | `components/services/list.jsx` | `list.test.jsx` | 1 | PARTIAL | FREE |

## Upstream Coverage (not fork-specific)

| Category | Files | With Tests | Ratio |
|----------|-------|-----------|-------|
| Widgets (157 services) | 780 | 389 | 50% |
| Components | 130 | 66 | 51% |
| Utils | 73 | 37 | 51% |
| API routes | 35 | 35 | 100% |

## Gap Analysis

### P2 — Low Priority (tests exist, could expand)

- `group.jsx`: 2 tests — could add: header visibility, subgroup rendering, layout variants (~5 more)
- `list.jsx`: 1 test — could add: grid vs flex layout, empty list, column mapping (~4 more)
- `pages/index.jsx`: service modal integration callbacks — +5 tests

### No P0/P1 gaps found.

## Fixed Issues

### Windows Path Separator (2026-03-21)

3 test files (8 tests) failed on Windows due to `path.join()` producing `\` instead of `/`:

| File | Root Cause | Fix |
|------|-----------|-----|
| `proxmox.test.js` | `readFileSync` assertion expected `/conf/proxmox.yaml` | Use `stringContaining` |
| `hash.test.js` | `filePath.split("/")` missed Windows backslash | Split on `/[/\\]/` |
| `service-helpers.test.js` | `endsWith("/services.yaml")` missed backslash | Use `endsWith("services.yaml")` |

## Cost Classification

| Cost | Count | Examples |
|------|-------|---------|
| FREE | 1,411 | All tests (pure React components, mocked deps) |
| MODERATE | ~8 | E2E tests (Playwright, needs browser) |
| EXPENSIVE | 0 | — |

## Mock Analysis

| Dependency | Mock Strategy | Effectiveness |
|-----------|--------------|---------------|
| HeadlessUI | Module mock (Disclosure, Dialog) | HIGH |
| next/router | vi.mock with push/query | HIGH |
| localStorage | jsdom built-in | HIGH |
| fetch/API | vi.fn() response mock | HIGH |
| fs/yaml | vi.hoisted module mock | HIGH |
| GitHub Tree API | Response mock in icons.test | HIGH |

## Test Commands

```bash
pnpm test                  # Run all 1411 tests
pnpm test:coverage         # With v8 coverage report
pnpm test -- <file>        # Run specific file
npx playwright test        # E2E tests
```
