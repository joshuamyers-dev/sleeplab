# Compliance Threshold Reference

SleepLab's compliance settings are configurable to match different insurer and clinical requirements. This document describes each setting, the defaults, and known configurations for common coverage scenarios.

## Settings

| Setting | Default | Description |
|---|---|---|
| `ADHERENCE_THRESHOLD_HOURS` | `4.0` | Minimum hours of CPAP use for a night to count as compliant. This is the primary threshold — nights at or above this value are classified as full compliance. |
| `ADHERENCE_BORDERLINE_HOURS` | *(unset)* | Optional lower bound enabling three-tier classification (compliant / borderline / non-compliant). When unset, nights are binary: compliant or not. |
| `ADHERENCE_TARGET_PCT` | `70.0` | Percentage of nights in a window that must be compliant for the window to "pass". |
| `ADHERENCE_WINDOW_DAYS` | `30` | Size of a single compliance evaluation window in days. |
| `ADHERENCE_EVALUATION_DAYS` | `90` | How many days back to search when looking for the best or most recent window. |
| `ADHERENCE_WINDOW_LOGIC` | `best_consecutive` | `best_consecutive`: sliding window finds the highest-compliance 30-day period within the evaluation window. `last_consecutive`: only the most recent window is evaluated. |
| `ADHERENCE_LOOKBACK_DAYS` | `90` | Days of history used for ongoing maintenance monitoring after the initial evaluation period. |

Defaults match [OSCAR](https://www.sleepfiles.com/OSCAR/) conventions and standard Medicare/CMS criteria.

---

## Known Configurations

These configurations reflect common payer and clinical patterns. Always verify with the specific plan — criteria change and vary by contract.

### Medicare / CMS (default)

The standard US Medicare compliance requirement for continued CPAP coverage.

| Setting | Value |
|---|---|
| Usage threshold | 4.0 hours |
| Target compliance | 70% |
| Window | 30 days |
| Evaluation period | 90 days |
| Window logic | `best_consecutive` |
| Maintenance lookback | 90 days |
| Borderline threshold | *(not used)* |

**Criteria:** ≥4 hours/night on ≥70% of nights in any consecutive 30-day window within the first 90 days.

---

### Private insurers following Medicare LCD

Most commercial plans that cover CPAP follow the Medicare LCD framework closely. The most common variations:

| Variation | Typical change |
|---|---|
| Stricter usage threshold | Some plans require ≥4 hours; a few require ≥5 or ≥6 hours. Adjust `ADHERENCE_THRESHOLD_HOURS`. |
| Last-window only | Some plans evaluate only the final 30-day window rather than the best window. Set `ADHERENCE_WINDOW_LOGIC=last_consecutive`. |
| Extended maintenance period | Plans monitoring long-term usage may look back 180 days instead of 90. Adjust `ADHERENCE_LOOKBACK_DAYS=180`. |
| Three-tier borderline | A handful of plans flag borderline usage (e.g., 3–3.9 hours) separately. Set `ADHERENCE_BORDERLINE_HOURS` to the lower bound of the borderline range. |

---

### Cigna-style

Cigna's criteria as of recent LCD guidance:

| Setting | Value |
|---|---|
| Usage threshold | 4.0 hours |
| Target compliance | 70% |
| Window | 30 days |
| Evaluation period | 90 days |
| Window logic | `last_consecutive` |
| Maintenance lookback | 180 days |
| Borderline threshold | *(optional — ~3.0 hours to show borderline zone)* |

---

### Clinical / research use

For tracking usage without insurance requirements, a common configuration:

| Setting | Value |
|---|---|
| Usage threshold | 4.0 hours (consistent with OSCAR default) |
| Target compliance | 70% |
| Window | 30 days |
| Evaluation period | 90 days |
| Window logic | `best_consecutive` |
| Borderline threshold | *(optional — e.g., 2.0 hours)* |

---

## Notes

- The 4-hour threshold originates from Medicare LCD L33718 and is the de facto industry standard.
- "Borderline" classification has no standardized payer definition — it exists in SleepLab to provide a visual warning zone on charts and is not itself used in pass/fail determination.
- Compliance percentages in PDF reports cite the applicable threshold so the methodology is transparent to the receiving clinician or reviewer.
