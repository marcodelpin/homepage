import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

import yaml from "js-yaml";

import createLogger from "utils/logger";

const logger = createLogger("services/manage");
const CONF_DIR = process.env.HOMEPAGE_CONFIG_DIR || join(process.cwd(), "config");
const SERVICES_FILE = join(CONF_DIR, "services.yaml");

function readServices() {
  try {
    const content = readFileSync(SERVICES_FILE, "utf8");
    return yaml.load(content) || [];
  } catch {
    return [];
  }
}

function writeServices(groups) {
  writeFileSync(SERVICES_FILE, yaml.dump(groups, { lineWidth: -1 }), "utf8");
}

function getCategories(groups) {
  return groups.map((g) => Object.keys(g)[0]);
}

export default function handler(req, res) {
  if (req.method === "GET") {
    const groups = readServices();
    return res.status(200).json({ categories: getCategories(groups) });
  }

  if (req.method === "POST") {
    // Add new service
    const { category, name, href, description, icon } = req.body;
    if (!category || !name) return res.status(400).json({ error: "category and name required" });

    const groups = readServices();
    let group = groups.find((g) => Object.keys(g)[0] === category);
    if (!group) {
      const newGroup = { [category]: [] };
      groups.push(newGroup);
      group = newGroup;
    }

    const services = group[category] || [];
    const existing = services.findIndex((s) => Object.keys(s)[0] === name);
    if (existing >= 0) return res.status(409).json({ error: "Service already exists" });

    const svc = { [name]: { href: href || "#", description: description || "", icon: icon || "" } };
    services.push(svc);
    group[category] = services;

    writeServices(groups);
    logger.info(`Added service "${name}" to category "${category}"`);
    return res.status(201).json({ ok: true });
  }

  if (req.method === "PUT") {
    // Edit service
    const { originalName, originalCategory, name, href, description, icon, category } = req.body;
    if (!originalName || !originalCategory) return res.status(400).json({ error: "originalName and originalCategory required" });

    const groups = readServices();
    const srcGroup = groups.find((g) => Object.keys(g)[0] === originalCategory);
    if (!srcGroup) return res.status(404).json({ error: "Source category not found" });

    const srcServices = srcGroup[originalCategory] || [];
    const svcIdx = srcServices.findIndex((s) => Object.keys(s)[0] === originalName);
    if (svcIdx < 0) return res.status(404).json({ error: "Service not found" });

    // Remove from source
    srcGroup[originalCategory] = srcServices.filter((_, i) => i !== svcIdx);

    // Add to destination (may be different category)
    const targetCategoryName = category || originalCategory;
    let destGroup = groups.find((g) => Object.keys(g)[0] === targetCategoryName);
    if (!destGroup) {
      const newGroup = { [targetCategoryName]: [] };
      groups.push(newGroup);
      destGroup = newGroup;
    }

    const newSvc = {
      [name || originalName]: {
        href: href || "#",
        description: description || "",
        icon: icon || "",
      },
    };
    destGroup[targetCategoryName] = [...(destGroup[targetCategoryName] || []), newSvc];

    // Clean empty categories
    const filtered = groups.filter((g) => {
      const key = Object.keys(g)[0];
      return (g[key] || []).length > 0;
    });

    writeServices(filtered);
    logger.info(`Edited service "${originalName}" → "${name || originalName}"`);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { name, category } = req.body;
    if (!name || !category) return res.status(400).json({ error: "name and category required" });

    const groups = readServices();
    const group = groups.find((g) => Object.keys(g)[0] === category);
    if (!group) return res.status(404).json({ error: "Category not found" });

    const before = (group[category] || []).length;
    group[category] = (group[category] || []).filter((s) => Object.keys(s)[0] !== name);
    if (group[category].length === before) return res.status(404).json({ error: "Service not found" });

    const filtered = groups.filter((g) => {
      const key = Object.keys(g)[0];
      return (g[key] || []).length > 0;
    });

    writeServices(filtered);
    logger.info(`Deleted service "${name}" from category "${category}"`);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
