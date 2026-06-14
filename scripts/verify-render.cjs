const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PACKAGE_PATH,
    'playwright',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {}
  }

  throw new Error('Playwright is not available. Install it or set PLAYWRIGHT_PACKAGE_PATH.');
}

function parsePng(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('Expected a PNG screenshot.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    }

    if (type === 'IDAT') {
      idat.push(data);
    }

    if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) {
    throw new Error(`Unsupported PNG color type ${colorType}.`);
  }

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = Buffer.alloc(height * stride);
  let source = 0;
  let previous = Buffer.alloc(stride);

  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source];
    source += 1;
    const row = Buffer.from(inflated.subarray(source, source + stride));
    source += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;

      if (filter === 1) row[x] = (row[x] + left) & 255;
      if (filter === 2) row[x] = (row[x] + up) & 255;
      if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
      if (filter === 4) row[x] = (row[x] + paeth(left, up, upLeft)) & 255;
    }

    row.copy(rows, y * stride);
    previous = row;
  }

  return { width, height, channels, rows };
}

function samplePixels(png) {
  const points = [
    [0.5, 0.5],
    [0.25, 0.62],
    [0.75, 0.38],
    [0.5, 0.82],
    [0.12, 0.9],
  ];

  return points.map(([xRatio, yRatio]) => {
    const x = Math.max(0, Math.min(png.width - 1, Math.floor(png.width * xRatio)));
    const y = Math.max(0, Math.min(png.height - 1, Math.floor(png.height * yRatio)));
    const index = (y * png.width + x) * png.channels;
    return Array.from(png.rows.subarray(index, index + 3));
  });
}

async function capture(browser, url, name, viewport) {
  const page = await browser.newPage({ viewport });
  const logs = [];

  page.on('console', (message) => {
    const type = message.type();
    if (type === 'warning' || type === 'error') {
      logs.push({ type, text: message.text() });
    }
  });

  page.on('pageerror', (error) => {
    logs.push({ type: 'pageerror', text: error.message });
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1400);

  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const hud = document.querySelector('.hud').getBoundingClientRect();
    const panel = document.querySelector('.debug-panel').getBoundingClientRect();

    return {
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      canvas: { width: Math.round(rect.width), height: Math.round(rect.height) },
      hud: { width: Math.round(hud.width), height: Math.round(hud.height) },
      panel: { width: Math.round(panel.width), height: Math.round(panel.height) },
      telemetry: Array.from(document.querySelectorAll('.hud-value')).map((node) => node.textContent),
      controls: document.querySelectorAll('.debug-panel input').length,
    };
  });

  const outputDir = path.join(process.cwd(), 'verification');
  fs.mkdirSync(outputDir, { recursive: true });
  const screenshotPath = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, type: 'png' });
  await page.close();

  const png = parsePng(fs.readFileSync(screenshotPath));
  const sampledPixels = samplePixels(png);
  const uniquePixels = new Set(sampledPixels.map((pixel) => pixel.join(','))).size;

  return {
    name,
    info,
    screenshot: {
      path: screenshotPath,
      width: png.width,
      height: png.height,
      sampledPixels,
      uniquePixels,
    },
    logs,
  };
}

async function main() {
  const url = process.argv[2] || 'http://127.0.0.1:5173/';
  const { chromium } = loadPlaywright();
  const chromePath =
    process.env.CHROME_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const launchOptions = fs.existsSync(chromePath)
    ? { executablePath: chromePath, headless: true }
    : { headless: true };
  const browser = await chromium.launch(launchOptions);

  try {
    const results = [
      await capture(browser, url, 'desktop', { width: 1280, height: 720 }),
      await capture(browser, url, 'mobile', { width: 390, height: 844 }),
    ];

    const failures = [];
    for (const result of results) {
      if (result.info.canvas.width !== result.info.viewport.width) {
        failures.push(`${result.name}: canvas width does not fill viewport`);
      }
      if (result.info.canvas.height !== result.info.viewport.height) {
        failures.push(`${result.name}: canvas height does not fill viewport`);
      }
      if (result.info.controls !== 6) {
        failures.push(`${result.name}: expected 6 debug controls`);
      }
      if (result.screenshot.uniquePixels < 3) {
        failures.push(`${result.name}: screenshot pixel sample is too flat`);
      }
      if (result.logs.length) {
        failures.push(`${result.name}: console warnings/errors present`);
      }
    }

    console.log(JSON.stringify({ results, failures }, null, 2));

    if (failures.length) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
