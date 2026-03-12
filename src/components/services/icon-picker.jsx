import { useEffect, useRef, useState } from "react";
import { MdClose, MdSearch } from "react-icons/md";

const SOURCES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "selfhst", label: "selfh.st" },
  { key: "mdi", label: "MDI" },
];

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 60;

export default function IconPicker({ onSelect, onClose }) {
  const [activeSource, setActiveSource] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [icons, setIcons] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const debouncedSearch = useDebounce(search, 300);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Reset + fetch first page on source/search change
  useEffect(() => {
    setLoading(true);
    setError(null);
    setIcons([]);
    fetch(`/api/services/icons?source=${activeSource}&search=${encodeURIComponent(debouncedSearch)}&limit=${PAGE_SIZE}&offset=0`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setIcons(data.icons || []);
        setTotal(data.total || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeSource, debouncedSearch]);

  function loadMore() {
    setLoadingMore(true);
    fetch(`/api/services/icons?source=${activeSource}&search=${encodeURIComponent(debouncedSearch)}&limit=${PAGE_SIZE}&offset=${icons.length}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setIcons((prev) => [...prev, ...(data.icons || [])]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMore(false));
  }

  const hasMore = icons.length < total;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-theme-100 dark:bg-theme-800 rounded-xl shadow-2xl w-[700px] max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-300 dark:border-theme-600">
          <h3 className="text-lg font-semibold text-theme-800 dark:text-theme-200">Select Icon</h3>
          <button type="button" onClick={onClose} className="text-theme-500 hover:text-theme-800 dark:hover:text-theme-200">
            <MdClose className="w-6 h-6" />
          </button>
        </div>

        {/* Source tabs */}
        <div className="flex border-b border-theme-300 dark:border-theme-600">
          {SOURCES.map((src) => (
            <button
              key={src.key}
              type="button"
              onClick={() => { setActiveSource(src.key); setSearch(""); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSource === src.key
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-theme-500 hover:text-theme-700 dark:hover:text-theme-300"
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-theme-300 dark:border-theme-600">
          <div className="flex items-center gap-2 bg-theme-200 dark:bg-theme-700 rounded-lg px-3 py-2">
            <MdSearch className="w-4 h-4 text-theme-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder={`Search ${total > 0 ? total : ""} icons...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-theme-800 dark:text-theme-200 outline-none placeholder-theme-400"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-theme-400 hover:text-theme-600">
                <MdClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Icon grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center h-32 text-theme-400">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-32 text-red-400 text-sm">
              Failed to load icons: {error}
            </div>
          )}
          {!loading && !error && icons.length === 0 && (
            <div className="flex items-center justify-center h-32 text-theme-400 text-sm">No icons found</div>
          )}
          {!loading && !error && icons.length > 0 && (
            <>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {icons.map((icon) => (
                  <button
                    key={icon.value}
                    type="button"
                    title={icon.name}
                    onClick={() => { onSelect(icon.value); onClose(); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-theme-300/50 dark:hover:bg-theme-600/50 transition-colors group"
                  >
                    <img
                      src={icon.preview}
                      alt={icon.name}
                      className="w-8 h-8 object-contain"
                      onError={(e) => { e.target.style.opacity = "0.3"; }}
                      loading="lazy"
                    />
                    <span className="text-[9px] text-theme-500 dark:text-theme-400 truncate w-full text-center leading-tight">
                      {icon.name}
                    </span>
                  </button>
                ))}
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-3 w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-theme-200 dark:bg-theme-700 rounded-lg hover:bg-theme-300 dark:hover:bg-theme-600 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : `Load more (${icons.length} / ${total})`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Manual input footer */}
        <div className="p-3 border-t border-theme-300 dark:border-theme-600 bg-theme-50 dark:bg-theme-900/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-500 shrink-0">Or type icon name:</span>
            <input
              type="text"
              placeholder="e.g. gitlab, mdi-server, sh-grafana"
              className="flex-1 text-xs bg-theme-200 dark:bg-theme-700 text-theme-800 dark:text-theme-200 rounded px-2 py-1 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  onSelect(e.target.value.trim());
                  onClose();
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
