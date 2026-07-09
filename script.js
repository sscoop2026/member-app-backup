const API_URL = "https://script.google.com/macros/s/AKfycbx3DKfkzUCdlplSWCfIBSMZ9sXo1lDdHXqCk7dQDuub6ezPylFV3dIzeqMcW7jvsD2QXA/exec";

const NOTICE_READ_KEY_BASE = "seosan_notice_read_key_by_member_0701";
const MEMBER_CODE_STORAGE_KEY = "seosan_saved_member_code_0701";

let CURRENT_NOTICE_KEY = "";
let CURRENT_NOTICES = [];
let PENDING_NOTICE_ID = "";

window.addEventListener("DOMContentLoaded", function () {
  PENDING_NOTICE_ID = getNoticeIdFromUrl();

  updateStoredMemberCode();
  updateNoticeBadge(false);
  registerServiceWorker();

  checkMemberBeforeAppStart();
});
function checkMemberBeforeAppStart() {
  const code = getMemberCode();

  if (!code) {
    if (PENDING_NOTICE_ID) {
      prepareNoticeDetailPage();
      showPage("noticeDetailPage");
    }

    loadNotices();
    loadPartners();
    loadMember();
    return;
  }

  apiRequest("getMemberByCode", { code: code })
    .then(function (member) {
      const status = member ? String(member["회원상태"] || "").trim() : "";

      if (status && status !== "정상") {
        showMemberBlockedGuide(status);
        return;
      }

      if (PENDING_NOTICE_ID) {
        prepareNoticeDetailPage();
        showPage("noticeDetailPage");
      }

      loadNotices();
      loadPartners();
      loadMember();
    })
    .catch(function () {
      loadNotices();
      loadPartners();
      loadMember();
    });
}

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
    return savedCode;
  }

  return "";
}

function getMemberCode() {
  return updateStoredMemberCode();
}

function getNoticeIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("notice") || "").trim();
}

function prepareNoticeDetailPage() {
  if (document.getElementById("noticeDetailPage")) return;

  const main = document.querySelector("main");
  if (!main) return;

  const section = document.createElement("section");
  section.className = "page";
  section.id = "noticeDetailPage";
  section.innerHTML = `
    <div class="section">
      <h2>공지사항</h2>
    </div>
    <div id="noticeDetailBox">
      <div class="card">
        <p>공지사항을 불러오는 중입니다...</p>
      </div>
    </div>
  `;

  main.insertBefore(section, main.firstChild);
}

function apiRequest(action, params) {
  params = params || {};

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

function getNoticeId(item) {
  return String(
    item["번호"] ||
    item["no"] ||
    item["NO"] ||
    item["No"] ||
    item["id"] ||
    item["ID"] ||
    ""
  ).trim();
}

function loadNotices() {
  apiRequest("getNotices")
    .then(function (notices) {
      const list = document.getElementById("noticeList");
      const fullList = document.getElementById("noticeListFull");
      const mainNotice = document.getElementById("mainNotice");

      CURRENT_NOTICES = notices || [];

      if (!notices || notices.length === 0) {
        if (mainNotice) mainNotice.textContent = "등록된 주요 안내가 없습니다.";
        if (list) list.innerHTML = `<div class="card"><p>등록된 공지사항이 없습니다.</p></div>`;
        if (fullList) fullList.innerHTML = `<div class="card"><p>등록된 지원사업이 없습니다.</p></div>`;
        renderNoticeDetailNotFound();
        CURRENT_NOTICE_KEY = "";
        updateNoticeBadge(false);
        return;
      }

      const activeNotices = notices.filter(function (item) {
        return String(item["상태"] || "진행중").trim() === "진행중";
      });

      if (mainNotice) {
        mainNotice.textContent = activeNotices.length > 0
          ? activeNotices[0]["제목"] || "등록된 주요 안내가 없습니다."
          : "현재 진행중인 공지사항이 없습니다.";
      }

      const homeNotices = activeNotices.slice(0, 3);

      if (list) {
        list.innerHTML = homeNotices.length === 0
          ? `<div class="card"><p>현재 진행중인 공지사항이 없습니다.</p></div>`
          : renderNoticeCards(homeNotices);
      }

      if (fullList) {
        fullList.innerHTML = renderNoticeCards(notices);
      }

      CURRENT_NOTICE_KEY = makeNoticesKey(notices);
      checkNoticeBadge();

      if (PENDING_NOTICE_ID) {
        renderNoticeDetail(PENDING_NOTICE_ID, notices);
      }
    })
    .catch(function () {
      const mainNotice = document.getElementById("mainNotice");
      if (mainNotice) mainNotice.textContent = "공지사항을 불러오지 못했습니다.";

      const detailBox = document.getElementById("noticeDetailBox");
      if (detailBox) {
        detailBox.innerHTML = `<div class="card"><p>공지사항을 불러오지 못했습니다.</p></div>`;
      }
    });
}

function renderNoticeDetail(noticeId, notices) {
  const detailBox = document.getElementById("noticeDetailBox");
  if (!detailBox) return;

  const target = notices.find(function (item) {
    return getNoticeId(item) === String(noticeId);
  });

  if (!target) {
    renderNoticeDetailNotFound();
    return;
  }

  detailBox.innerHTML = renderSingleNoticeCard(target);
  markNoticeAsRead();
}

function renderNoticeDetailNotFound() {
  const detailBox = document.getElementById("noticeDetailBox");
  if (!detailBox) return;

  detailBox.innerHTML = `
    <div class="card">
      <h3>공지사항을 찾을 수 없습니다.</h3>
      <p>해당 공지가 삭제되었거나 링크가 올바르지 않습니다.</p>
    </div>
  `;
}

function renderSingleNoticeCard(item) {
  const status = String(item["상태"] || "진행중").trim();
  const isClosed = status === "마감";

  const category = escapeHtml(item["구분"] || "공지");
  const title = escapeHtml(item["제목"] || "");
  const content = escapeHtml(item["내용"] || "");
  const link = escapeAttr(item["링크"] || "");
  const button = escapeHtml(item["버튼명"] || "자세히 보기");

  return `
    <div class="card ${isClosed ? "notice-closed" : ""}">
      <span class="tag">${category}</span>
      ${isClosed ? `<span class="tag notice-closed-tag">마감</span>` : ""}
      <h3>${title}</h3>
      <p>${content}</p>
      ${
        isClosed
          ? `<button class="btn notice-closed-btn" disabled>마감되었습니다</button>`
          : `<button class="btn" onclick="openLink('${link}')">${button}</button>`
      }
    </div>
  `;
}

function renderNoticeCards(notices) {
  let html = "";

  notices.forEach(function (item) {
    html += renderSingleNoticeCard(item);
  });

  return html;
}

function makeNoticesKey(notices) {
  if (!notices || notices.length === 0) return "";

  const ids = notices
    .map(function (item) {
      return Number(getNoticeId(item));
    })
    .filter(function (id) {
      return !isNaN(id);
    });

  if (ids.length === 0) return "";

  return String(Math.max.apply(null, ids));
}

function markNoticeAsRead() {
  if (!CURRENT_NOTICE_KEY) return;

  const readKey = getNoticeReadKey();
  localStorage.setItem(readKey, CURRENT_NOTICE_KEY);
  updateNoticeBadge(false);
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
  markNoticeAsRead();
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
      partners.reverse();

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
      if (partnerPage) {
        partnerPage.innerHTML = `<div class="section"><h2>제휴업체</h2></div><div class="card"><p>제휴업체를 불러오지 못했습니다.</p></div>`;
      }
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
  const positionRow = document.getElementById("positionRow");
  const memberPosition = document.getElementById("memberPosition");
  const memberStatus = document.getElementById("memberStatus");
  const memberTime = document.getElementById("memberTime");
  const memberLinkBtn = document.getElementById("memberLinkBtn");
  const memberQR = document.getElementById("memberQR");

  if (!code) {
    showMemberAccessGuide();
    return;
  }

  apiRequest("getMemberByCode", { code: code })
    .then(function (member) {
      if (!member) {
        showMemberAccessGuide("회원정보를 찾을 수 없습니다.");
        return;
      }

      const company = member["업체명"] || "";
      const position = member["직위"] || "";
      const status = member["회원상태"] || "";
      const verifyLink = member["업체확인용링크"] || window.location.href;

      if (status && status !== "정상") {
        showMemberBlockedGuide(status);
        return;
      }

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

      if (memberPosition && positionRow) {
        if (position) {
          positionRow.style.display = "flex";
          memberPosition.textContent = position === "정회원"
            ? "회원구분 : 정회원"
            : "직위 : " + position;
        } else {
          positionRow.style.display = "none";
          memberPosition.textContent = "";
        }
      }

      if (memberStatus) {
        memberStatus.textContent = "회원상태 : " + status;
        memberStatus.classList.remove("status-normal", "status-out");

        if (status === "정상") {
          memberStatus.classList.add("status-normal");
        } else if (status === "탈퇴") {
          memberStatus.classList.add("status-out");
        }
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
      showMemberAccessGuide("회원정보를 불러오지 못했습니다.");
    });
}

function showMemberAccessGuide(message) {
  const memberPage = document.getElementById("memberPage");
  if (!memberPage) return;

  memberPage.innerHTML = `
    <div class="section">
      <h2>모바일 회원증</h2>
    </div>
    <div class="card">
      <h3>모바일 회원증 이용 안내</h3>

      <p>현재 접속하신 링크는 공지사항 확인용 링크입니다.</p>

      <p>모바일 회원증은 회원 전용 앱을 이용해 주세요.</p>

      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;">

      <h3 style="margin-bottom:10px;">📞 문의</h3>

      <p>서산시소상공인연합회</p>

      <p>
      <a href="tel:0416639999" class="phone-btn">
  ☎ 041-663-9999
</a>
      </p>
    </div>
  `;
}

function showMemberBlockedGuide(status) {
  document.body.innerHTML = `
    <div class="phone">
      <main>
        <section class="page active">
          <div class="section">
            <h2>회원앱 이용 안내</h2>
          </div>

          <div class="card">
            <h3>회원님의 회원 자격이 종료되어<br>서비스를 이용하실 수 없습니다.</h3>

            <p>문의 : 서산시소상공인연합회</p>

            <a href="tel:0416639999" class="phone-btn">
              ☎ 041-663-9999
            </a>
          </div>
        </section>
      </main>
    </div>
  `;
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
  updateStoredMemberCode();

  if (pageId === "memberPage" && !getMemberCode()) {
    showMemberAccessGuide();
  }

  document.querySelectorAll(".page").forEach(function (page) {
    page.classList.remove("active");
  });

  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");

  document.querySelectorAll("nav button").forEach(function (button) {
    button.classList.remove("active");
  });

  if (pageId === "noticePage") {
    markNoticeAsRead();
  }

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

      <button class="home-install-choice" onclick="showGalaxyInstallGuide()">🤖 갤럭시</button>
      <button class="home-install-choice" onclick="showIphoneInstallGuide()">🍎 아이폰</button>
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
