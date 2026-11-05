"""Read Windows physical memory and system commit without loading media."""
import ctypes
import json
import sys
import time
from ctypes import wintypes


class MemoryStatus(ctypes.Structure):
    _fields_ = [
        ("length", wintypes.DWORD),
        ("load", wintypes.DWORD),
        *[(name, ctypes.c_ulonglong) for name in (
            "totalPhysical", "availablePhysical", "totalPageFile", "availablePageFile",
            "totalVirtual", "availableVirtual", "availableExtendedVirtual",
        )],
    ]


while True:
    status = MemoryStatus()
    status.length = ctypes.sizeof(status)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        raise ctypes.WinError()
    print(json.dumps({
        "availablePhysical": status.availablePhysical,
        "physicalTotal": status.totalPhysical,
        "availableCommit": status.availablePageFile,
        "commitLimit": status.totalPageFile,
    }), flush=True)
    if "--watch" not in sys.argv:
        break
    time.sleep(1)
