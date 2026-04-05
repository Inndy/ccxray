'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

const SERVER_SCRIPT = path.resolve(__dirname, '..', 'server', 'index.js');
const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'ccxray-startup-test-'));

after(() => {
  fs.rmSync(TEST_HOME, { recursive: true, force: true });
});

// ── Helper: find an available port ─────────────────────────────────

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// ── Helper: spawn server and wait for ready ────────────────────────

function spawnServer(args, opts = {}) {
  const env = {
    ...process.env,
    CCXRAY_HOME: TEST_HOME,
    BROWSER: 'none', // never open browser in tests
    ...opts.env,
  };
  const child = spawn(process.execPath, [SERVER_SCRIPT, ...args], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  child.getOutput = () => ({ stdout, stderr });
  return child;
}

function waitForPort(port, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${port}/_api/health`, { timeout: 1000 }, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            if (JSON.parse(data).ok) return resolve();
          } catch {}
          if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
          setTimeout(check, 200);
        });
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(check, 200);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(check, 200);
      });
    };
    check();
  });
}

function killAndWait(child) {
  return new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.on('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      resolve();
    }, 3000);
  });
}

// ── S4: standalone mode (ccxray without claude) ────────────────────

describe('S4: standalone mode', () => {
  let child;
  let port;

  before(async () => {
    port = await findFreePort();
    child = spawnServer(['--port', String(port)]);
    await waitForPort(port);
  });

  after(async () => {
    await killAndWait(child);
  });

  it('serves health endpoint', async () => {
    const data = await httpGet(port, '/_api/health');
    assert.deepEqual(data, { ok: true });
  });

  it('serves dashboard HTML at /', async () => {
    const html = await httpGetRaw(port, '/');
    assert.ok(html.includes('<!DOCTYPE html') || html.includes('<html'));
  });

  it('serves hub status', async () => {
    const data = await httpGet(port, '/_api/hub/status');
    assert.equal(data.app, 'ccxray');
    assert.ok(data.version);
  });
});

// ── S5: status subcommand ──────────────────────────────────────────

describe('S5: status subcommand', () => {
  it('reports no hub when nothing is running', async () => {
    // Ensure no lockfile
    try { fs.unlinkSync(path.join(TEST_HOME, 'hub.json')); } catch {}

    const { stdout, code } = await spawnAndCollect(['status']);
    assert.ok(stdout.includes('No hub running'));
    assert.equal(code, 0);
  });

  it('reports dead hub and cleans lockfile', async () => {
    // Write a fake lockfile with dead pid
    const lockPath = path.join(TEST_HOME, 'hub.json');
    fs.writeFileSync(lockPath, JSON.stringify({ port: 9999, pid: 999999, version: '1.0.0' }));

    const { stdout, code } = await spawnAndCollect(['status']);
    assert.ok(stdout.includes('dead') || stdout.includes('Cleaning'));
    assert.equal(code, 1);

    // Lockfile should be cleaned up
    assert.ok(!fs.existsSync(lockPath));
  });
});

// ── S6: hub mode startup ───────────────────────────────────────────

describe('S6: hub mode startup', () => {
  let child;
  let port;

  before(async () => {
    port = await findFreePort();
    child = spawnServer(['--port', String(port), '--hub-mode']);
    await waitForPort(port);
  });

  after(async () => {
    await killAndWait(child);
    try { fs.unlinkSync(path.join(TEST_HOME, 'hub.json')); } catch {}
  });

  it('writes lockfile after startup', () => {
    const lockPath = path.join(TEST_HOME, 'hub.json');
    assert.ok(fs.existsSync(lockPath));
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    assert.equal(lock.port, port);
    assert.ok(lock.pid > 0);
    assert.ok(lock.version);
  });

  it('responds to health check', async () => {
    const data = await httpGet(port, '/_api/health');
    assert.deepEqual(data, { ok: true });
  });

  it('accepts client registration', async () => {
    const data = await httpPost(port, '/_api/hub/register', { pid: 77777, cwd: '/test' });
    assert.equal(data.ok, true);
    assert.equal(data.firstClient, true);

    // Cleanup
    await httpPost(port, '/_api/hub/unregister', { pid: 77777 });
  });
});

// ── E3: --port validation ──────────────────────────────────────────

describe('E3: --port validation', () => {
  it('rejects port 0', async () => {
    const { stderr, code } = await spawnAndCollect(['--port', '0']);
    assert.ok(stderr.includes('--port requires a valid port'));
    assert.equal(code, 1);
  });

  it('rejects non-numeric port', async () => {
    const { stderr, code } = await spawnAndCollect(['--port', 'abc']);
    assert.ok(stderr.includes('--port requires a valid port'));
    assert.equal(code, 1);
  });

  it('rejects port > 65535', async () => {
    const { stderr, code } = await spawnAndCollect(['--port', '99999']);
    assert.ok(stderr.includes('--port requires a valid port'));
    assert.equal(code, 1);
  });
});

// ── R4: EADDRINUSE handling ────────────────────────────────────────

describe('R4: port conflict', () => {
  let blocker;
  let port;

  before(async () => {
    port = await findFreePort();
    blocker = net.createServer();
    await new Promise(r => blocker.listen(port, r));
  });

  after(() => {
    blocker.close();
  });

  it('standalone mode reports port in use', async () => {
    const { stderr, code } = await spawnAndCollect(['--port', String(port)]);
    assert.ok(stderr.includes('already in use') || stderr.includes('EADDRINUSE'));
    assert.equal(code, 1);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────

function httpGet(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${urlPath}`, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Bad JSON: ${data}`)); }
      });
    }).on('error', reject);
  });
}

function httpGetRaw(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${urlPath}`, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function httpPost(port, urlPath, body) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body);
    const req = http.request(`http://localhost:${port}${urlPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Bad JSON: ${data}`)); }
      });
    });
    req.on('error', reject);
    req.end(json);
  });
}

function spawnAndCollect(args, timeoutMs = 10000) {
  return new Promise(resolve => {
    const child = spawnServer(args);
    let done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      const { stdout, stderr } = child.getOutput();
      resolve({ stdout, stderr, code });
    };
    child.on('exit', (code) => finish(code));
    setTimeout(() => {
      try { child.kill('SIGTERM'); } catch {}
      finish(null);
    }, timeoutMs);
  });
}
