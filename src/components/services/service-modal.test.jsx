// @vitest-environment jsdom

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

// ── mock next/dynamic to render IconPicker synchronously ────────────────────
vi.mock("next/dynamic", () => ({
  default: (loader) => {
    // Return a simple stub component — icon-picker is tested separately
    return function MockIconPicker({ onSelect, onClose }) {
      return (
        <div data-testid="icon-picker-mock">
          <button onClick={() => { onSelect("picked-icon"); onClose(); }}>Pick</button>
        </div>
      );
    };
  },
}));

// ── mock react-icons ────────────────────────────────────────────────────────
vi.mock("react-icons/md", () => ({
  MdClose: function MdCloseMock(props) {
    return <span data-testid="md-close" {...props} />;
  },
  MdImage: function MdImageMock(props) {
    return <span data-testid="md-image" {...props} />;
  },
}));

// ── global fetch mock ───────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import ServiceModal from "./service-modal";

// ── helpers ─────────────────────────────────────────────────────────────────
function mockCategoriesResponse(categories = ["Infra", "Media"]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ categories }),
  });
}

function mockSaveResponse(ok = true, status = 201, error = null) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: async () => (ok ? { ok: true } : { error }),
  });
}

/** Get form inputs by their label text (labels are siblings, not htmlFor-linked) */
function getInputByLabel(container, labelText) {
  const labels = container.querySelectorAll("label");
  for (const label of labels) {
    if (label.textContent.trim() === labelText) {
      // The input is the next sibling element, or inside the next sibling container
      const parent = label.parentElement;
      const input = parent.querySelector("input, select");
      if (input) return input;
    }
  }
  return null;
}

// ── tests ───────────────────────────────────────────────────────────────────
describe("components/services/service-modal", () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // window.confirm used by delete
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = renderWithProviders(
      <ServiceModal isOpen={false} onClose={onClose} onSaved={onSaved} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders the 'Add Service' form when isOpen is true", async () => {
    mockCategoriesResponse();

    let container;
    await act(async () => {
      const result = renderWithProviders(<ServiceModal isOpen onClose={onClose} onSaved={onSaved} />);
      container = result.container;
    });

    // Title is both in the h3 and in the submit button; check h3
    expect(container.querySelector("h3").textContent).toBe("Add Service");

    // Check all labels exist
    const labels = [...container.querySelectorAll("label")].map((l) => l.textContent.trim());
    expect(labels).toContain("Name *");
    expect(labels).toContain("URL");
    expect(labels).toContain("Description");
    expect(labels).toContain("Icon");
    expect(labels).toContain("Category");
  });

  it("renders 'Edit Service' title when editService is provided", async () => {
    mockCategoriesResponse();

    const editService = {
      name: "GitLab",
      href: "http://gitlab.example",
      description: "Version control",
      icon: "gitlab",
      category: "Infra",
    };

    let container;
    await act(async () => {
      const result = renderWithProviders(
        <ServiceModal isOpen onClose={onClose} onSaved={onSaved} editService={editService} />,
      );
      container = result.container;
    });

    expect(container.querySelector("h3").textContent).toBe("Edit Service");
    expect(screen.getByDisplayValue("GitLab")).toBeTruthy();
    expect(screen.getByDisplayValue("http://gitlab.example")).toBeTruthy();
    expect(screen.getByDisplayValue("Version control")).toBeTruthy();
    expect(screen.getByDisplayValue("gitlab")).toBeTruthy();
  });

  it("shows a Delete button only in edit mode", async () => {
    mockCategoriesResponse();

    const editService = {
      name: "GitLab",
      href: "#",
      description: "",
      icon: "",
      category: "Infra",
    };

    await act(async () => {
      renderWithProviders(
        <ServiceModal isOpen onClose={onClose} onSaved={onSaved} editService={editService} />,
      );
    });

    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("does NOT show Delete button in add mode", async () => {
    mockCategoriesResponse();

    await act(async () => {
      renderWithProviders(<ServiceModal isOpen onClose={onClose} onSaved={onSaved} />);
    });

    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("fetches categories on open", async () => {
    mockCategoriesResponse(["Infra", "Media"]);

    await act(async () => {
      renderWithProviders(<ServiceModal isOpen onClose={onClose} onSaved={onSaved} />);
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/services/manage");
  });

  it("populates category dropdown with fetched categories", async () => {
    mockCategoriesResponse(["Infra", "Media", "Monitoring"]);

    await act(async () => {
      renderWithProviders(<ServiceModal isOpen onClose={onClose} onSaved={onSaved} />);
    });

    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(3);
      expect(options[0].textContent).toBe("Infra");
      expect(options[1].textContent).toBe("Media");
      expect(options[2].textContent).toBe("Monitoring");
    });
  });

  it("calls onClose when Cancel is clicked", async () => {
    mockCategoriesResponse();

    await act(async () => {
      renderWithProviders(<ServiceModal isOpen onClose={onClose} onSaved={onSaved} />);
    });

    fireEvent.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    mockCategoriesResponse();

    let container;
    await act(async () => {
      const result = renderWithProviders(
        <ServiceModal isOpen onClose={onClose} onSaved={onSaved} />,
      );
      container = result.container;
    });

    const backdrop = container.querySelector(".fixed.inset-0");
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it("submits POST for new service and calls onSaved + onClose", async () => {
    mockCategoriesResponse(["Infra"]);

    let container;
    await act(async () => {
      const result = renderWithProviders(<ServiceModal isOpen onClose={onClose} onSaved={onSaved} />);
      container = result.container;
    });

    // Fill the form using helper since labels aren't htmlFor-linked
    const nameInput = getInputByLabel(container, "Name *");
    const urlInput = getInputByLabel(container, "URL");
    fireEvent.change(nameInput, { target: { value: "NewSvc" } });
    fireEvent.change(urlInput, { target: { value: "http://new.example" } });

    // Mock the POST response
    mockSaveResponse(true, 201);

    // Click the submit button (text matches the button type="submit")
    const submitBtn = container.querySelector('button[type="submit"]');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    // Verify the fetch call was made with POST
    const saveCall = mockFetch.mock.calls.find(
      (c) => typeof c[1] === "object" && c[1].method === "POST",
    );
    expect(saveCall).toBeTruthy();
    const body = JSON.parse(saveCall[1].body);
    expect(body.name).toBe("NewSvc");
  });

  it("submits PUT for edited service", async () => {
    mockCategoriesResponse(["Infra"]);

    const editService = {
      name: "GitLab",
      href: "http://gitlab.example",
      description: "",
      icon: "",
      category: "Infra",
    };

    let container;
    await act(async () => {
      const result = renderWithProviders(
        <ServiceModal isOpen onClose={onClose} onSaved={onSaved} editService={editService} />,
      );
      container = result.container;
    });

    // Change the name
    const nameInput = getInputByLabel(container, "Name *");
    fireEvent.change(nameInput, { target: { value: "GitLab CE" } });

    mockSaveResponse(true, 200);

    const submitBtn = container.querySelector('button[type="submit"]');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    const saveCall = mockFetch.mock.calls.find(
      (c) => typeof c[1] === "object" && c[1].method === "PUT",
    );
    expect(saveCall).toBeTruthy();
    const body = JSON.parse(saveCall[1].body);
    expect(body.originalName).toBe("GitLab");
    expect(body.name).toBe("GitLab CE");
  });

  it("sends DELETE when delete button is clicked and confirmed", async () => {
    mockCategoriesResponse(["Infra"]);

    const editService = {
      name: "GitLab",
      href: "#",
      description: "",
      icon: "",
      category: "Infra",
    };

    await act(async () => {
      renderWithProviders(
        <ServiceModal isOpen onClose={onClose} onSaved={onSaved} editService={editService} />,
      );
    });

    mockSaveResponse(true, 200);

    await act(async () => {
      fireEvent.click(screen.getByText("Delete"));
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    const deleteCall = mockFetch.mock.calls.find(
      (c) => typeof c[1] === "object" && c[1].method === "DELETE",
    );
    expect(deleteCall).toBeTruthy();
    const body = JSON.parse(deleteCall[1].body);
    expect(body.name).toBe("GitLab");
    expect(body.category).toBe("Infra");
  });

  it("does NOT delete when user cancels the confirm dialog", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    mockCategoriesResponse(["Infra"]);

    const editService = {
      name: "GitLab",
      href: "#",
      description: "",
      icon: "",
      category: "Infra",
    };

    await act(async () => {
      renderWithProviders(
        <ServiceModal isOpen onClose={onClose} onSaved={onSaved} editService={editService} />,
      );
    });

    fireEvent.click(screen.getByText("Delete"));

    // No DELETE fetch should have been made (only the initial GET for categories)
    const deleteCall = mockFetch.mock.calls.find(
      (c) => typeof c[1] === "object" && c[1].method === "DELETE",
    );
    expect(deleteCall).toBeUndefined();
  });

  it("displays error message when save fails", async () => {
    mockCategoriesResponse(["Infra"]);

    let container;
    await act(async () => {
      const result = renderWithProviders(<ServiceModal isOpen onClose={onClose} onSaved={onSaved} />);
      container = result.container;
    });

    const nameInput = getInputByLabel(container, "Name *");
    fireEvent.change(nameInput, { target: { value: "Fail" } });

    mockSaveResponse(false, 409, "Service already exists");

    const submitBtn = container.querySelector('button[type="submit"]');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Service already exists")).toBeTruthy();
    });

    expect(onSaved).not.toHaveBeenCalled();
  });
});
