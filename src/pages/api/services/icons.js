// Icon discovery via GitHub Tree API
// Sources: dashboard (homarr-labs), selfhst, mdi (Material Design Icons)

const SOURCES = {
  dashboard: {
    repo: "homarr-labs/dashboard-icons",
    branch: "main",
    subdir: "png",
    ext: ".png",
    cdnBase: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main/png/",
  },
  selfhst: {
    repo: "selfhst/icons",
    branch: "main",
    subdir: "svg/color",
    ext: ".svg",
    cdnBase: "https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/color/",
  },
  mdi: {
    repo: "Templarian/MaterialDesign-SVG",
    branch: "master",
    subdir: "svg",
    ext: ".svg",
    cdnBase: "https://cdn.jsdelivr.net/gh/Templarian/MaterialDesign-SVG@master/svg/",
  },
};

// In-memory cache: { [source]: { icons: [], fetchedAt: timestamp } }
const cache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getTreeSHA(repo, branch, subdir) {
  const url = `https://api.github.com/repos/${repo}/git/trees/${branch}`;
  const res = await fetch(url, { headers: { "User-Agent": "homepage-icon-picker" } });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  const entry = data.tree.find((t) => t.path === subdir && t.type === "tree");
  if (!entry) throw new Error(`Subdir "${subdir}" not found in ${repo}`);
  return entry.sha;
}

async function getTreeFiles(repo, sha, ext) {
  const url = `https://api.github.com/repos/${repo}/git/trees/${sha}`;
  const res = await fetch(url, { headers: { "User-Agent": "homepage-icon-picker" } });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data.tree
    .filter((t) => t.type === "blob" && t.path.endsWith(ext))
    .map((t) => t.path.replace(ext, ""));
}

async function loadSource(sourceKey) {
  const cached = cache[sourceKey];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.icons;
  }

  const src = SOURCES[sourceKey];
  const sha = await getTreeSHA(src.repo, src.branch, src.subdir);
  const names = await getTreeFiles(src.repo, sha, src.ext);

  const icons = names.map((name) => ({
    name,
    value: sourceKey === "dashboard" ? name : sourceKey === "selfhst" ? `sh-${name}` : `mdi-${name}`,
    preview: `${src.cdnBase}${name}${src.ext}`,
  }));

  cache[sourceKey] = { icons, fetchedAt: Date.now() };
  return icons;
}

export default async function handler(req, res) {
  const { source = "dashboard", search = "", limit = "50" } = req.query;

  if (!SOURCES[source]) {
    return res.status(400).json({ error: `Unknown source "${source}". Valid: ${Object.keys(SOURCES).join(", ")}` });
  }

  try {
    let icons = await loadSource(source);

    if (search) {
      const q = search.toLowerCase();
      icons = icons.filter((i) => i.name.toLowerCase().includes(q));
    }

    const maxItems = Math.min(parseInt(limit, 10) || 50, 200);
    res.status(200).json({ icons: icons.slice(0, maxItems), total: icons.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
