import fs from "node:fs";
import path from "node:path";

const rootLockPath = path.resolve("package-lock.json");
const nestedFrontendLockPath = path.resolve("frontend/package-lock.json");

if (fs.existsSync(nestedFrontendLockPath)) {
  console.error("frontend/package-lock.json must not be tracked in this npm workspace repo.");
  process.exit(1);
}

if (!fs.existsSync(rootLockPath)) {
  console.error("package-lock.json is missing at the workspace root.");
  process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(rootLockPath, "utf8"));
const packages = lock.packages ?? {};
const rolldown = packages["node_modules/rolldown"] ?? packages["frontend/node_modules/rolldown"];

if (!rolldown) {
  console.error("rolldown is missing from the root workspace lockfile.");
  process.exit(1);
}

const linuxBinding = "@rolldown/binding-linux-x64-gnu";
const optionalBindings = rolldown.optionalDependencies ?? {};

if (!(linuxBinding in optionalBindings)) {
  console.error("rolldown is missing the linux-x64-gnu optional binding in the root workspace lockfile.");
  process.exit(1);
}

const bindingEntries = [
  `node_modules/${linuxBinding}`,
  `frontend/node_modules/${linuxBinding}`,
];

if (!bindingEntries.some((entry) => packages[entry])) {
  console.error("Root workspace lockfile is missing the linux-x64-gnu rolldown binding entry.");
  process.exit(1);
}

console.log("Workspace lockfile structure looks valid.");
