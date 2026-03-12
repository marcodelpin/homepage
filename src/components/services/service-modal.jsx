import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { MdClose, MdImage } from "react-icons/md";

const IconPicker = dynamic(() => import("./icon-picker"), { ssr: false });

export default function ServiceModal({ isOpen, onClose, onSaved, editService }) {
  const isEdit = Boolean(editService);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", href: "", description: "", icon: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const firstInput = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/services/manage")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch(() => {});
    if (firstInput.current) firstInput.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (editService) {
      setForm({
        name: editService.name || "",
        href: editService.href || "",
        description: editService.description || "",
        icon: editService.icon || "",
        category: editService.category || "",
      });
    } else {
      setForm({ name: "", href: "", description: "", icon: "", category: categories[0] || "" });
    }
    setError(null);
  }, [editService, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = "/api/services/manage";
      const payload = isEdit
        ? {
            originalName: editService.name,
            originalCategory: editService.category,
            name: form.name,
            href: form.href,
            description: form.description,
            icon: form.icon,
            category: form.category || editService.category,
          }
        : {
            category: form.category || categories[0],
            name: form.name,
            href: form.href,
            description: form.description,
            icon: form.icon,
          };

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editService || !window.confirm(`Delete "${editService.name}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/services/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editService.name, category: editService.category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="bg-theme-100 dark:bg-theme-800 rounded-xl shadow-2xl w-[480px] max-w-[95vw] p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-theme-800 dark:text-theme-200">
              {isEdit ? "Edit Service" : "Add Service"}
            </h3>
            <button type="button" onClick={onClose} className="text-theme-500 hover:text-theme-800 dark:hover:text-theme-200">
              <MdClose className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-theme-600 dark:text-theme-400">Name *</label>
              <input
                ref={firstInput}
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-theme-200 dark:bg-theme-700 text-theme-800 dark:text-theme-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-theme-600 dark:text-theme-400">URL</label>
              <input
                type="url"
                value={form.href}
                onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg bg-theme-200 dark:bg-theme-700 text-theme-800 dark:text-theme-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-theme-600 dark:text-theme-400">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-theme-200 dark:bg-theme-700 text-theme-800 dark:text-theme-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-theme-600 dark:text-theme-400">Icon</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="gitlab, mdi-server, sh-grafana, https://..."
                  className="flex-1 rounded-lg bg-theme-200 dark:bg-theme-700 text-theme-800 dark:text-theme-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  title="Pick icon from list"
                  className="flex items-center gap-1 px-3 py-2 bg-theme-300 dark:bg-theme-600 hover:bg-theme-400 dark:hover:bg-theme-500 rounded-lg text-sm text-theme-700 dark:text-theme-200 transition-colors"
                >
                  <MdImage className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-theme-600 dark:text-theme-400">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-theme-200 dark:bg-theme-700 text-theme-800 dark:text-theme-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Service"}
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="bg-theme-300 dark:bg-theme-600 hover:bg-theme-400 dark:hover:bg-theme-500 text-theme-700 dark:text-theme-200 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {showIconPicker && (
        <IconPicker onSelect={(val) => setForm((f) => ({ ...f, icon: val }))} onClose={() => setShowIconPicker(false)} />
      )}
    </>
  );
}
