// 사주플러스 — 로그인 세션(claude-in-chrome) 게시판 크롤러
//
// 사용 절차 (javascript_tool로 saju.sajuplus.net 탭에서 실행):
//  1) 이 파일 전체를 한 번 실행 → 헬퍼 설치 + 백그라운드 크롤 시작 (동기로 await하면 45초 툴 타임아웃!)
//     BOARDS 배열만 원하는 게시판으로 수정.
//  2) 폴링: JSON.stringify({done: window.__PROG.done, counts: Object.fromEntries(Object.entries(window.__D).map(([k,v])=>[k,v.length]))})
//  3) done=true 후 반출 — 2단계 (탭당 자동 다운로드 1회 제한 우회):
//     (a) 이 탭에서:  localStorage.setItem('__sajudump', JSON.stringify(window.__D))
//     (b) "같은 origin"의 다른 탭(예: /robots.txt 열기)에서:
//         const s = localStorage.getItem('__sajudump');
//         const a = document.createElement('a');
//         a.href = URL.createObjectURL(new Blob([s])); a.download = 'sajuplus_dump.json';
//         document.body.appendChild(a); a.click();
//     (c) 파일 위치: C:\Users\Hwang\Google Drive 스트리밍\내 드라이브\Shared\  (Downloads 아님)
//     (d) 반출 후 양쪽 탭에서 localStorage.removeItem('__sajudump')
//  주의: 대용량을 javascript_tool 반환값으로 꺼내려 하지 말 것(10KB 잘림 + 쿼리스트링 차단).
//        페이지에서 127.0.0.1 fetch도 차단됨(PNA).

window.__D = window.__D || {};
window.__PROG = {done: false, board: null, log: []};

async function __crawlBoard(board, jong, maxPage) {
  const path = `/?curjong=${jong}&cstyle=4`;
  const D = window.__D[board] = []; const S = new Set();
  let empty = 0;
  for (let p = 1; p <= maxPage; p++) {
    let links = [];
    try {
      const doc = new DOMParser().parseFromString(await (await fetch(path + '&page=' + p, {credentials: 'include'})).text(), 'text/html');
      links = [...doc.querySelectorAll('a')]
        .filter(a => (a.getAttribute('href') || '').includes('acmode=b_s') && (a.getAttribute('href') || '').includes('curjong=' + jong))
        .map(a => [a.textContent.trim(), a.getAttribute('href')]);
    } catch (e) {}
    let fresh = 0;
    for (const [t, h] of links) {
      const no = (h.match(/[?&]no=(\d+)/) || [])[1] || h;
      if (S.has(no)) continue; S.add(no); fresh++;
      let txt = null;
      try {
        const d2 = new DOMParser().parseFromString(await (await fetch(h, {credentials: 'include'})).text(), 'text/html');
        d2.querySelectorAll('script,style,noscript').forEach(e => e.remove());
        const bc = d2.querySelector('#boardContent');
        if (bc) {
          bc.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
          bc.querySelectorAll('p,div,tr,li,h1,h2,h3,h4,table').forEach(e => e.append('\n'));
          txt = bc.textContent.replace(/https?:\/\/[^\s"']+/g, '').replace(/[ \t ]+/g, ' ')
                  .replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        }
      } catch (e) {}
      D.push(txt || ('▽' + t + '\n\n(본문 추출 실패)'));
      await new Promise(r => setTimeout(r, 50));
    }
    if (!fresh) { empty++; if (empty >= 2) break; } else empty = 0;
    await new Promise(r => setTimeout(r, 60));
  }
  window.__PROG.log.push(board + ':' + D.length);
}

(async () => {
  // 게시판 목록: [slug, curjong, 최대페이지+1]  — 필요에 맞게 수정
  const BOARDS = [
    ['chogeup', 'saju001011', 9],
    // ['junggeup1', 'saju001013', 11], ...
  ];
  for (const [b, j, mp] of BOARDS) { window.__PROG.board = b; await __crawlBoard(b, j, mp); }
  window.__PROG.done = true;
})();
'crawl started (background)'
