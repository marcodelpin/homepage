// @vitest-environment jsdom

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

// ── mock react-icons ────────────────────────────────────────────────────────
vi.mock("react-icons/md", () => ({
  MdClose: function MdCloseMock(props) {
    return <span data-testid="md-close" {...props} />;
  },
  MdSearch: function MdSearchMock(props) {
    return <span data-testid="md-search" {...props} />;
  },
}));

// ── global fetch mock ───────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import IconPicker from "./icon-picker";

// ── helpers ─────────────────────────────────────────────────────────────────
function mockIconsResponse(icons = [], total = 0) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ icons, total }),
  });
}

function sampleIcons() {
  return [
    { name: "gitlab", value: "gitlab", preview: "https://cdn.example.com/gitlab.png" },
    { name: "grafana", value: "grafana", preview: "https://cdn.example.com/grafana.png" },
    { name: "nexus", value: "nexus", preview: "https://cdn.example.com/nexus.png" },
  ];
}

// ── tests ───────────────────────────────────────────────────────────────────
describe("components/services/icon-picker", () => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the modal with header and source tabs", async () => {
    mockIconsResponse(sampleIcons(), 3);

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    expect(screen.getByText("Select Icon")).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("selfh.st")).toBeTruthy();
    expect(screen.getByText("MDI")).toBeTruthy();
  });

  it("fetches icons on mount and displays them", async () => {
    const icons = sampleIcons();
    mockIconsResponse(icons, 3);

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByTitle("gitlab")).toBeTruthy();
      expect(screen.getByTitle("grafana")).toBeTruthy();
      expect(screen.getByTitle("nexus")).toBeTruthy();
    });

    // Verify fetch was called with dashboard source (default)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/services/icons?source=dashboard"),
    );
  });

  it("calls onSelect and onClose when an icon is clicked", async () => {
    mockIconsResponse(sampleIcons(), 3);

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByTitle("gitlab")).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle("gitlab"));

    expect(onSelect).toHaveBeenCalledWith("gitlab");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    mockIconsResponse([], 0);

    let container;
    await act(async () => {
      const result = renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
      container = result.container;
    });

    // Click the backdrop (outermost overlay div)
    const backdrop = container.querySelector(".fixed.inset-0");
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close when clicking inside the modal content", async () => {
    mockIconsResponse([], 0);

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    fireEvent.click(screen.getByText("Select Icon"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows 'No icons found' when results are empty", async () => {
    mockIconsResponse([], 0);

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByText("No icons found")).toBeTruthy();
    });
  });

  it("shows error message when API returns an error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "Rate limited" }),
    });

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load icons/)).toBeTruthy();
    });
  });

  it("switches source tabs and re-fetches icons", async () => {
    // Initial fetch (dashboard)
    mockIconsResponse(sampleIcons(), 3);

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByTitle("gitlab")).toBeTruthy();
    });

    // Mock the selfhst fetch
    mockIconsResponse(
      [{ name: "self-icon", value: "sh-self-icon", preview: "https://cdn.example.com/self-icon.svg" }],
      1,
    );

    // Click selfh.st tab
    await act(async () => {
      fireEvent.click(screen.getByText("selfh.st"));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("source=selfhst"));
    });
  });

  it("handles manual input via Enter key in the footer", async () => {
    mockIconsResponse([], 0);

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByText("No icons found")).toBeTruthy();
    });

    const manualInput = screen.getByPlaceholderText("e.g. gitlab, mdi-server, sh-grafana");
    fireEvent.change(manualInput, { target: { value: "custom-icon" } });
    fireEvent.keyDown(manualInput, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("custom-icon");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'Load more' button when more icons are available", async () => {
    mockIconsResponse(sampleIcons(), 100); // 3 icons but total=100

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByTitle("gitlab")).toBeTruthy();
    });

    const loadMoreBtn = screen.getByText(/Load more/);
    expect(loadMoreBtn).toBeTruthy();
    expect(loadMoreBtn.textContent).toContain("3 / 100");
  });

  it("loads more icons when 'Load more' is clicked", async () => {
    mockIconsResponse(sampleIcons(), 100); // first page

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByTitle("gitlab")).toBeTruthy();
    });

    // Mock second page
    mockIconsResponse(
      [{ name: "docker", value: "docker", preview: "https://cdn.example.com/docker.png" }],
      100,
    );

    await act(async () => {
      fireEvent.click(screen.getByText(/Load more/));
    });

    await waitFor(() => {
      expect(screen.getByTitle("docker")).toBeTruthy();
    });

    // Original icons still present
    expect(screen.getByTitle("gitlab")).toBeTruthy();

    // Verify offset was sent
    expect(mockFetch).toHaveBeenLastCalledWith(expect.stringContaining("offset=3"));
  });

  it("hides 'Load more' when all icons are loaded", async () => {
    mockIconsResponse(sampleIcons(), 3); // total matches loaded count

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByTitle("gitlab")).toBeTruthy();
    });

    expect(screen.queryByText(/Load more/)).toBeNull();
  });

  it("does not submit empty manual input", async () => {
    mockIconsResponse([], 0);

    await act(async () => {
      renderWithProviders(<IconPicker onSelect={onSelect} onClose={onClose} />);
    });

    await waitFor(() => {
      expect(screen.getByText("No icons found")).toBeTruthy();
    });

    const manualInput = screen.getByPlaceholderText("e.g. gitlab, mdi-server, sh-grafana");
    fireEvent.keyDown(manualInput, { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
