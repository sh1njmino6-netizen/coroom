// coroom - PWA 설치 배너 / 오프라인 배너 / 서비스워커 등록
(function () {
  "use strict";

  const INSTALL_DISMISS_KEY = "coroom:installBannerDismissed";

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
  }

  // ===================== 서비스워커 등록 =====================
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.error("서비스워커 등록에 실패했습니다.", err);
      });
    });
  }

  // ===================== 오프라인 배너 =====================
  const offlineBanner = document.getElementById("offlineBanner");

  function updateOnlineStatus() {
    if (!offlineBanner) return;
    offlineBanner.classList.toggle("hidden", navigator.onLine);
  }
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  // ===================== 홈 화면에 추가 배너 =====================
  const installBanner = document.getElementById("installBanner");
  const installBannerText = document.getElementById("installBannerText");
  const installActionBtn = document.getElementById("installActionBtn");
  const installDismissBtn = document.getElementById("installDismissBtn");

  let deferredPrompt = null;

  function wasDismissedThisSession() {
    try {
      return sessionStorage.getItem(INSTALL_DISMISS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function markDismissed() {
    try {
      sessionStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch (e) {
      /* 저장 실패는 무시 */
    }
  }

  function showInstallBanner(mode) {
    if (!installBanner || isStandalone() || wasDismissedThisSession() || !isMobile()) return;
    if (mode === "android") {
      installBannerText.textContent = "coroom을 홈 화면에 추가하고 앱처럼 바로 실행해보세요.";
      installActionBtn.classList.remove("hidden");
    } else {
      installBannerText.textContent = "홈 화면에 추가하려면 하단 공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택하세요.";
      installActionBtn.classList.add("hidden");
    }
    installBanner.classList.remove("hidden");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner("android");
  });

  if (installActionBtn) {
    installActionBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBanner.classList.add("hidden");
    });
  }

  if (installDismissBtn) {
    installDismissBtn.addEventListener("click", () => {
      installBanner.classList.add("hidden");
      markDismissed();
    });
  }

  window.addEventListener("appinstalled", () => {
    installBanner.classList.add("hidden");
  });

  if (isIOS() && !isStandalone()) {
    // iOS Safari는 beforeinstallprompt를 지원하지 않으므로 안내 문구를 직접 띄운다
    window.addEventListener("load", () => {
      setTimeout(() => showInstallBanner("ios"), 1500);
    });
  }
})();
