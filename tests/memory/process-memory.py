"""Read Windows working set and private committed bytes for Chrome's CDP PIDs."""
import ctypes
import json
import sys
from ctypes import wintypes


class ProcessMemory(ctypes.Structure):
    _fields_ = [
        ("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD),
        *[(name, ctypes.c_size_t) for name in (
            "PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage",
            "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage",
            "PagefileUsage", "PeakPagefileUsage", "PrivateUsage",
        )],
    ]


kernel = ctypes.WinDLL("kernel32", use_last_error=True)
psapi = ctypes.WinDLL("psapi", use_last_error=True)
kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel.OpenProcess.restype = wintypes.HANDLE
kernel.CloseHandle.argtypes = [wintypes.HANDLE]
psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessMemory), wintypes.DWORD]
result = []
for process in json.loads(sys.argv[1]):
    handle = kernel.OpenProcess(0x0400 | 0x0010, False, int(process["id"]))
    if not handle:
        raise OSError(f"Chrome {process['type']} PID {process['id']}: {ctypes.WinError(ctypes.get_last_error())}")
    try:
        memory = ProcessMemory()
        memory.cb = ctypes.sizeof(memory)
        if not psapi.GetProcessMemoryInfo(handle, ctypes.byref(memory), memory.cb):
            raise ctypes.WinError(ctypes.get_last_error())
        result.append({**process, "resident": memory.WorkingSetSize, "privateBytes": memory.PrivateUsage})
    finally:
        kernel.CloseHandle(handle)
print(json.dumps(result))
