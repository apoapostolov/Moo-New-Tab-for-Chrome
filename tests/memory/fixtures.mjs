import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

export async function generateFixtures(directory) {
  await mkdir(directory, { recursive: true });
  const run = (args) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.env.FFMPEG_PATH || 'ffmpeg',
        ['-hide_banner', '-loglevel', 'error', '-y', ...args],
        { windowsHide: true },
      );
      let error = '';
      child.stderr.on('data', (data) => (error += data));
      child.on('error', reject);
      child.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${error}`)),
      );
    });
  for (const [name, size] of [
    ['720', '1280x720'],
    ['1080', '1920x1080'],
    ['2160', '3840x2160'],
  ]) {
    const target = path.join(directory, `${name}.mp4`);
    const marker = path.join(directory, `${name}.ready`);
    if (
      await access(marker).then(
        () => true,
        () => false,
      )
    )
      continue;
    const temporary = path.join(directory, `${name}.partial.mp4`);
    await run([
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=${size}:rate=24`,
      '-t',
      '12',
      '-an',
      '-c:v',
      'libx264',
      '-threads',
      '2',
      '-preset',
      'ultrafast',
      '-crf',
      '27',
      '-pix_fmt',
      'yuv420p',
      '-g',
      '48',
      '-movflags',
      '+faststart',
      temporary,
    ]);
    await rename(temporary, target);
    await writeFile(marker, 'complete');
  }
  if (
    !(await access(path.join(directory, 'segment-005.ts')).then(
      () => true,
      () => false,
    ))
  ) {
    await run([
      '-i',
      path.join(directory, '720.mp4'),
      '-c',
      'copy',
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '0',
      '-hls_segment_filename',
      path.join(directory, 'segment-%03d.ts'),
      path.join(directory, 'vod.m3u8'),
    ]);
  }
  await run([
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=3840x2160:rate=1',
    '-frames:v',
    '1',
    '-threads',
    '2',
    '-update',
    '1',
    path.join(directory, 'large.jpg'),
  ]);
}

export async function fixtureServer(site, media) {
  const metrics = { requests: 0, bytes: 0, active: 0, peakActive: 0, paths: {} };
  const pending = new Set();
  const start = Date.now();
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const name = url.pathname;
    metrics.requests++;
    metrics.active++;
    metrics.peakActive = Math.max(metrics.peakActive, metrics.active);
    metrics.paths[name] = (metrics.paths[name] || 0) + 1;
    let timer;
    pending.add(response);
    response.on('close', () => {
      clearInterval(timer);
      pending.delete(response);
      metrics.active--;
    });
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (name === '/media/live.m3u8') {
      // Sliding window without ENDLIST. Sequence numbers advance every two seconds.
      // The repeated TS file has monotonic timestamps within each 12-second block;
      // discontinuities tell the decoder when the fixture loops.
      const sequence = Math.floor((Date.now() - start) / 2000);
      let playlist = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:${sequence}\n#EXT-X-DISCONTINUITY-SEQUENCE:${Math.floor(sequence / 6)}\n`;
      for (let i = sequence; i < sequence + 3; i++) {
        if (i > sequence && i % 6 === 0) playlist += '#EXT-X-DISCONTINUITY\n';
        playlist += `#EXTINF:2.0,\nsegment-${String(i % 6).padStart(3, '0')}.ts?sequence=${i}\n`;
      }
      response.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      metrics.bytes += Buffer.byteLength(playlist);
      response.end(playlist);
      return;
    }
    if (name === '/media/broken.m3u8' || name === '/media/missing.mp4') {
      response.writeHead(404).end('Missing fixture');
      return;
    }
    if (name === '/media/corrupt.mp4') {
      response.setHeader('Content-Type', 'video/mp4');
      response.end('This deliberately is not a video.');
      return;
    }
    if (name === '/media/stall.mp4') {
      response.writeHead(200, { 'Content-Type': 'video/mp4' });
      response.flushHeaders();
      return;
    }
    if (name === '/media/slow.mp4') {
      const data = await readFile(path.join(media, '720.mp4'));
      response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': data.length });
      let offset = 0;
      timer = setInterval(() => {
        const chunk = data.subarray(offset, offset + 8192);
        metrics.bytes += chunk.length;
        response.write(chunk);
        offset += chunk.length;
        if (offset >= data.length) {
          clearInterval(timer);
          response.end();
        }
      }, 100);
      return;
    }
    const root = name.startsWith('/media/') ? media : site;
    const relative = name.startsWith('/media/')
      ? name.slice(7)
      : name === '/'
        ? 'tests/memory/harness.html'
        : name.slice(1);
    const target = path.resolve(root, relative);
    if (!target.startsWith(path.resolve(root) + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const size = (await stat(target)).size;
      const types = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.mp4': 'video/mp4',
        '.ts': 'video/mp2t',
        '.jpg': 'image/jpeg',
        '.m3u8': 'application/vnd.apple.mpegurl',
      };
      response.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      const first = range ? Number(range[1]) : 0;
      const last = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (first > last || first >= size) {
        response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
        return;
      }
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Length', last - first + 1);
      if (range) response.writeHead(206, { 'Content-Range': `bytes ${first}-${last}/${size}` });
      const stream = createReadStream(target, { start: first, end: last });
      stream.on('data', (data) => (metrics.bytes += data.length));
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    metrics,
    close: async () => {
      for (const response of pending) response.destroy();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
