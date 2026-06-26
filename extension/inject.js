// MAIN world trên facebook.com — đọc token + fb_dtsg + lsd trực tiếp từ window của trang,
// rồi postMessage cho content_fb.js (ISOLATED). Đây là cách lấy đúng phiên đăng nhập của user.
(function () {
  'use strict';

  function readCreds() {
    var token = null, dtsg = null, lsd = null;
    try { if (window.__accessToken && /^EAA/.test(window.__accessToken)) token = window.__accessToken; } catch (e) {}

    // fb_dtsg qua require('DTSGInitialData')
    try {
      var di = window.require && window.require('DTSGInitialData');
      if (di && di.token) dtsg = di.token;
    } catch (e) {}
    // lsd (một số GraphQL write cần)
    try {
      var ld = window.require && window.require('LSD');
      if (ld && ld.token) lsd = ld.token;
    } catch (e) {}

    // Tên + ID người dùng đang đăng nhập (để web app hiển thị "Đã kết nối: <tên>")
    var userName = null, userId = null;
    try {
      var cu = window.require && window.require('CurrentUserInitialData');
      if (cu) { userName = cu.NAME || null; userId = cu.USER_ID || cu.ACCOUNT_ID || null; }
    } catch (e) {}

    // Fallback regex từ HTML nếu require không có
    if (!token || !dtsg || !userName) {
      try {
        var html = document.documentElement.innerHTML;
        if (!token) { var mt = html.match(/"accessToken":"(EAA[^"]+)"/) || html.match(/window\.__accessToken="([^"]+)"/); if (mt) token = mt[1]; }
        if (!dtsg)  { var md = html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/) || html.match(/name="fb_dtsg" value="([^"]+)"/); if (md) dtsg = md[1]; }
        if (!lsd)   { var ml = html.match(/"LSD",\[\],\{"token":"([^"]+)"/); if (ml) lsd = ml[1]; }
        if (!userName) { var mn = html.match(/"NAME":"([^"]+)","SHORT_NAME"/) || html.match(/"USER_ID":"(\d+)"/); }
        if (!userName) { var mn2 = html.match(/"NAME":"([^"]+)"/); if (mn2) userName = mn2[1]; }
        if (!userId)   { var mi = html.match(/"USER_ID":"(\d+)"/); if (mi) userId = mi[1]; }
      } catch (e) {}
    }
    return { token: token, dtsg: dtsg, lsd: lsd, userName: userName, userId: userId };
  }

  function post() {
    var c = readCreds();
    // Cần ít nhất dtsg để write; token để read Graph. Gửi cả khi thiếu để content biết trạng thái.
    window.postMessage({ __shope: true, creds: c }, window.location.origin);
  }

  post();
  setTimeout(post, 1500);
  setTimeout(post, 4000);
})();
