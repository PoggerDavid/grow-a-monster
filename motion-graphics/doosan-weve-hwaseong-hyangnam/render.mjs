/* ------------------------------------------------------------------
   render.mjs · HTML 모션그래픽 → 영상 파일 렌더러 (Playwright + ffmpeg)

   사용법:
     node render.mjs intro            # output/intro.mp4 (배경 포함, H.264)
     node render.mjs outro --alpha    # output/outro_alpha.mov (ProRes 4444, 투명 배경)
     node render.mjs intro --webm     # output/intro_alpha.webm (VP9, 투명 배경)
     node render.mjs all              # 전부

   환경변수:
     FFMPEG=/path/to/ffmpeg   (기본: imageio-ffmpeg 또는 PATH 의 ffmpeg)
------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'output');
fs.mkdirSync(outDir, { recursive: true });

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execSync('python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"').toString().trim(); } catch {}
  return 'ffmpeg';
}
const FFMPEG = findFfmpeg();

const args = process.argv.slice(2);
const names = args.filter(a => !a.startsWith('--'));
const ALPHA = args.includes('--alpha');
const WEBM = args.includes('--webm');
const FPS = Number((args.find(a => a.startsWith('--fps=')) || '--fps=30').split('=')[1]);
const targets = names.includes('all') || names.length === 0 ? ['intro', 'outro'] : names;

async function renderOne(name) {
  const transparent = ALPHA || WEBM;
  const url = 'file://' + path.join(here, `${name}.html`) + (transparent ? '?alpha=1' : '');
  const outFile = path.join(outDir, WEBM ? `${name}_alpha.webm` : ALPHA ? `${name}_alpha.mov` : `${name}.mp4`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { window.__RENDER_MODE__ = true; });
  await page.goto(url);
  await page.waitForFunction(() => window.__MG_READY__ === true);
  const duration = await page.evaluate(() => window.MG_DURATION);
  const frames = Math.round(duration * FPS);

  const enc = WEBM
    ? ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '24', '-row-mt', '1', '-auto-alt-ref', '0']
    : ALPHA
      ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0']
      : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-profile:v', 'high', '-movflags', '+faststart'];

  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', ...enc, outFile], { stdio: ['pipe', 'inherit', 'inherit'] });

  console.log(`▶ ${name}  ${duration}s × ${FPS}fps = ${frames} frames → ${path.relative(here, outFile)}`);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.seek(t), i / FPS);
    const png = await page.screenshot({ type: 'png', omitBackground: transparent, animations: 'disabled' });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 0) process.stdout.write(`  frame ${i}/${frames}\r`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  await browser.close();
  console.log(`  ✔ done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

for (const n of targets) await renderOne(n);
