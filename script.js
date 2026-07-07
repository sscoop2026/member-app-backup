// ===== 설정 =====
// 1) Code_api.gs를 새 Apps Script 웹앱으로 배포한 뒤,
// 2) 아래 API_URL에 /exec 주소를 붙여넣으세요.
const API_URL = "https://script.google.com/macros/s/AKfycbx3DKfkzUCdlplSWCfIBSMZ9sXo1lDdHXqCk7dQDuub6ezPylFV3dIzeqMcW7jvsD2QXA/exec";

const NOTICE_READ_KEY_BASE = "seosan_notice_read_key_by_member_0701";
const MEMBER_CODE_STORAGE_KEY = "seosan_saved_member_code_0701";
let CURRENT_NOTICE_KEY = "";

window.addEventListener("DOMContentLoaded", function () {
  updateStoredMemberCode();
  updateNoticeBadge(false);
  loadNotices();
  loadPartners();
  loadMember();
  registerServiceWorker();
});

function updateStoredMemberCode() {
  const params = new URLSearchParams(window.location.search);
  const codeFromUrl = (params.get("code") || "").trim();

  if (codeFromUrl) {
    localStorage.setItem(MEMBER_CODE_STORAGE_KEY, codeFromUrl);
    sessionStorage.setItem(MEMBER_CODE_STORAGE_KEY, codeFromUrl);
    return codeFromUrl;
  }

  const savedCode =
    localStorage.getItem(MEMBER_CODE_STORAGE_KEY) ||
    sessionStorage.getItem(MEMBER_CODE_STORAGE_KEY) ||
    "";

  if (savedCode) {
    sessionStorage.setItem(MEMBER_CODE_STORAGE_KEY, savedCode);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("code", savedCode);
      window.history.replaceState({}, "", url.toString());
    } catch (e) {}

    return savedCode;
  }

  return "";
}

function getMemberCode() {
  return updateStoredMemberCode();
}

function apiRequest(action, params) {
  params = params || {};

  if (!API_URL || API_URL === "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    return Promise.reject(new Error("API_URL이 설정되지 않았습니다."));
  }

  return new Promise(function (resolve, reject) {
    const callbackName = "jsonp_cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const query = new URLSearchParams();

    query.set("action", action);
    query.set("callback", callbackName);

    Object.keys(params).forEach(function (key) {
      query.set(key, params[key]);
    });

    const script = document.createElement("script");
    const timeout = setTimeout(function () {
      cleanup();
      reject(new Error("API 요청 시간이 초과되었습니다."));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function (response) {
      cleanup();
      if (response && response.ok === false) {
        reject(new Error(response.error || "API 오류"));
        return;
      }
      resolve(response && response.data !== undefined ? response.data : response);
    };

    script.onerror = function () {
      cleanup();
      reject(new Error("API 스크립트를 불러오지 못했습니다."));
    };

    script.src = API_URL + "?" + query.toString();
    document.body.appendChild(script);
  });
}

function getNoticeReadKey() {
  const code = getMemberCode() || "NO_CODE";
  return NOTICE_READ_KEY_BASE + "_" + code;
}

function loadNotices() {
  apiRequest("getNotices")
    .then(function (notices) {
      const list = document.getElementById("noticeList");
      const fullList = document.getElementById("noticeListFull");
      const mainNotice = document.getElementById("mainNotice");

      if (mainNotice && notices && notices.length > 0) {
        mainNotice.textContent = notices[0]["제목"] || "등록된 주요 안내가 없습니다.";
      }

      if (!notices || notices.length === 0) {
        if (list) {
          list.innerHTML = `<div class="card"><p>등록된 공지사항이 없습니다.</p></div>`;
        }
        if (fullList) {
          fullList.innerHTML = `<div class="card"><p>등록된 지원사업이 없습니다.</p></div>`;
        }
        CURRENT_NOTICE_KEY = "";
        updateNoticeBadge(false);
        return;
      }

      let html = "";
      notices.forEach(function (item) {
        const category = escapeHtml(item["구분"] || "공지");
        const title = escapeHtml(item["제목"] || "");
        const content = escapeHtml(item["내용"] || "");
        const link = escapeAttr(item["링크"] || "");
        const button = escapeHtml(item["버튼명"] || "자세히 보기");

        html += `
          <div class="card">
            <span class="tag">${category}</span>
            <h3>${title}</h3>
            <p>${content}</p>
            <button class="btn" onclick="openLink('${link}')">${button}</button>
          </div>
        `;
      });

      if (list) list.innerHTML = html;
      if (fullList) fullList.innerHTML = html;

      CURRENT_NOTICE_KEY = makeNoticesKey(notices);
      checkNoticeBadge();
    })
    .catch(function () {
      const mainNotice = document.getElementById("mainNotice");
      if (mainNotice) mainNotice.textContent = "공지사항을 불러오지 못했습니다.";
    });
}

function makeNoticesKey(notices) {
  if (!notices || notices.length === 0) return "";

  const data = notices.map(function (item) {
    return {
      category: item["구분"] || "",
      title: item["제목"] || "",
      content: item["내용"] || "",
      link: item["링크"] || "",
      button: item["버튼명"] || ""
    };
  });

  return JSON.stringify(data);
}

function checkNoticeBadge() {
  const readKey = getNoticeReadKey();
  const lastReadKey = localStorage.getItem(readKey) || "";

  if (!CURRENT_NOTICE_KEY) {
    updateNoticeBadge(false);
    return;
  }

  updateNoticeBadge(CURRENT_NOTICE_KEY !== lastReadKey);
}

function updateNoticeBadge(show) {
  const badge = document.querySelector(".bell .badge");
  if (!badge) return;
  badge.style.display = show ? "block" : "none";
}

function openNoticeFromBell() {
  updateStoredMemberCode();
  showPage("noticePage");

  if (CURRENT_NOTICE_KEY) {
    const readKey = getNoticeReadKey();
    localStorage.setItem(readKey, CURRENT_NOTICE_KEY);
  }

  updateNoticeBadge(false);
}

function resetNoticeReadForTest() {
  const readKey = getNoticeReadKey();
  localStorage.removeItem(readKey);
  checkNoticeBadge();
}

function loadPartners() {
  apiRequest("getPartners")
    .then(function (partners) {
      const partnerPage = document.getElementById("partnerPage");
      if (!partnerPage) return;

      let html = `<div class="section"><h2>제휴업체</h2></div>`;

      if (!partners || partners.length === 0) {
        html += `<div class="card"><p>등록된 제휴업체가 없습니다.</p></div>`;
        partnerPage.innerHTML = html;
        return;
      }

      html += `<div class="partner-list">`;

      partners.forEach(function (item) {
        const name = escapeHtml(item["업체명"] || "");
        const benefit = escapeHtml(item["내용"] || "");
        const link = escapeAttr(item["링크"] || "");
        const buttonName = escapeHtml(item["버튼명"] || "자세히 보기");
        const iconClass = getPartnerIconClass(item["아이콘"] || item["업종"] || "");

        html += `
          <div class="partner-card">
            <div class="partner-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="partner-body">
              <h3 class="partner-name">${name}</h3>
              <p class="partner-benefit">${benefit}</p>
              <div class="partner-actions">
                <button class="partner-btn" onclick="openLink('${link}')">
                  ${buttonName}
                  <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      partnerPage.innerHTML = html;
    })
    .catch(function () {
      const partnerPage = document.getElementById("partnerPage");
      if (partnerPage) partnerPage.innerHTML = `<div class="section"><h2>제휴업체</h2></div><div class="card"><p>제휴업체를 불러오지 못했습니다.</p></div>`;
    });
}

function getPartnerIconClass(iconValue) {
  const raw = String(iconValue || "").trim();
  if (!raw) return "fa-handshake";

  const iconMap = {
    "호텔": "fa-hotel",
    "병원": "fa-hospital",
    "의료": "fa-hospital",
    "한의원": "fa-staff-snake",
    "치과": "fa-tooth",
    "약국": "fa-capsules",
    "식품": "fa-jar",
    "생강청": "fa-jar",
    "카페": "fa-mug-hot",
    "음식점": "fa-utensils",
    "외식": "fa-utensils",
    "미용": "fa-scissors",
    "의류": "fa-shirt",
    "자동차": "fa-car",
    "정비": "fa-screwdriver-wrench",
    "교육": "fa-graduation-cap",
    "쇼핑": "fa-bag-shopping",
    "마트": "fa-cart-shopping",
    "기타": "fa-handshake"
  };

  if (iconMap[raw]) return iconMap[raw];

  const normalized = raw
    .replace(/^fa-solid\s+/g, "")
    .replace(/^fa-/g, "")
    .replace(/[^a-zA-Z0-9-]/g, "");

  return normalized ? "fa-" + normalized : "fa-handshake";
}

function loadMember() {
  const code = getMemberCode();

  const memberName = document.getElementById("memberName");
  const memberCompany = document.getElementById("memberCompany");
  const companyRow = document.getElementById("companyRow");
  const memberPosition = document.getElementById("memberPosition");
  const memberStatus = document.getElementById("memberStatus");
  const memberTime = document.getElementById("memberTime");
  const memberLinkBtn = document.getElementById("memberLinkBtn");
  const memberQR = document.getElementById("memberQR");

  if (!code) {
    if (memberName) memberName.textContent = "회원정보 없음";
    if (companyRow) companyRow.style.display = "none";
    if (memberPosition) memberPosition.textContent = "";
    if (memberStatus) memberStatus.textContent = "";
    if (memberTime) memberTime.textContent = "";
    if (memberQR) memberQR.innerHTML = "";
    if (memberLinkBtn) memberLinkBtn.style.display = "none";
    return;
  }

  apiRequest("getMemberByCode", { code: code })
    .then(function (member) {
      if (!member) {
        if (memberName) memberName.textContent = "회원정보를 찾을 수 없습니다.";
        if (companyRow) companyRow.style.display = "none";
        if (memberPosition) memberPosition.textContent = "";
        if (memberStatus) memberStatus.textContent = "";
        if (memberTime) memberTime.textContent = "";
        if (memberQR) memberQR.innerHTML = "";
        if (memberLinkBtn) memberLinkBtn.style.display = "none";
        return;
      }

      const company = member["업체명"] || "";
      const position = member["직위"] || "";
      const status = member["회원상태"] || "";
      const verifyLink = member["업체확인용링크"] || window.location.href;

      if (memberName) memberName.textContent = member["회원명"] || "";

      if (memberCompany && companyRow) {
        if (company) {
          companyRow.style.display = "flex";
          memberCompany.textContent = company;
        } else {
          companyRow.style.display = "none";
          memberCompany.textContent = "";
        }
      }

const positionRow = document.getElementById("positionRow");

if (memberPosition && positionRow) {
  if (position) {
    positionRow.style.display = "flex";

    if (position === "정회원") {
      memberPosition.textContent = "회원구분 : 정회원";
    } else {
      memberPosition.textContent = "직위 : " + position;
    }

  } else {
    positionRow.style.display = "none";
    memberPosition.textContent = "";
  }
}
      if (memberStatus) {
        memberStatus.textContent = "회원상태 : " + status;
        memberStatus.classList.remove("status-normal", "status-out");
        if (status === "정상") memberStatus.classList.add("status-normal");
        else if (status === "탈퇴") memberStatus.classList.add("status-out");
      }

      if (memberTime) {
        memberTime.innerHTML = `조회시각<br>${formatNow()}`;
      }

      if (memberQR && verifyLink) {
        memberQR.innerHTML = `
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyLink)}"
            alt="QR코드"
            style="width:100%;height:100%;border-radius:10px;"
          >
        `;
      }

      if (memberLinkBtn) memberLinkBtn.style.display = "none";
    })
    .catch(function () {
      if (memberName) memberName.textContent = "회원정보를 불러오지 못했습니다.";
    });
}

function formatNow() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}.${m}.${d} ${h}:${min}:${s}`;
}

function openLink(url) {
  if (!url) return;
  window.open(url, "_blank");
}

function showPage(pageId, btn) {
  document.querySelectorAll(".page").forEach(function (page) {
    page.classList.remove("active");
  });

  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");

  document.querySelectorAll("nav button").forEach(function (button) {
    button.classList.remove("active");
  });

  if (btn) btn.classList.add("active");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(function (registration) {
        registration.update();
      })
      .catch(function () {});
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const installBtn = document.getElementById("installBtn");
  if (!installBtn) return;

  installBtn.addEventListener("click", function () {
    showHomeInstallChoice();
  });
});

function showHomeInstallChoice() {
  removeHomeInstallModal();

  const modal = document.createElement("div");
  modal.id = "homeInstallModal";
  modal.innerHTML = `
    <div class="home-install-backdrop" onclick="removeHomeInstallModal()"></div>
    <div class="home-install-box">
      <button class="home-install-close" onclick="removeHomeInstallModal()">×</button>
      <h3>📱 홈 화면에 추가하기</h3>
      <p>사용 중인 휴대폰을 선택해 주세요.</p>

      <button class="home-install-choice" onclick="showGalaxyInstallGuide()">
        🤖 갤럭시
      </button>

      <button class="home-install-choice" onclick="showIphoneInstallGuide()">
        🍎 아이폰
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

function showGalaxyInstallGuide() {
  alert(
`🤖 갤럭시

① 오른쪽 아래 점 세 개(⋮)를 누르세요.
② 현재 페이지 추가를 누르세요.
③ 홈 화면을 누르세요.
④ 추가를 누르면 완료됩니다.`
  );
}

function showIphoneInstallGuide() {
  alert(
`🍎 아이폰

① 오른쪽 아래 점 세 개(…)를 누르세요.
② 공유를 누르세요.
③ 더보기를 누르세요.
④ 홈 화면에 추가를 누르세요.
⑤ 오른쪽 위 추가를 누르면 완료됩니다.`
  );
}

function removeHomeInstallModal() {
  const modal = document.getElementById("homeInstallModal");
  if (modal) modal.remove();
}
function refreshMemberTime() {
  const memberTime = document.getElementById("memberTime");
  if (!memberTime) return;

  memberTime.innerHTML = `조회시각<br>${formatNow()}`;
}
