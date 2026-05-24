# SleepLab — Third-Party Notices

**Version:** 1.0.0

## SleepyHead / OSCAR / cpap-parser

This project depends on **cpap-parser** as a key functional module for
multi-manufacturer CPAP data parsing. All SleepyHead/OSCAR-derived binary
parsing code lives in cpap-parser — SleepLab itself does not implement
any direct derivative of SleepyHead or OSCAR.

cpap-parser is a derivative of both the free and open-source software
**SleepyHead**, developed and copyright by Mark Watkins (Jedimark) (C) 2011-2018,
and the **OSCAR** project (https://gitlab.com/CrimsonNape/OSCAR-code), which is
itself a derivative of SleepyHead. The binary-format parsing logic in
cpap-parser's Rust extension module is ported from OSCAR. Both SleepyHead
and OSCAR are distributed under the GNU General Public License v3.0 (GPL-3.0),
which this project inherits accordingly.

### Redistribution Notice (added by Mark Watkins)

> Mark Watkins created this software to help lessen the exploitation of
> others. Seeing his work being used to exploit others is incredibly
> un-motivational, and incredibly disrespectful of all the work he put
> into this project.
>
> If you plan on reselling any derivatives of SleepyHead, I specifically
> request that you give due credit and link back, mentioning clearly in
> your advertising material, software installer and about screens that
> your derivative "is based on the free and open-source software
> SleepyHead, developed and copyright by Mark Watkins (C) 2011-2018."
>
> It is not enough to reference that your derivative "is based on GPL
> software".

---

## Python Dependencies

### Runtime

| Library | License |
|---------|---------|
| [fastapi](https://github.com/fastapi/fastapi) | MIT |
| [uvicorn](https://github.com/encode/uvicorn) | BSD-3-Clause |
| [sqlalchemy](https://github.com/sqlalchemy/sqlalchemy) | MIT |
| [psycopg2-binary](https://github.com/psycopg/psycopg2) | LGPL-3.0-or-later with exceptions |
| [PyJWT](https://github.com/jpadilla/pyjwt) | MIT |
| [passlib](https://github.com/glic3rinu/passlib) | BSD-3-Clause |
| [openai](https://github.com/openai/openai-python) | Apache-2.0 |
| [python-multipart](https://github.com/andrew-d/python-multipart) | Apache-2.0 |
| [httpx](https://github.com/encode/httpx) | BSD-3-Clause |
| [cpap-parser](https://gitlab.com/open-cpap/cpap-parser) | GPL-3.0-only |
| [sleephq-client](https://github.com/frohoff/sleephq-client) | MIT |
| [pydantic](https://github.com/pydantic/pydantic) | MIT |

### Development

| Library | License |
|---------|---------|
| [pytest](https://github.com/pytest-dev/pytest) | MIT |
| [ruff](https://github.com/astral-sh/ruff) | MIT |

---

## Frontend Dependencies

### Runtime

| Library | License |
|---------|---------|
| [react](https://github.com/facebook/react) | MIT |
| [react-dom](https://github.com/facebook/react) | MIT |
| [react-router-dom](https://github.com/remix-run/react-router) | MIT |
| [recharts](https://github.com/recharts/recharts) | MIT |

### Development

| Library | License |
|---------|---------|
| [vite](https://github.com/vitejs/vite) | MIT |
| [vitest](https://github.com/vitest-dev/vitest) | MIT |
| [typescript](https://github.com/microsoft/TypeScript) | Apache-2.0 |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | MIT |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | MIT |
| [eslint](https://github.com/eslint/eslint) | MIT |
| [@testing-library/react](https://github.com/testing-library/react-testing-library) | MIT |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | MIT |
| [jsdom](https://github.com/jsdom/jsdom) | MIT |

---

## System Dependencies

| Dependency | License |
|------------|---------|
| PostgreSQL 16 | PostgreSQL License |
| Node.js 20+ | MIT |
| Python 3.12+ | Python Software Foundation License |

*This list is maintained manually. When adding or updating dependencies,
please update this file to reflect the change.*
