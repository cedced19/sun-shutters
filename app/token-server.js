const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const HOST = '127.0.0.1';
const PORT = 3000;

const REGIONS = {
  cn: 'openapi.tuyacn.com',
  us: 'openapi.tuyaus.com',
  eu: 'openapi.tuyaeu.com',
  in: 'openapi.tuyain.com',
};

const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');
const TOKEN_FILE = path.join(__dirname, 'token.json');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Tuya OpenAPI current signature (projects created after June 30, 2021):
//   stringToSign = method + "\n" + SHA256(body) + "\n" + "\n" + url
//   message      = clientId + t + nonce + stringToSign
//   sign         = HEX_UPPER( HMAC-SHA256(message, secret) )
function signRequest({ method, url, body = '', clientId, secret, t, nonce }) {
  const contentSha256 = crypto.createHash('sha256').update(body).digest('hex');
  const stringToSign = `${method}\n${contentSha256}\n\n${url}`;
  const message = `${clientId}${t}${nonce}${stringToSign}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex').toUpperCase();
}

// Request a token from the Tuya OpenAPI.
// grant_type 1 = initial token (client_id/secret), 2 = refresh.
async function requestToken({ clientId, secret, region, grantType, refreshToken }) {
  const host = REGIONS[region] || REGIONS.eu;
  const t = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');

  // grant_type=1: GET /v1.0/token?grant_type=1
  // refresh:      GET /v1.0/token/{refresh_token}
  const url = grantType === 2
    ? `/v1.0/token/${encodeURIComponent(refreshToken)}`
    : '/v1.0/token?grant_type=1';

  const headers = {
    client_id: clientId,
    sign_method: 'HMAC-SHA256',
    t,
    nonce,
    sign: signRequest({ method: 'GET', url, body: '', clientId, secret, t, nonce }),
  };

  const res = await fetch(`https://${host}${url}`, { method: 'GET', headers });
  let body;
  try { body = await res.json(); } catch { body = { raw: await res.text() }; }
  return { status: res.status, body };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload, null, 2));
}

function mask(s) {
  if (!s) return null;
  return s.length > 8 ? s.slice(0, 4) + '...' + s.slice(-4) : '***';
}

function safeStatus() {
  const creds = readJson(CREDENTIALS_FILE, null);
  const tok = readJson(TOKEN_FILE, null);
  return {
    haveCredentials: !!creds,
    credentials: creds ? { clientId: mask(creds.clientId), region: creds.region } : null,
    haveToken: !!tok && !!tok.access_token,
    token: tok ? {
      accessToken: mask(tok.access_token),
      refreshToken: mask(tok.refresh_token),
      uid: tok.uid,
      expiresAt: tok.expires_at,
      valid: tok.expires_at ? Date.now() < tok.expires_at : false,
    } : null,
  };
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tuya token</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 40px auto; padding: 0 16px; }
    label { display: block; margin: 12px 0 4px; font-weight: 600; }
    input, select { width: 100%; padding: 8px; box-sizing: border-box; }
    button { margin-top: 16px; padding: 10px 16px; cursor: pointer; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow: auto; }
    .ok { color: #16703c; } .err { color: #b00020; }
  </style>
</head>
<body>
  <h1>Tuya OpenAPI token</h1>
  <form id="form">
    <label>Region
      <select name="region">
        <option value="eu" selected>EU (openapi.tuyaeu.com)</option>
        <option value="us">US (openapi.tuyaus.com)</option>
        <option value="cn">CN (openapi.tuyacn.com)</option>
        <option value="in">IN (openapi.tuyain.com)</option>
      </select>
    </label>
    <label>Access ID (client_id)
      <input name="clientId" autocomplete="off" required>
    </label>
    <label>Access Secret (client_secret)
      <input name="secret" type="password" autocomplete="off" required>
    </label>
    <button type="button" id="get">Get token (grant_type=1)</button>
    <button type="button" id="refresh">Refresh token (grant_type=2)</button>
  </form>
  <h2>Saved status</h2>
  <pre id="status">Loading&hellip;</pre>
  <div id="result"></div>

  <script>
    function show(msg, isError) {
      const el = document.getElementById('result');
      el.className = isError ? 'err' : 'ok';
      el.textContent = msg;
    }
    async function api(url, payload) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return r.json();
    }
    function creds() {
      const f = document.getElementById('form');
      return {
        region: f.region.value,
        clientId: f.clientId.value.trim(),
        secret: f.secret.value.trim(),
      };
    }
    async function refreshStatus() {
      const r = await fetch('/status');
      document.getElementById('status').textContent = JSON.stringify(await r.json(), null, 2);
    }
    document.getElementById('get').onclick = async () => {
      const r = await api('/token', creds());
      show(r.error ? ('ERROR: ' + r.error) : 'Token saved. ' + (r.result || ''), !!r.error);
      refreshStatus();
    };
    document.getElementById('refresh').onclick = async () => {
      const c = creds();
      const r = await api('/refresh', { region: c.region, clientId: c.clientId, secret: c.secret });
      show(r.error ? ('ERROR: ' + r.error) : 'Token refreshed. ' + (r.result || ''), !!r.error);
      refreshStatus();
    };
    refreshStatus();
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/status') {
    sendJson(res, 200, safeStatus());
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/token' || url.pathname === '/refresh')) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const input = JSON.parse(raw || '{}');

    const refresh = url.pathname === '/refresh';
    let clientId = input.clientId;
    let secret = input.secret;
    let region = input.region;

    if (refresh && !clientId && !secret) {
      const saved = readJson(CREDENTIALS_FILE, {});
      clientId = clientId || saved.clientId;
      secret = secret || saved.secret;
      region = region || saved.region;
      if (clientId && secret) writeJson(CREDENTIALS_FILE, { clientId, secret, region });
    } else if (clientId && secret) {
      writeJson(CREDENTIALS_FILE, { clientId, secret, region });
    }

    const token = refresh ? readJson(TOKEN_FILE, {}) : {};

    if (refresh && !token.refresh_token) {
      sendJson(res, 400, { error: 'No saved refresh_token. Get a token first.' });
      return;
    }

    if (!clientId || !secret) {
      sendJson(res, 400, { error: 'Access ID / Access Secret missing (or not saved).' });
      return;
    }

    try {
      const { status, body } = await requestToken({
        clientId, secret, region,
        grantType: refresh ? 2 : 1,
        refreshToken: refresh && token.refresh_token ? token.refresh_token : undefined,
      });

      const result = body.result;
      if (!status.toString().startsWith('2') || !result || !result.access_token) {
        sendJson(res, status < 500 ? 400 : 502, {
          error: `Tuya error ${body.code || status}: ${body.msg || 'see payload'}`,
          payload: body,
        });
        return;
      }

      const saved = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        uid: result.uid,
        region,
        expires_at: Date.now() + result.expire_time * 1000,
        fetched_at: new Date().toISOString(),
      };
      writeJson(TOKEN_FILE, saved);
      sendJson(res, 200, {
        ok: true,
        result: refresh ? 'Access token refreshed.' : 'Access token obtained.',
        token: { access_token: mask(saved.access_token), expires_at: saved.expires_at },
      });
    } catch (err) {
      sendJson(res, 500, { error: 'Request failed: ' + err.message });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Tuya token server running at http://${HOST}:${PORT}`);
});
