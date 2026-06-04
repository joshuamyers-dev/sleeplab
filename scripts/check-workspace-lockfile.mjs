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
const rootOptionalDependencies = lock.packages[""]?.optionalDependencies ?? {};
const rolldown = packages["node_modules/rolldown"] ?? packages["frontend/node_modules/rolldown"];
const lightningcss =
  packages["node_modules/lightningcss"] ?? packages["frontend/node_modules/lightningcss"];
const tailwindOxide =
  packages["node_modules/@tailwindcss/oxide"] ?? packages["frontend/node_modules/@tailwindcss/oxide"];

if (!rolldown) {
  console.error("rolldown is missing from the root workspace lockfile.");
  process.exit(1);
}

if (!lightningcss) {
  console.error("lightningcss is missing from the root workspace lockfile.");
  process.exit(1);
}

if (!tailwindOxide) {
  console.error("@tailwindcss/oxide is missing from the root workspace lockfile.");
  process.exit(1);
}

const requiredBindings = [
  {
    name: "@rolldown/binding-linux-x64-gnu",
    owner: "rolldown",
    dependencies: rolldown.optionalDependencies ?? {},
  },
  {
    name: "@tailwindcss/oxide-linux-x64-gnu",
    owner: "@tailwindcss/oxide",
    dependencies: tailwindOxide.optionalDependencies ?? {},
  },
  {
    name: "lightningcss-linux-x64-gnu",
    owner: "lightningcss",
    dependencies: lightningcss.optionalDependencies ?? {},
  },
];

for (const binding of requiredBindings) {
  if (!(binding.name in binding.dependencies)) {
    console.error(`${binding.owner} is missing the ${binding.name} optional binding in the root workspace lockfile.`);
    process.exit(1);
  }
}

for (const bindingName of Object.keys(rootOptionalDependencies).filter((name) =>
  name.includes("linux-x64-gnu")
)) {
  const bindingEntries = [`node_modules/${bindingName}`, `frontend/node_modules/${bindingName}`];

  if (!bindingEntries.some((entry) => packages[entry])) {
    console.error(`Root workspace lockfile is missing the ${bindingName} entry.`);
    process.exit(1);
  }
}

console.log("Workspace lockfile structure looks valid.");
