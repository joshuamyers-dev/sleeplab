"""
App configuration endpoint.

GET /config  — returns server-side settings the frontend needs at runtime,
               including the display timezone for plot labels.
"""

import os

from fastapi import APIRouter

router = APIRouter()


@router.get("")
def get_config():
    """
    Return runtime configuration for the frontend.

    display_tz  IANA timezone name used to format all time labels in the UI
                (plot axes, event timeline, session start time).  Defaults to UTC.

    machine_tz  IANA timezone name the CPAP machine was set to when sessions
                were recorded.  The importer uses this to correctly interpret
                the naive local timestamps embedded in EDF files.  Defaults to UTC.
    """
    return {
        "display_tz": os.environ.get("DISPLAY_TZ", "UTC"),
        "machine_tz": os.environ.get("MACHINE_TZ", "UTC"),
    }
