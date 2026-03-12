const STORAGE_KEY = "homepage-click-counts";

function getClickCounts() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveClickCounts(counts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // ignore storage errors
  }
}

export function trackServiceClick(serviceKey) {
  if (!serviceKey || serviceKey === "#") return;
  const counts = getClickCounts();
  counts[serviceKey] = (counts[serviceKey] || 0) + 1;
  saveClickCounts(counts);
}

export function getTopServices(allServices, maxItems = 5) {
  const counts = getClickCounts();
  if (Object.keys(counts).length === 0) return [];
  return allServices
    .filter((svc) => svc.href && counts[svc.href] > 0)
    .sort((a, b) => (counts[b.href] || 0) - (counts[a.href] || 0))
    .slice(0, maxItems);
}

export function useClickCounts() {
  return { trackServiceClick, getTopServices };
}
