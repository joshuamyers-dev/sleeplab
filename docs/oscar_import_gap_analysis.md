# OSCAR Import Gap Analysis

## Executive summary

SleepLab currently imports a useful but narrow subset of ResMed SD card data: detailed EDF files found under `DATALOG/YYYYMMDD`. Compared with OSCAR, the biggest missing pieces are device identity, root-level ResMed summary/settings files, durable machine records, settings history, manufacturer-specific leak semantics, and a vendor-neutral importer architecture.

Strategic goal: SleepLab should become a web-native OSCAR alternative that sits between SleepHQ and OSCAR. SleepHQ is convenient, cloud/web-first, and broadly accessible, but it is not trying to expose the full machine-level detail OSCAR users expect. OSCAR is deep, vendor-aware, and clinically useful, but it is a desktop application with local-profile workflows. SleepLab's opportunity is to combine OSCAR-like data depth with web-native access, APIs, reports, automation, and sharing.

The most important answer: yes, SleepLab is missing important data by only using the ResMed `DATALOG` folder. `DATALOG` contains the high-value detailed signal files, but OSCAR also requires the card root `STR.edf` plus `Identification.tgt` or `Identification.json` for reliable machine identity, model detection, settings, summary-only days, mask-on/off boundaries, and fallback timing repair. Ignoring those files makes SleepLab more fragile around multi-machine users, summary-only ResMed devices, settings display, leak interpretation, duplicate/import identity, and corrupted or shifted EDF timestamps.

SleepLab should not port OSCAR code directly. The useful path is to copy the architecture ideas: detect a card root, parse device identity before sessions, persist a machine table, keep settings as historical per-session facts, treat unknown signals as diagnostics, and make vendor support pluggable.

## Product positioning: between SleepHQ and OSCAR

SleepLab should not become only a SleepHQ clone and should not become a literal browser copy of OSCAR. The better target is a web-native bridge:

| Product | Strength | Limitation | SleepLab lesson |
|---|---|---|---|
| SleepHQ | Web access, sharing, friendly reports, easier user workflow, broad CPAP-user appeal | Less transparent about raw source files, machine quirks, settings history, and importer internals | Keep the web convenience, sharing, and low-friction workflow |
| OSCAR | Deep local analysis, multi-manufacturer loaders, machine profiles, settings history, channel/event taxonomy, waveform detail, import diagnostics | Desktop/local workflow, harder to automate/share, less web-native | Use OSCAR as the reference behavior for CPAP domain modeling |
| SleepLab | Already has web UI, API, local imports, SleepHQ import, trends, event inspector, waveform snippets, oximetry, AI summaries, notes/tags, equipment tracking, and PDF export | Core data model is still too ResMed/DATALOG/session-summary shaped | Build a vendor-neutral CPAP data platform underneath the existing web app |

This framing changes how future work should be judged. A good PR should move SleepLab closer to the middle ground:

- as easy to access and automate as a web app;
- as honest and source-aware as OSCAR;
- agnostic to manufacturer at the core;
- explicit about what data is available, missing, guessed, or unsupported;
- strong enough for reports, trends, AI summaries, and future UI without hiding machine-specific caveats.

## Product direction: web-based OSCAR, data first

The long-term direction should be a web-based SleepLab that can answer most of the same questions OSCAR answers, while using web-native storage, APIs, reports, and eventually UI. The immediate gap is not the GUI. It is the data foundation underneath the GUI.

OSCAR's strength is that imports create a durable clinical record: machine identity, profile, sessions, settings, channels, events, summaries, waveforms, slices, and source-device context are separate but connected. SleepLab has many good pieces already, but several PRs have added user-facing capabilities on top of a still-flat CPAP session model. The next phase should make each feature feed into a shared CPAP data model instead of becoming one more isolated summary.

Practical principle: every import, scoring, report, adherence, notes, tags, AI, oximetry, and chart feature should attach to stable data concepts:

- `machine`: manufacturer, model, serial, firmware, loader/parser, source device family.
- `import_run`: what was uploaded or scanned, what files were found, what was used, what was skipped, parser confidence, warnings.
- `session`: machine-scoped therapy interval with wall-clock range, machine timezone, source session key, duration semantics, and source files.
- `session_block`: split blocks inside a night, gaps, source file groups, mask-on/off ranges.
- `settings_snapshot`: therapy mode, pressures, EPR/Flex/relief, ramp, humidification, mask, and effective time.
- `signal_channel`: vendor-normalized metrics and waveforms with units, sample rate, leak semantics, and source labels.
- `event`: stable identity, source annotation, normalized type, onset, duration, and confidence.
- `derived_value`: large leak, AHI, pressure percentiles, adherence, therapy score, summaries, and report facts with provenance.

That is how the existing PR stream can become more OSCAR-like without waiting for a major frontend rewrite.

## Current SleepLab import assumptions

SleepLab's local CPAP import path is centered on `importer/import_sessions.py` and `importer/edf_parser.py`.

- The CLI and server path require a `--datalog` path, and `run_local_import()` raises `DATALOG path not found` when that folder is absent.
- Session discovery scans only numeric date folders under `DATALOG` and only `*.edf` files whose names split into date, time, and file type.
- `discover_session_blocks()` requires `PLD` and pairs each `PLD` timestamp with the most recent preceding `CSL`; `EVE`, `BRP`, and `SA2`/`SAD` are optional.
- `derive_summary()` computes AHI, event counts, average/p95 pressure, average leak, respiratory rate, tidal volume, minute ventilation, snore, and flow limitation from PLD and EVE files.
- The importer sets `manufacturer` to the literal `ResMed`, stores `device_serial` from EDF recording metadata, and leaves `therapy_mode`, `mask_type`, `humidity_level`, and `temperature_c` as `None`.
- Machine timezone is user configured. EDF header times are treated as naive machine-local wall time, then localized to the selected `machine_tz`.
- Events are deduped in memory by rounded event type, onset, and duration; database re-import replaces all events and metrics for the session.
- BRP waveform storage is event-window focused, not full-night. This is pragmatic for SleepLab's Event Inspector but not OSCAR parity.

Schema and API assumptions:

- `schema.sql` has a flat `sessions` table with `device_serial`, `manufacturer`, summary values, `machine_tz`, and a unique `(user_id, session_id)`.
- `session_events`, `session_metrics`, `session_spo2`, and `session_waveform` hang directly off `sessions`.
- There is no first-class CPAP machine/device table and no per-session settings history table.
- `api/therapy_score.py` only knows a ResMed large leak threshold, 24 L/min, and excludes leak scoring for unknown manufacturers.
- `api/routers/stats.py` derives large leak minutes as `session_metrics.leak >= 24`, which conflicts with SleepLab storing ResMed PLD leak in L/s elsewhere and is likely a unit correctness risk.

## OSCAR import architecture findings

Relevant OSCAR components inspected:

- `oscar/main.cpp`: registers loader modules for PRS1, ResMed, DeVilbiss IntelliPAP, Fisher & Paykel ICON/SleepStyle, Weinmann/Lowenstein Prisma, Resvent, BMC, BMC G3X, vREM, Yuwell, CMS50/CMS50F/MD300W1 oximeters, Viatom, and others.
- `oscar/SleepLib/machine_loader.h` and `.cpp`: base `MachineLoader` and `CPAPLoader` classes, task queueing, loader registration, and `finishAddingSessions()`.
- `oscar/SleepLib/profiles.cpp`: `lookupMachine(serial, loadername)` and `CreateMachine(info)` are used by loaders to attach imports to a durable machine identity.
- `oscar/SleepLib/machine.cpp`: `Machine::AddSession()` rejects duplicate session IDs for a machine and routes sessions by machine identity.
- `oscar/SleepLib/session.cpp`: stores session settings, channels, event lists, summarized channel values, respiratory events, and summary statistics; on re-store, existing settings/channels/slices/events for that session are removed/replaced to avoid duplicates.
- `oscar/database/*_repository.*` and `oscar/database/database_schema.cpp`: normalized SQLite schema with `profiles`, `machines`, `sessions`, `session_settings`, `session_channels`, `session_channel_values`, `event_lists`, `event_data`, `respiratory_events`, `session_summaries`, and `session_slices`.
- `oscar/SleepLib/importcontext.*`: newer loader isolation layer for machine creation, session creation, unexpected-data reporting, and unsupported/untested-device handling.

OSCAR's manufacturer-agnostic detection and import flow:

1. At startup, each vendor/device loader registers itself with `RegisterLoader()`. Each loader owns `Detect()`, `PeekInfo()`, `Open()`, channel registration, and vendor-specific parsing.
2. The import scanner gets all CPAP loaders with `GetLoaders(MT_CPAP)` and calls every loader's `Detect(path)` against candidate mount points or the selected folder.
3. Detection uses structural signatures rather than a manufacturer dropdown. Examples: ResMed requires root `DATALOG` plus `STR.edf`; PRS1 finds a case-insensitive `P-Series` directory and device folders containing `PROP*.TXT` or `PROP.BIN`; SleepStyle checks its ICON structure and machine summary marker; Prisma checks its configuration/export files; BMC G3X detects its format while explicitly excluding legacy BMC layouts.
4. After detection, `PeekInfo()` reads enough metadata to identify the machine without performing the full import. Depending on the vendor this includes serial, model, model number, series, firmware, data-format version, and other properties.
5. `Open()` canonicalizes the selected path, discovers one or more machines on the card, looks up an existing machine by serial plus loader or creates it, then parses vendor files into shared OSCAR machine/session/channel/event concepts.
6. Vendor loaders keep responsibility for file layout, units, settings codes, firmware variants, and event semantics. Shared storage and analysis operate on normalized channels and machine-scoped sessions.
7. Unknown models, firmware, signals, and parse anomalies are reported as diagnostics. They are not silently converted into apparently trustworthy generic values.

SleepLab should adopt this flow in web form. A detector registry can inspect an uploaded archive, mounted path, or extracted card; return one or more `DetectedDevice` candidates with confidence and evidence; then dispatch to the matching adapter. `cpap-parser`, native Python code, or a future parser service are implementation choices behind those adapters, not the organizing principle of the application.

ResMed-specific architecture:

- `oscar/SleepLib/loader_plugins/resmed_loader.cpp` detects a ResMed card root by requiring both `DATALOG` and root `STR.edf`.
- `PeekInfo()` and `parseIdentFile()` parse `Identification.json` for AirSense/AirCurve 11 style cards and `Identification.tgt` for older cards.
- `scanProductObject()` reads JSON `SerialNumber`, `ProductCode`, and `ProductName`; `parseIdentLine()` maps TGT fields such as `SRN`, `PNA`, and `PCD`.
- `Open()` accepts either the card root or `DATALOG`, strips `DATALOG` back to the root, validates identification and `STR.edf`, then looks up or creates a `Machine` by serial plus loader.
- `fetchSTRandVerify()` checks that `STR.edf` belongs to the identified serial.
- OSCAR copies root `Identification.*`, `STR.edf`, `STR.edf.gz`, and `DATALOG` content into backup/import storage.
- OSCAR imports root `STR.edf` records before detailed EDF files. `STR.edf` supplies daily summaries, settings, mask-on/off intervals, pressure statistics, respiratory statistics, leak summaries, and summary-only sessions.
- `ResDayTask::run()` builds session groups from detailed EDF overlaps, applies day-wide EVE/CSL events to sessions, stores settings from `STR.edf`, and falls back to previous settings or guessed PAP mode when detailed files have no matching STR record.
- `repairEDFStartFromSession()` treats STR/session mask-on time as authoritative when detailed EDF headers are invalid or implausibly far away.
- `LoadBRP()`, `LoadPLD()`, `LoadSAD()`, `LoadEVE()`, and `LoadCSL()` parse distinct EDF families. Unknown/unobserved ResMed signals are logged rather than fatal.
- `StoreSettings()` persists therapy mode, CPAP/APAP/Bilevel/ASV pressure settings, EPR, ramp, smart start/stop, mask, patient view/access, humidifier, climate control, tube/filter, temperature, trigger/cycle, Ti min/max, rise time, and comfort settings when present.

Signal architecture:

- OSCAR has shared channel IDs for events and metrics, including obstructive apnea, clear airway, hypopnea, RERA, CSR, large leak spans, leak flags, flow rate, mask pressure, therapy pressure, EPAP/EPR pressure, flow limitation, snore, respiratory rate, tidal volume, minute ventilation, I:E ratio, target ventilation, total leak, and oximetry pulse/SpO2.
- ResMed `PLD` maps `Leak.2s` to OSCAR's unintentional leak channel (`CPAP_Leak`), not total leak. Other vendors may report total leak (`CPAP_LeakTotal`) or explicit large-leak spans.
- OSCAR's schema distinguishes event lists and waveform/event binary blobs from session summaries, so it can keep high-resolution data without flattening everything into one metrics table.

## Current PR stream and how to shape it

This report should not treat the importer in isolation. SleepLab has already accumulated useful features that can become an OSCAR-like data platform if they are pointed at shared data concepts.

| PR or feature area | Current direction | OSCAR-like data opportunity | Recommendation |
|---|---|---|---|
| #114 multi-manufacturer `cpap-parser` import | Queued open PR for non-ResMed import, machine equipment tracking, `manufacturer`, `data_source`, and `parser_validated` provenance | Strong start for vendor adapters and machine identity, but it should be an adapter into SleepLab's normalized data model rather than a parallel import world | Build on it if merged; keep native ResMed for now; require normalized leak semantics, import diagnostics, parser confidence, and machine-scoped sessions |
| #116 adherence tracking and reports | Queued adherence thresholds, adherence stats endpoint, PDF adherence report | Adherence should be derived from authoritative session intervals and settings, not just the current session summary shape | Gate adherence/report facts on corrected session duration, split-session handling, timezone, machine identity, and import provenance |
| #117 event/chart domain fixes | Merged split-session event and night metric fixes | Good foundation for session blocks and source event ranges | Extend into explicit `session_block` and source event identity instead of more heuristics |
| #113 timezone chart fix and earlier timezone settings | Merged timezone handling improvements | OSCAR-like imports need machine wall-clock handling, date-boundary rules, and correction history | Preserve user timezone settings, but add machine/import timezone provenance and timing diagnostics |
| #105 therapy score and #141 manufacturer aggregation fix | Merged scoring and manufacturer aggregation behavior | Therapy score should become a derived value with inputs, units, thresholds, and manufacturer-specific rules | Add derived-value provenance and fix ResMed leak units before expanding scoring to other vendors |
| #106 PDF session export | Merged report output | Reports should read from normalized session, settings, signals, events, and derived values | Keep report generation downstream of the data model; avoid report-only calculations that bypass stored provenance |
| #104 notes and #107 tags | Merged user annotations | Annotations become more useful when anchored to machine/session/event identities | Keep notes/tags session-scoped now, but design migrations so event-level and machine-level annotations are possible later |
| #103 import job status | Merged job-state visibility | This can grow into OSCAR-like import diagnostics and import history | Promote from job status to `import_run` with file manifest, warnings, parser used, skipped files, and source identity |
| #78 O2 ring import and SpO2 session work | Merged oximetry capabilities | OSCAR treats oximeters as device-backed data streams connected to sessions | Add oximeter device identity, synchronization metadata, and provenance when CPAP/oximetry overlays are stored |
| #80 AI analysis cache | Merged cached analysis | AI results should be derived artifacts with source data versions | Store which session/events/settings/signals were analyzed so imports or corrected metrics can invalidate stale analysis |
| #28/#29 equipment tracking/API/UI | Merged equipment groundwork | Can become the non-CPAP side of machine/profile history | Keep equipment separate from CPAP machine identity, but link mask/device settings to session settings over time |
| #110/#111/#112/#119 docs and generated docs | Merged documentation foundation | Useful place to document import contracts, channel semantics, and data guarantees | Add architecture docs for normalized CPAP data, parser adapter rules, and source provenance |

The older draft PR #44 and issue #38 are useful history, but #114 is the current queued implementation to plan around. If #114 merges, the next SleepLab work should harden and adapt it. If it stalls, reuse the design lessons: provenance fields, machine equipment linkage, parser validation flags, and non-ResMed adapter boundaries.

Decision rules for future PRs:

- Do not make ResMed versus non-ResMed the core routing abstraction. Follow OSCAR's loader-registry pattern: each adapter detects its own card/file signatures, peeks machine identity, reports capabilities, and imports into one normalized SleepLab model.
- Treat `cpap-parser` as a candidate shared implementation of multiple OSCAR-derived adapters, not as an untouchable external boundary. Reproduce its reported bugs with fixtures, fix them upstream or in a temporary SleepLab-maintained fork, and converge on it where its output can be validated.
- Keep the current native ResMed adapter only as a working implementation and regression oracle while parser parity is built. It should not dictate the normalized schema, and it does not need to remain a permanent parallel path once `cpap-parser` reaches verified parity.
- Require every claimed parser limitation to link to a reproducible fixture, failing test, upstream issue, and expected OSCAR behavior. "Known bugs" without those artifacts should not become long-term architecture.
- Any PR that adds a metric, report, score, or AI summary should say which source signals/settings/events it depends on and how stale values are recalculated after re-import.
- Any PR that touches sessions should preserve a path toward machine-scoped uniqueness and split-session/block identity.
- Any PR that adds user-visible health interpretation should include unit and manufacturer semantics, especially leak.

## OSCAR-style features SleepLab can grow toward

This analysis is not only an importer gap list. SleepLab already has several OSCAR-like pieces. The issue is that many of them currently sit on a flat session/summary model, so they cannot yet answer the same depth of questions OSCAR can answer.

| OSCAR-style capability | What SleepLab actually does today | Current code/data evidence | What is still missing for OSCAR-like depth |
|---|---|---|---|
| Daily detailed review | Has session detail pages, metrics endpoints, event timeline/inspector, event-window waveform, SpO2 charting, notes, tags, and timezone correction | `frontend/src/pages/SessionDetail.tsx`, `frontend/src/components/EventInspector.tsx`, `EventTimeline.tsx`, `MetricsChart*.tsx`, `SpO2Chart.tsx`; `api/routers/sessions.py` exposes detail, events, event windows, metrics, breath, SpO2, note, tags, timezone | Explicit `session_block` records, stable source event identity, waveform provenance, channel units/sample rates, and full wall-clock therapy ranges |
| Overview and trends | Has dashboard, calendar, trends page, overview stats, event breakdown, therapy metrics, SpO2 metrics, and equipment age | `frontend/src/pages/Dashboard.tsx`, `Calendar.tsx`, `Trends.tsx`; `api/routers/stats.py`; `models.OverviewDailyStat` | Machine/mode/mask/settings filters, time-weighted summaries, derived-value provenance, import-confidence filters |
| Statistics and clinical summaries | Has `therapy_score`, dashboard summary stats, PDF session export, and queued adherence/reporting work | `api/therapy_score.py`, `api/routers/stats.py`, PDF logic in `api/routers/sessions.py`, PR #116 | Correct leak semantics, settings history, manufacturer thresholds, adherence rule provenance, recalculation after re-import |
| Adherence/compliance | Trends page references adherence concepts; #116 queues configurable adherence thresholds and PDF adherence reports | `frontend/src/pages/Trends.tsx`; PR #116 | Authoritative therapy intervals, date-boundary rules, split-session handling, machine identity, import completeness flags |
| Machine/profile history | Stores `device_serial`, `manufacturer`, user equipment catalog, session therapy/equipment fields, and local import timezone settings | `schema.sql`, migrations `008`, `009`, `016`, `021`; `api/routers/equipment.py`; `frontend/src/pages/Equipment.tsx` | First-class CPAP machine table, model/product code/firmware, machine-scoped session uniqueness, settings/device history |
| Settings timeline | Has some session fields for `therapy_mode`, `mask_type`, humidity, and temperature, but ResMed import leaves many of these null | `schema.sql`; migration `009`; `importer/import_sessions.py` sets settings fields mostly `None`; SleepHQ import maps some machine settings | ResMed `Identification.*` and `STR.edf` parsing, parser-backed settings normalization, `settings_snapshot` storage |
| Leak analysis | Stores average leak, has therapy-score leak component and overview large leak minutes | `api/therapy_score.py`; `api/routers/stats.py`; `session_metrics.leak` | Unit correctness, leak kind, total vs unintentional leak, manufacturer thresholds, explicit large-leak spans |
| Event taxonomy and flags | Imports ResMed EVE annotations, dedupes events, exposes event APIs and UI, and has duplicate-event migration | `importer/edf_parser.py`, `importer/import_sessions.py`, `api/routers/sessions.py`, migration `020_dedupe_session_events.sql` | Stable source event identity, source file/block, confidence, CSL/CSR mapping, vendor-normalized taxonomy |
| Waveform/channel browser | Stores event-window BRP waveform samples and exposes event-window waveform response | `session_waveform`, migration `013_add_session_waveform.sql`, `replace_waveforms_for_block()`, `get_event_window()` | Channel registry, retained-window manifest, sample rates/units, optional full-night waveform storage or range loading |
| Oximetry integration | Supports ResMed SA2/SAD SpO2 plus uploaded Viatom/Wellue/O2Ring-like files and wearable SpO2 overlays | `importer/edf_parser.py`, `session_spo2`, `api/oximeter.py`, `api/routers/upload.py`, `api/routers/wearable.py`, `SpO2Chart.tsx` | Oximeter device identity, CPAP/oximetry clock alignment metadata, source provenance, reusable overlay rules |
| Import audit and support diagnostics | Has DATALOG upload flow, local path import settings, background status, and oximeter per-file import results | `api/routers/upload.py`, `api/routers/import_settings.py`, `frontend/src/pages/Import.tsx`, `Settings.tsx` | Durable `import_run`, file manifest, root files found/skipped, parser used, warnings, unsupported signals, parser confidence |
| Notes, tags, and annotations | Has nightly notes, preset tags, tag insights, and session-level update APIs | migrations `018`, `019`; `api/routers/sessions.py`; `SessionDetail.tsx` | Event-level annotations, machine-level annotations, stable anchors across re-imports |
| Compare nights | Can navigate between sessions and inspect trends, but does not have first-class side-by-side night comparison | `frontend/src/pages/sessionNavigation.ts`, `Trends.tsx`, `Calendar.tsx` | Comparable normalized summaries, settings snapshots, channel registry, pre/post setting-change grouping |
| Custom thresholds and preferences | Has timezone, local path, LLM, wearable, SleepHQ settings; #116 proposes adherence thresholds | `api/settings_store.py`, `api/routers/config.py`, `frontend/src/pages/Settings.tsx`, PR #116 | Per-user/per-machine scoring thresholds, manufacturer leak rules, derived-value rule provenance |
| Data export and backup | Has PDF session export and generated documentation, but not a normalized data export or source manifest | `api/routers/sessions.py`; docs build scripts | Portable normalized export, anonymized fixture generation, import source manifest, derived-value provenance |
| AI and explanation | Has session AI cards, trend AI, LLM provider settings, and AI analysis cache | `api/routers/ai_summary.py`, `api/llm_client.py`, migration `017_ai_analysis_cache.sql`, `SessionAICard.tsx`, `Trends.tsx` | Cache invalidation based on source data version, settings/event provenance in prompts, auditable source facts |
| Multi-vendor support | Native local import is ResMed DATALOG-focused; SleepHQ import can bring in broader summarized data; #114 queues parser-backed non-ResMed support | `importer/import_sessions.py`, `importer/sleephq_import.py`, issue #38, PR #114 | Vendor adapter contract, machine identity, leak semantics, channel registry, parser validation, native ResMed root-file depth |

The backend priority is not to tell contributors "SleepLab lacks everything." It is to show that many user-visible pieces already exist, then make future PRs strengthen the shared data underneath those pieces. The frontend can stay modest for now; the important work is making sure each feature leaves behind data that can be queried, explained, recalculated, compared, and trusted.

## ResMed SD card coverage comparison

| Data/file area | Used by OSCAR? | Used by SleepLab? | What data it contains | User-visible value | Implementation difficulty | Recommendation |
|---|---:|---:|---|---|---|---|
| Card root detection | Yes | No | Root `DATALOG`, `STR.edf`, `Identification.*` | Prevents importing the wrong folder and enables full-card diagnostics | Low | P0: accept card root and locate `DATALOG` plus root files |
| `Identification.tgt` | Yes | No | Older ResMed serial, product name, product code/model number | Reliable model/serial and multi-machine identity | Low to medium | P0/P1: parse and persist identity |
| `Identification.json` | Yes | No | AirSense/AirCurve 11 serial, product code, product name | Supports newer ResMed model detection | Low to medium | P0/P1: parse first when present |
| `STR.edf` | Yes | No | Summary records, settings, mask-on/off times, leak/pressure/respiratory percentiles, event summary counts | Settings history, summary-only days, better timing, better reports | Medium to high | P1: parse selected identity/settings/summary fields, not full OSCAR parity |
| `STR.edf.gz` and `STR_Backup` | Yes | No | Prior summary/settings snapshots | Re-import history and backup recovery | Medium | P3: useful after core STR support |
| `DATALOG/YYYYMMDD/*_PLD.edf` | Yes | Yes | 2-second pressure, leak, respiratory, snore, flow limitation data | Main graphs and summary stats | Already present | Keep, but normalize units and signal aliases |
| `DATALOG/YYYYMMDD/*_BRP.edf` | Yes | Partial | Flow and pressure high-resolution waveform | Event review and waveform detail | Medium | P1: keep event-window strategy; add availability diagnostics |
| `DATALOG/YYYYMMDD/*_EVE.edf` | Yes | Yes | Scored apnea/hypopnea/RERA/desat annotations | AHI/event timeline | Already present | Keep; improve event identity and mapping |
| `DATALOG/YYYYMMDD/*_CSL.edf` | Yes | Header only plus event pairing | CSR/periodic breathing style annotations and timing anchor | Better event/session alignment | Medium | P1: parse CSL events or explicitly document what is skipped |
| `DATALOG/YYYYMMDD/*_SAD.edf` / `*_SA2.edf` | Yes | Yes | ResMed oximetry accessory pulse and SpO2 | Oxygen overlay and score component | Already present | Keep; add diagnostics when present but empty |
| CRC files | Yes for backup/validation context | No | Integrity companions | Import confidence | Medium | P3: report presence; defer validation |
| Unknown EDF signals | Logged | Mostly ignored by label mismatch | New firmware/localized labels | Import diagnostics and supportability | Low | P1: record skipped/unknown labels in import diagnostics |

## Manufacturer/device support comparison

| Manufacturer/device family | OSCAR support level | SleepLab support level | Key file formats/data sources | Notes/risk |
|---|---|---|---|---|
| ResMed S9/AirSense/AirCurve | Mature | Partial | Root `Identification.*`, root `STR.edf`, `DATALOG` EDF families | SleepLab uses detailed files but misses identity/settings/summary/root validation |
| Philips Respironics PRS1/DreamStation | Mature OSCAR loader | None | `P-Series`/PRS1 properties and binary session files via PRS1 parser | Different event and leak semantics; high value but large effort |
| Philips Respironics M Series | Legacy/import path in OSCAR | None | M Series files | Lower priority unless users request legacy data |
| Fisher & Paykel ICON | OSCAR loader | None | F&P ICON files | Often total leak, not ResMed unintentional leak |
| Fisher & Paykel SleepStyle | OSCAR loader | None | SleepStyle EDF/info files | Has total leak and optional calculated unintentional leak behavior |
| Lowenstein/Weinmann Prisma | OSCAR loader | None | Prisma/Weinmann files | Complex settings and signals; medium/high effort |
| DeVilbiss IntelliPAP | OSCAR loader | None | IntelliPAP files | Mostly older devices; total leak style data |
| BMC Luna and BMC G3X | OSCAR loaders | None | `.USR`, `.idx`, `.evt`, `.00x` and parsed binary structures | OSCAR notes show active reverse engineering and firmware caveats |
| Resvent iBreeze | OSCAR loader | None | Resvent files/config/events | Needs separate settings/event mapping |
| Yuwell BreathCare | OSCAR loader | None | Multiple card formats A-D | OSCAR detects several revisions; not a small add |
| Viatom/Wellue, CMS50, MD300W1 oximeters | OSCAR oximeter loaders | Partial Viatom-like oximeter upload | Binary oximeter files | SleepLab already has independent oximeter parsing, but not OSCAR's device model |
| Zeo/Dreem/Somnopose/vREM | OSCAR non-CPAP loaders | None | Sleep stage or respiratory effort data | Out of scope for CPAP import parity |

## Missing metadata

SleepLab does not currently persist these ResMed fields reliably:

- Manufacturer beyond a hard-coded session value.
- Machine model/product name.
- Model number/product code.
- Stable machine identity separate from `sessions.device_serial`.
- Firmware/software version where available by vendor.
- Device family/loader name.
- Therapy mode from the machine settings.
- CPAP/APAP pressure min/max and fixed pressure.
- EPAP/IPAP/pressure support min/max for bilevel/ASV devices.
- EPR/pressure relief enablement and level.
- Ramp enablement, ramp time, and ramp start pressure.
- Humidifier enablement and level.
- Climate control, tube temperature, tube/filter settings.
- Mask setting/type.
- SmartStart/SmartStop and patient access/view settings.
- Trigger/cycle/Ti/rise-time settings for bilevel modes.
- Device profile/history showing when settings changed.
- Source card root, files found, files used, and files skipped.
- Machine clock correction or drift history.

SleepLab has `machine_tz`, but it is a user-selected import setting rather than a source-derived or machine-specific history. OSCAR does not magically solve timezone either, but it has device-time correction concepts and uses STR/session boundaries as a timing sanity check for ResMed EDF files.

## Missing signals or derived values

High-value gaps:

- Large leak duration should be based on the correct unit and manufacturer-specific semantics. ResMed `Leak.2s` is unintentional leak, typically thresholded at 24 L/min. SleepLab's overview SQL appears to compare `sm.leak >= 24` while importer summary and therapy score treat leak as L/s, so large leak minutes may be wrong by a factor of 60.
- Total leak versus unintentional leak is not modeled. This is essential before adding Fisher & Paykel, Philips, DeVilbiss, BMC, Yuwell, or SleepStyle data.
- Settings history is absent, so pressure changes, mode changes, EPR changes, humidity changes, and mask settings cannot be displayed or analyzed.
- STR summary percentiles and summary-only days are ignored. Some ResMed devices or days may have useful summary data without detailed EDF blocks.
- Session block identity is based on folder date plus PLD time and unique per user. There is no machine dimension, so two machines/users importing same local day/time pattern could collide within a user.
- Event identity is not sourced from file name, block, event channel, or absolute source timestamp. Current replacement is mostly idempotent for full-session re-imports but does not preserve stable event IDs for UI references.
- CSL/CSR data is not fully imported as a signal/event channel.
- Unknown signal labels are silently skipped unless the parser user notices absent metrics.
- Waveform coverage is intentionally event-window only. That is fine for current UI, but SleepLab should expose whether full-night BRP existed and what windows were retained.
- Oximetry integration is split between ResMed SA2/SAD and uploaded Viatom-like files. There is no device-level oximeter identity/history.
- Pressure statistics use simple averages and percentile indexing from samples. OSCAR increasingly uses time-weighted summaries; SleepLab should confirm percentile methodology.

## Data correctness risks in SleepLab

- Assuming `DATALOG` alone is enough misses ResMed card identity, model, settings, root summary, and mask-on/off anchors.
- Missing model/manufacturer details make leak scoring and user reports lower confidence.
- `session_id` unique by `(user_id, session_id)` creates a multi-machine collision risk. OSCAR keys sessions under a machine.
- Large leak duration likely has a unit bug in `api/routers/stats.py`, where leak is compared to `24` despite ResMed parser values being L/s and therapy score converting L/s to L/min.
- Root `STR.edf` can repair corrupt or implausible detailed EDF start times in OSCAR; SleepLab trusts EDF headers plus a user timezone.
- Split-session handling is improved but still heuristic: SleepLab pairs PLD with the most recent CSL and filters events by block window, while OSCAR groups overlapping detailed files and applies day-wide EVE/CSL annotations across sessions.
- Settings/profile files are missing, so SleepLab cannot explain nights where therapy mode or pressure changed.
- Event dedupe by rounded type/onset/duration may collapse legitimate duplicate events or fail to provide stable event identity across imports.
- Unknown localized labels or new firmware signals can disappear silently.
- SleepLab currently hard-codes ResMed for all local DATALOG imports, so accidental non-ResMed folder import has poor diagnostics.
- SleepLab cannot distinguish summary-only ResMed data from truly missing detailed data.

## Recommended roadmap

### P0 / correctness and data contracts

These are the small, high-leverage fixes that stop SleepLab from building more features on ambiguous data.

1. Fix large leak unit handling. Store explicit leak units/semantics or convert ResMed `Leak.2s` consistently to L/min for threshold SQL, therapy score, reports, and charts.
2. Define a normalized CPAP import contract. Importers should emit machine identity, sessions, blocks, settings snapshots, channels, events, waveforms, derived summaries, source files, units, and warnings.
3. Promote import job status into import diagnostics. Record card root, `DATALOG`, `STR.edf`, `Identification.*`, files found/used/skipped, unknown labels, parser used, parser confidence, and missing required files.
4. Add machine identity groundwork compatible with #114: manufacturer, loader/parser, vendor family, serial, model, product code, firmware/version, and a path to `sessions.machine_id`.
5. Make event identity/idempotency explicit using session, source file/block, event type, onset, duration, and source timestamp.
6. Require derived values to carry provenance: input signal, unit, threshold rule, manufacturer rule, and recalculation behavior after re-import.

### P1 / deepen current ResMed data

These make the existing ResMed path more OSCAR-like without taking on a whole-vendor rewrite.

1. Accept a ResMed card root in addition to a direct `DATALOG` path, and validate root identity when available.
2. Parse ResMed `Identification.tgt` and `Identification.json` for serial/model/product code before importing sessions.
3. Parse a selected subset of root `STR.edf`: therapy mode, pressure settings, EPR, ramp, humidifier, mask, mask-on/off, summary duration, and summary leak/pressure statistics.
4. Persist settings history per session or effective date, so reports and future UI can explain what machine configuration produced a night.
5. Add CSL/CSR import or explicit diagnostics that CSL was used only as a timing anchor.
6. Improve waveform availability metadata: full BRP existed, retained event windows, skipped because no events, parse failures.

### P2 / multi-machine and non-ResMed adapter strategy

This is where queued `cpap-parser` work should fit. The goal is an OSCAR-inspired loader registry, not a permanent ResMed/non-ResMed split and not two incompatible import systems.

1. Define `Detect`, `PeekInfo`, `Capabilities`, and `Import` adapter contracts modeled on OSCAR's loader lifecycle.
2. If #114 merges, refactor its routing behind that contract. If it stalls, preserve its machine tracking, `manufacturer`, `data_source`, `parser_validated`, and parser-backed test work.
3. Build a parser conformance suite using anonymized cards and expected OSCAR results. Reproduce and fix `cpap-parser` defects instead of treating them as permanent exclusions.
4. Keep the native ResMed path as a regression oracle during convergence, then retire duplicate parsing when the shared adapter proves equivalent or better.
5. Add machine-scoped session uniqueness before broad vendor support. OSCAR keys sessions under machines; SleepLab should do the same before importing multiple devices for one user.
6. Define leak semantics per manufacturer/device: unintentional leak, total leak, explicit large leak events, or unknown.
7. Add a vendor/channel registry that maps parser or source labels to SleepLab normalized channel names, units, sample rates, settings, and thresholds.
8. Validate every adapter against OSCAR behavior at the level of identity, session boundaries, settings, summaries, events, leak interpretation, waveform coverage, and time handling.

### P3 / web OSCAR parity foundations

These are not urgent, but they are the platform capabilities that will make later frontend work meaningful.

1. Import source backup manifest and optional CRC/integrity validation.
2. STR backup history and historical root summary re-import.
3. Full-night high-resolution waveform retention or compressed storage strategy.
4. Advanced device clock drift correction history and date-boundary diagnostics.
5. Rich channel registry with localized label aliases, units, thresholds, and per-vendor mappings.
6. Device-linked oximetry history and synchronization metadata.
7. Analysis cache invalidation keyed by imported source data versions.

## Candidate implementation tickets

### 1. Define the normalized CPAP import contract

- User value: every importer, report, score, and future UI consumes the same stable facts.
- Files likely touched: `docs/`, `importer/`, tests; possibly typed Python dataclasses before schema changes.
- Data model impact: documents future `machine`, `import_run`, `session_block`, `settings_snapshot`, channel, event, and derived-value shapes.
- Risk: too broad if it tries to migrate everything immediately.
- Suggested tests: contract fixtures for ResMed native import and parser-backed non-ResMed import produce the same normalized object families.

### 2. Fix ResMed leak units and large leak duration

- User value: large leak minutes, therapy score, adherence/report narratives, and future comparison charts become trustworthy.
- Files likely touched: `importer/import_sessions.py`, `importer/db.py`, `api/routers/stats.py`, `api/therapy_score.py`, tests.
- Data model impact: add or document `leak_unit` and `leak_kind`; preferably store derived large leak with provenance.
- Risk: existing UI labels and historical imported values may need migration or recalculation.
- Suggested tests: ResMed `Leak.2s` sample values around 0.4 L/s produce threshold at 24 L/min; unknown manufacturer excludes leak scoring.

### 3. Turn import job status into import diagnostics

- User value: users can see whether SleepLab imported a complete card, partial card, parser-backed upload, or unsupported data.
- Files likely touched: `api/routers/upload.py`, `importer/import_sessions.py`, database migration, import tests; frontend can consume this later.
- Data model impact: optional `import_runs` and `import_run_files` tables or a JSON diagnostic artifact.
- Risk: avoid storing sensitive absolute local paths by default.
- Suggested tests: card root with DATALOG only, card root with Identification and STR, unknown EDF label, empty SA2/SAD, parser-backed non-ResMed import.

### 4. Persist machine identity and machine-scoped session identity

- User value: two machines can coexist without collisions; reports, adherence, and settings history can explain device changes.
- Files likely touched: `schema.sql`, `migrations/`, `importer/db.py`, `api/routers/sessions.py`, equipment API if #114 lands, tests.
- Data model impact: new `cpap_machines` table or compatible extension of #114 equipment records; `sessions.machine_id`; eventual unique `(user_id, machine_id, source_session_id)`.
- Risk: migration of existing flat sessions and overlap with #114.
- Suggested tests: same user imports two serials with same date/time session id; historical sessions retain serial/manufacturer; #114 parser sessions link to the same machine concept.

### 5. Parse ResMed identification files and selected STR settings

- User value: SleepLab can display real device model and nightly settings, and it can explain changes in pressure/mode/EPR/ramp/humidity/mask over time.
- Files likely touched: `importer/edf_parser.py`, new `importer/resmed_identification.py`, new `importer/resmed_str.py`, `importer/import_sessions.py`, migrations.
- Data model impact: `cpap_machines` fields and `session_settings` table or JSON settings snapshot.
- Risk: older TGT, newer JSON, and STR EDF signal variants differ across device generations and locales.
- Suggested tests: TGT `SRN`/`PNA`/`PCD`, JSON `SerialNumber`/`ProductName`/`ProductCode`, fixture STR with APAP min/max, CPAP fixed pressure, EPR, ramp, humidity, mask; missing fields warn instead of crashing.

### 6. Adapt #114 into an OSCAR-style loader registry

- User value: SleepLab can identify and import supported machines through one predictable flow, regardless of manufacturer.
- Files likely touched: depends on #114 merge shape; likely `importer/`, `migrations/013_add_manufacturer_and_source.sql` or successor migrations, `api/routers/equipment.py`, session APIs, tests.
- Data model impact: add detected-device evidence, adapter identity/version, capabilities, `manufacturer`, `data_source`, validation status, machine records, and normalized parser output.
- Risk: parser output may not include all OSCAR-level settings/signals; multiple adapters may recognize the same path; fixture coverage may initially be uneven.
- Suggested tests: detection fixtures for ResMed, PRS1, Lowenstein, Fisher & Paykel, and BMC; ambiguous/unknown cards; parser-backed imports with stable machine identity, source provenance, event counts, summaries, settings, and leak semantics.

### 7. Improve session block, event identity, and waveform provenance

- User value: fewer duplicate/missing events, stable event inspector links after re-import, clearer explanation of waveform availability.
- Files likely touched: `importer/import_sessions.py`, `importer/db.py`, migration for source identity columns/index, waveform APIs.
- Data model impact: source file, source block, source onset/duration identity on `session_events`; `session_blocks`; waveform retention metadata.
- Risk: existing event rows need replacement strategy.
- Suggested tests: day-wide EVE applied to multiple PLD blocks, duplicate TALs, same event onset in adjacent sessions, BRP present but no retained event window.

### 8. Make adherence, therapy score, PDF, and AI outputs derived artifacts

- User value: reports and scores remain explainable after import fixes, re-imports, and multi-machine support.
- Files likely touched: `api/therapy_score.py`, adherence PR files if #116 lands, PDF export, AI analysis cache, tests.
- Data model impact: optional `derived_values` or at least stored provenance/version metadata for generated artifacts.
- Risk: may feel indirect, but it prevents future "why did this number change?" confusion.
- Suggested tests: derived outputs update after re-import; stale AI/report cache invalidates when session metrics/events/settings change.

### 9. Add CSL/CSR support

- User value: periodic breathing/CSR visibility and better event context.
- Files likely touched: `importer/edf_parser.py`, `importer/import_sessions.py`, `schema.sql`, session APIs.
- Data model impact: new event types or channel category.
- Risk: annotation labels vary.
- Suggested tests: CSL annotation fixture maps to CSR spans and does not double-count AHI.

### 10. Document vendor/channel semantics

- User value: contributors know how to add manufacturers without breaking ResMed or scoring.
- Files likely touched: `docs/`, then `importer/` package structure later.
- Data model impact: formal definitions for `manufacturer`, `loader`, `source_format`, `leak_kind`, units, sample rates, settings keys, and unsupported-data behavior.
- Risk: docs can drift unless tied to tests.
- Suggested tests: fixture-based channel registry tests for ResMed and one parser-backed non-ResMed vendor.

## Top 5 recommended next PRs

1. Define the normalized CPAP import contract and source-provenance rules, then require future importer/report/scoring PRs to target it.
2. Fix ResMed leak unit correctness and large leak duration for current imports, because therapy score, reports, and adherence all depend on this.
3. Promote import job status into import diagnostics with files found/used/skipped, parser/source, unknown signals, warnings, and validation confidence.
4. Add machine identity and machine-scoped session uniqueness in a way that either builds on #114 if merged or can absorb it cleanly later.
5. Add ResMed root identification plus selected `STR.edf` settings/history, keeping native ResMed import while using `cpap-parser` for non-ResMed devices.

## Source references

SleepLab PR and issue context:

- [#114 multi-manufacturer CPAP import via cpap-parser](https://github.com/joshuamyers-dev/sleeplab/pull/114): current queued non-ResMed parser work, machine equipment tracking, provenance fields, and parser validation notes.
- [#116 adherence tracking, configurable thresholds, and PDF adherence reports](https://github.com/joshuamyers-dev/sleeplab/pull/116): current queued adherence/reporting work that should depend on corrected session identity and duration semantics.
- [#44 multi-manufacturer CPAP import via open-cpap-parser](https://github.com/joshuamyers-dev/sleeplab/pull/44): older closed draft predecessor to #114.
- [#38 multi-manufacturer CPAP import issue](https://github.com/joshuamyers-dev/sleeplab/issues/38): tracks the multi-vendor parser goal.
- Merged data/reporting foundations: #117 event/chart domain fixes, #113 timezone chart fix, #105 therapy score, #141 therapy score manufacturer aggregation, #106 PDF session export, #103 import job status, #104 session notes, #107 session tags, #78 O2 ring import, #80 AI analysis cache, #28/#29 equipment tracking/API.
- Merged documentation/quality foundations: #110 user/API docs, #111 backend docstrings, #112 frontend JSDoc, #119 generated docs/images, #142 Docker lockfile fix.

SleepLab files:

- `importer/import_sessions.py`: DATALOG-only entry point, block discovery, summary derivation, timezone localization, event filtering, waveform import.
- `importer/edf_parser.py`: ResMed EDF/EDF+ parser for PLD, BRP, EVE, and SA2/SAD.
- `importer/db.py`: session upsert, event/metric/waveform replacement, event dedupe.
- `api/routers/upload.py`: DATALOG upload and background import path.
- `api/routers/sessions.py`: session aggregation, manufacturer fallback, event/window/metric APIs, timezone correction.
- `api/routers/stats.py`: overview and large leak minute calculation.
- `api/therapy_score.py`: ResMed-only large leak threshold for scoring.
- `schema.sql`, `migrations/020_dedupe_session_events.sql`, `migrations/021_add_session_manufacturer.sql`: current persistence model and event uniqueness.

OSCAR files:

- `oscar/main.cpp`: loader registration.
- `oscar/SleepLib/machine_loader.h`, `oscar/SleepLib/machine_loader.cpp`: base loader architecture.
- `oscar/SleepLib/importcontext.h`, `oscar/SleepLib/importcontext.cpp`: import context and unexpected data handling.
- `oscar/SleepLib/profiles.cpp`: machine lookup and creation.
- `oscar/SleepLib/machine.h`, `oscar/SleepLib/machine.cpp`: machine identity, duplicate session rejection, clock correction hooks.
- `oscar/SleepLib/session.h`, `oscar/SleepLib/session.cpp`: session settings, channel summaries, event storage, respiratory events, database replacement.
- `oscar/SleepLib/schema.cpp`, `oscar/SleepLib/machine_common.*`: shared channel taxonomy, leak/total leak/large leak/oximetry/respiratory channels.
- `oscar/SleepLib/loader_plugins/resmed_loader.cpp`, `resmed_loader.h`, `resmed_EDFinfo.*`: ResMed detection, identification parsing, STR handling, detailed EDF parsing, settings storage, timing repair.
- `oscar/SleepLib/loader_plugins/prs1_*`, `sleepstyle_loader.*`, `icon_loader.*`, `prisma_loader.*`, `bmc*_loader.*`, `resvent_loader.*`, `yuwell_loader.*`: examples of vendor-specific file detection and signal/settings mapping.
- `oscar/database/database_schema.cpp` and repository classes: normalized machine/session/settings/channel/event storage.
