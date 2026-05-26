# Update NOTICE.md

When dependencies are added, removed, or upgraded, update `NOTICE.md` to reflect the change.

## Steps

1. Identify which dependency changed (Python in `pyproject.toml` / `requirements.txt`, frontend in `frontend/package.json`).

2. Determine the license of the new/updated dependency by checking:
   - The upstream repository's `LICENSE` file or PyPI/npm metadata
   - The `License` classifier in the package's `setup.cfg` / `pyproject.toml`

3. Update the appropriate table in `NOTICE.md`:
   - **Python Runtime** — `pyproject.toml` `[project] dependencies`, `api/requirements.txt`, root `requirements.txt`
   - **Python Development** — `pyproject.toml` `[dependency-groups] dev`
   - **Frontend Runtime** — `frontend/package.json` `dependencies`
   - **Frontend Development** — `frontend/package.json` `devDependencies`
   - **System Dependencies** — only for core platform deps (Postgres, Node, Python)

4. Preserve alphabetical order within each table.

5. If a dependency is removed, delete its row.

6. Commit with a message like `docs: update NOTICE.md for <dependency> license`.

## License compatibility reference

All licenses currently listed are compatible with GPL-3.0:

| SPDX Identifier | Name | Compatible |
|-----------------|------|------------|
| MIT | MIT License | ✅ Yes |
| BSD-2-Clause | BSD 2-Clause | ✅ Yes |
| BSD-3-Clause | BSD 3-Clause | ✅ Yes |
| Apache-2.0 | Apache License 2.0 | ✅ Yes |
| LGPL-3.0-or-later | LGPL v3+ with exceptions | ✅ Yes |
| PostgreSQL | PostgreSQL License | ✅ Yes |
| PSF | Python Software Foundation License | ✅ Yes |

If a new dependency uses a license not listed here, check gnu.org/licenses/license-list before adding it.
