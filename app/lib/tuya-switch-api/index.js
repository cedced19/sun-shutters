const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Tuya IoT OpenAPI client.
//
// Replaces the legacy email/password "homeassistant skill" endpoint with the
// current OpenAPI (openapi.tuyaeu.com). Credentials (client_id/secret) and the
// access/refresh token are read from app/credentials.json and app/token.json
// (saved by the token server), so scripts keep working without passing them.
//
//   const Tuya = require('./lib/tuya-switch-api');
//   const t = new Tuya(); // args ignored; uses saved credentials
//   t.open('7211...', (err, body) => { ... });

const REGIONS = {
  cn: 'openapi.tuyacn.com',
  us: 'openapi.tuyaus.com',
  eu: 'openapi.tuyaeu.com',
  in: 'openapi.tuyain.com'
};

const DATA_DIR = path.join(__dirname, '..', '..'); // app/
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
const TOKEN_FILE = path.join(DATA_DIR, 'token.json');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// Tuya OpenAPI signature (projects created after June 30, 2021).
//   stringToSign = method \n SHA256(body) \n <Signature-Headers, empty> \n url
//   token ops:   message = client_id + t + nonce + stringToSign
//   service ops: message = client_id + access_token + t + nonce + stringToSign
function signRequest({ method, url, body, clientId, accessToken, secret, t, nonce }) {
  const stringToSign = `${method}\n${sha256(body || '')}\n\n${url}`;
  const head = accessToken
    ? `${clientId}${accessToken}${t}${nonce}${stringToSign}`
    : `${clientId}${t}${nonce}${stringToSign}`;
  return crypto.createHmac('sha256', secret).update(head).digest('hex').toUpperCase();
}

function Tuya(email, password, region, countryCode, platform) {
  this.region = region || 'eu';
  this.host = REGIONS[this.region] || REGIONS.eu;

  const creds = readJson(CREDENTIALS_FILE, {});
  this.clientId = creds.clientId;
  this.secret = creds.secret;
  this.token = readJson(TOKEN_FILE, {});
}

Tuya.prototype.isConnected = function () {
  return !!(this.token.access_token && this.token.expires_at && Date.now() < this.token.expires_at);
};

// Perform a token request (grant_type=1 or refresh via path token).
Tuya.prototype._tokenRequest = async function () {
  const refreshToken = this.token.refresh_token;
  const url = refreshToken
    ? `/v1.0/token/${encodeURIComponent(refreshToken)}`
    : '/v1.0/token?grant_type=1';
  const t = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const sign = signRequest({
    method: 'GET', url, body: '', clientId: this.clientId,
    accessToken: null, secret: this.secret, t, nonce
  });
  const headers = { client_id: this.clientId, sign_method: 'HMAC-SHA256', t, nonce, sign };
  const res = await fetch(`https://${this.host}${url}`, { method: 'GET', headers });
  let json;
  try { json = await res.json(); } catch { json = { raw: await res.text() }; }
  return json;
};

// Fetch a valid token: reuse the saved one, else refresh, else grant_type=1.
Tuya.prototype._ensureToken = async function () {
  if (this.isConnected()) return;

  let json = await this._tokenRequest();      // refresh if we have a refresh_token
  if (!json || !json.success || !json.result || !json.result.access_token) {
    // refresh failed (expired/invalid) -> fall back to grant_type=1
    this.token.refresh_token = '';
    json = await this._tokenRequest();
  }
  if (!json || !json.success || !json.result || !json.result.access_token) {
    throw new Error((json && json.msg) || 'Tuya token request failed');
  }
  this._applyToken(json.result);
};

Tuya.prototype._applyToken = function (result) {
  this.token.access_token = result.access_token;
  this.token.refresh_token = result.refresh_token;
  this.token.uid = result.uid;
  this.token.expires_at = Date.now() + result.expire_time * 1000;
  this.token.region = this.region;
  this.token.fetched_at = new Date().toISOString();
  writeJson(TOKEN_FILE, this.token);
};

// Sign and send an authenticated service request (no token management).
Tuya.prototype._raw = async function (method, url, body) {
  const t = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const contentType = method === 'GET' ? undefined : 'application/json';
  const sign = signRequest({
    method, url, body,
    clientId: this.clientId, accessToken: this.token.access_token,
    secret: this.secret, t, nonce
  });
  const headers = {
    client_id: this.clientId,
    access_token: this.token.access_token,
    sign_method: 'HMAC-SHA256',
    t, nonce, sign
  };
  if (contentType) headers['Content-Type'] = contentType;

  const res = await fetch(`https://${this.host}${url}`, { method, headers, body: body || undefined });
  let json;
  try { json = await res.json(); } catch { json = { raw: await res.text() }; }
  return json;
};

// Ensure a token, run the signed request, and retry once after a token error.
Tuya.prototype._request = async function (method, url, body, cb) {
  cb = cb || function () {};
  if (!this.clientId || !this.secret) {
    return cb(new Error('No saved credentials (app/credentials.json). Obtain a token first.'));
  }
  try {
    await this._ensureToken();
    let json = await this._raw(method, url, body);
    if (!json.success && [1004, 1010, 1106, 2002].indexOf(json.code) !== -1) {
      // token expired/invalid -> refresh and retry once
      this.token.refresh_token = '';
      await this._ensureToken();
      json = await this._raw(method, url, body);
    }
    if (!json.success) return cb(new Error(json.msg || ('Tuya error ' + json.code)));
    cb(null, json);
  } catch (e) {
    cb(e);
  }
};

Tuya.prototype._control = function (id, value, cb) {
  const url = `/v1.0/devices/${id}/commands`;
  const body = JSON.stringify({ commands: [{ code: 'control', value }] });
  this._request('POST', url, body, cb);
};

Tuya.prototype.open = function (id, cb) { this._control(id, 'open', cb); };
Tuya.prototype.close = function (id, cb) { this._control(id, 'close', cb); };
Tuya.prototype.stop = function (id, cb) { this._control(id, 'stop', cb); };

// Keep connect() around: it just ensures a valid token is ready.
Tuya.prototype.connect = function (cb) {
  cb = cb || function () {};
  this._ensureToken().then(() => cb(null)).catch(cb);
};

module.exports = Tuya;
