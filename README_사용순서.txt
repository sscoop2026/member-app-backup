# 서산시소상공인연합회 회원앱 - 웹/PWA 테스트 세트

기존 Apps Script 앱은 건드리지 않고, 무료 웹주소(GitHub Pages 등)에 올려 테스트하는 파일입니다.

## 파일 구성
- `index.html` : 회원앱 화면
- `style.css` : 스타일
- `script.js` : 화면 동작 / API 호출 / 빨간점 / 회원증
- `manifest.webmanifest` : 홈화면 추가용 설정
- `service-worker.js` : PWA 기본 캐시
- `icon-192.png`, `icon-512.png` : 홈화면 아이콘
- `Code_api.gs` : 구글시트 데이터를 보내주는 Apps Script API 코드

## 적용 순서
1. Apps Script 새 프로젝트를 만들거나 기존 프로젝트를 복사합니다.
2. `Code_api.gs` 내용을 Apps Script의 `Code.gs`에 붙여넣습니다.
3. 웹앱으로 배포하고 `/exec` 주소를 복사합니다.
4. `script.js` 맨 위의 `API_URL`에 그 `/exec` 주소를 붙여넣습니다.
5. `index.html`, `style.css`, `script.js`, `manifest.webmanifest`, `service-worker.js`, 아이콘 2개를 GitHub Pages/Netlify 등에 올립니다.
6. 테스트 주소는 `https://무료주소/?code=테스트회원번호` 형태로 접속합니다.

## 회원 링크 방식
기존 회원번호는 그대로 씁니다.

예:
- 기존: `https://script.google.com/.../exec?code=A0001`
- 새 방식: `https://무료주소/?code=A0001`

회원 400명 링크는 수식으로 한 번에 만들면 됩니다.
