"""Capture ONE window's composited pixels (PrintWindow, PW_RENDERFULLCONTENT). Never grabs the desktop.
Reads lines "<title substring>\t<out.png>" on stdin, answers one line each."""
import ctypes, sys
from ctypes import wintypes as w
from PIL import Image

u, g = ctypes.windll.user32, ctypes.windll.gdi32
try:
    u.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
except Exception:
    pass
u.GetWindowDC.restype = w.HDC; u.GetWindowDC.argtypes = [w.HWND]
u.ReleaseDC.argtypes = [w.HWND, w.HDC]
u.PrintWindow.argtypes = [w.HWND, w.HDC, ctypes.c_uint]
g.CreateCompatibleDC.restype = w.HDC; g.CreateCompatibleDC.argtypes = [w.HDC]
g.CreateCompatibleBitmap.restype = w.HBITMAP; g.CreateCompatibleBitmap.argtypes = [w.HDC, ctypes.c_int, ctypes.c_int]
g.SelectObject.argtypes = [w.HDC, w.HGDIOBJ]; g.SelectObject.restype = w.HGDIOBJ
g.DeleteObject.argtypes = [w.HGDIOBJ]; g.DeleteDC.argtypes = [w.HDC]
g.GetDIBits.argtypes = [w.HDC, w.HBITMAP, ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint]
PROC = ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)


def find(sub):
    hit = []

    def cb(h, _):
        if u.IsWindowVisible(h):
            b = ctypes.create_unicode_buffer(512)
            u.GetWindowTextW(h, b, 512)
            if sub in b.value:
                hit.append(h)
        return True

    u.EnumWindows(PROC(cb), 0)
    return hit[0] if hit else None


class BIH(ctypes.Structure):
    _fields_ = [('biSize', w.DWORD), ('biWidth', w.LONG), ('biHeight', w.LONG), ('biPlanes', w.WORD), ('biBitCount', w.WORD),
                ('biCompression', w.DWORD), ('biSizeImage', w.DWORD), ('x', w.LONG), ('y', w.LONG), ('cu', w.DWORD), ('ci', w.DWORD)]


def grab(h, out):
    r = w.RECT()
    u.GetWindowRect(h, ctypes.byref(r))
    W, H = r.right - r.left, r.bottom - r.top
    dc = u.GetWindowDC(h)
    m = g.CreateCompatibleDC(dc)
    bmp = g.CreateCompatibleBitmap(dc, W, H)
    old = g.SelectObject(m, bmp)
    ok = u.PrintWindow(h, m, 2)
    g.SelectObject(m, old)
    bi = BIH(40, W, -H, 1, 32, 0)
    buf = ctypes.create_string_buffer(W * H * 4)
    g.GetDIBits(m, bmp, 0, H, buf, ctypes.byref(bi), 0)
    g.DeleteObject(bmp); g.DeleteDC(m); u.ReleaseDC(h, dc)
    Image.frombuffer('RGB', (W, H), buf, 'raw', 'BGRX', 0, 1).save(out, compress_level=1)
    return f'ok {W} {H} {ok}'


for line in sys.stdin:
    try:
        sub, out = line.rstrip('\n').split('\t')
        h = find(sub)
        print(grab(h, out) if h else 'err nowindow', flush=True)
    except Exception as e:
        print('err', e, flush=True)
