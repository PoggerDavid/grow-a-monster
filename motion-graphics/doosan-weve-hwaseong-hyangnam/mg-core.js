/* ------------------------------------------------------------------
   mg-core.js  ·  초소형 모션그래픽 타임라인 엔진
   - window.seek(t)  : t초 시점의 프레임을 그림 (렌더러가 호출)
   - window.play()   : 브라우저 미리보기 (자동 반복)
   - ?t=1.25         : 특정 시점 정지 화면
   - ?alpha=1        : 배경(사진) 숨김 → 투명 오버레이 버전
   - ?loop=0         : 반복 없이 1회 재생
------------------------------------------------------------------- */
(function () {
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const E = {
    lin: x => x,
    out: x => 1 - Math.pow(1 - x, 3),
    in: x => x * x * x,
    inout: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    expo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    back: x => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    elastic: x => x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
    bounce: x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; }
  };
  /** 진행률 0..1 : t가 s에서 시작해 d초 동안 */
  const tw = (t, s, d, e = E.out) => e(clamp((t - s) / d));
  /** in → hold → out 형태의 가시성 0..1 */
  const win = (t, s, din, e, dout, ein = E.out, eout = E.in) =>
    t < e ? tw(t, s, din, ein) : 1 - tw(t, e, dout, eout);
  const lerp = (a, b, p) => a + (b - a) * p;
  const fmt = n => Math.round(n).toLocaleString('ko-KR');

  const params = new URLSearchParams(location.search);
  const ALPHA = params.get('alpha') === '1';
  if (ALPHA) document.documentElement.classList.add('alpha');

  let renderFn = null, duration = 0, fps = 30;
  window.MG = { E, tw, win, lerp, clamp, fmt, ALPHA,
    define(d, fn, f = 30) { duration = d; renderFn = fn; fps = f; window.MG_DURATION = d; window.MG_FPS = f; },
  };
  window.seek = t => { if (renderFn) renderFn(clamp(t, 0, duration)); window.__t = t; };
  window.play = () => {
    const loop = params.get('loop') !== '0';
    let start = performance.now();
    const step = now => {
      let t = (now - start) / 1000;
      if (t > duration + 0.6) { if (!loop) { seek(duration); return; } start = now; t = 0; }
      seek(t); requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  window.addEventListener('load', async () => {
    try { await document.fonts.ready; } catch (e) {}
    const fixed = params.get('t');
    if (fixed !== null) seek(parseFloat(fixed));
    else if (!window.__RENDER_MODE__) play();
    window.__MG_READY__ = true;
  });
})();
