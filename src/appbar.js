const koffi = require('koffi');

const ABM_NEW = 0x00000000;
const ABM_REMOVE = 0x00000001;
const ABM_QUERYPOS = 0x00000002;
const ABM_SETPOS = 0x00000003;
const ABE_TOP = 1;

const WM_USER = 0x0400;
const APPBAR_CALLBACK = WM_USER + 0x0101;

const shell32 = koffi.load('shell32.dll');
const user32 = koffi.load('user32.dll');

const RECT = koffi.struct('RECT', {
  left: 'long',
  top: 'long',
  right: 'long',
  bottom: 'long'
});

const APPBARDATA = koffi.struct('APPBARDATA', {
  cbSize: 'uint32',
  hWnd: 'void *',
  uCallbackMessage: 'uint32',
  uEdge: 'uint32',
  rc: RECT,
  lParam: 'intptr'
});

const SHAppBarMessage = shell32.func(
  'uintptr_t __stdcall SHAppBarMessage(uint32 dwMessage, _Inout_ APPBARDATA *pData)'
);

const GetSystemMetrics = user32.func(
  'int __stdcall GetSystemMetrics(int nIndex)'
);

const SM_CXSCREEN = 0;
const SM_CYSCREEN = 1;

function hwndFromBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf)) {
    throw new Error('hwnd buffer required');
  }
  return koffi.as(buf, 'void *');
}

function buildAppBarData(hwndBuf, extras = {}) {
  return {
    cbSize: 48,
    hWnd: hwndFromBuffer(hwndBuf),
    uCallbackMessage: APPBAR_CALLBACK,
    uEdge: ABE_TOP,
    rc: { left: 0, top: 0, right: 0, bottom: 0 },
    lParam: 0,
    ...extras
  };
}

function registerAppBar(hwndBuf, height) {
  const screenWidth = GetSystemMetrics(SM_CXSCREEN);

  const data = buildAppBarData(hwndBuf);
  const newRet = SHAppBarMessage(ABM_NEW, data);
  if (newRet === 0) {
    throw new Error('SHAppBarMessage(ABM_NEW) failed');
  }

  const queryData = buildAppBarData(hwndBuf, {
    rc: { left: 0, top: 0, right: screenWidth, bottom: height }
  });
  SHAppBarMessage(ABM_QUERYPOS, queryData);

  const finalRect = {
    left: 0,
    top: queryData.rc.top,
    right: screenWidth,
    bottom: queryData.rc.top + height
  };

  const setData = buildAppBarData(hwndBuf, { rc: finalRect });
  SHAppBarMessage(ABM_SETPOS, setData);

  return setData.rc;
}

function repositionAppBar(hwndBuf, height) {
  const screenWidth = GetSystemMetrics(SM_CXSCREEN);
  const queryData = buildAppBarData(hwndBuf, {
    rc: { left: 0, top: 0, right: screenWidth, bottom: height }
  });
  SHAppBarMessage(ABM_QUERYPOS, queryData);

  const finalRect = {
    left: 0,
    top: queryData.rc.top,
    right: screenWidth,
    bottom: queryData.rc.top + height
  };
  const setData = buildAppBarData(hwndBuf, { rc: finalRect });
  SHAppBarMessage(ABM_SETPOS, setData);
  return setData.rc;
}

function unregisterAppBar(hwndBuf) {
  const data = buildAppBarData(hwndBuf);
  SHAppBarMessage(ABM_REMOVE, data);
}

module.exports = {
  registerAppBar,
  unregisterAppBar,
  repositionAppBar
};
