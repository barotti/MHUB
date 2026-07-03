const crypto = require('crypto');

const TEXT_EXTENSIONS = new Set([
  '.html',
  '.css',
  '.js',
  '.json',
  '.txt',
  '.md',
  '.svg',
  '.xml'
]);

const ALLOWED_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS,
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.mp4'
]);

const ALLOWED_ROOTS = [
  '',
  'css/',
  'js/',
  'servizi/',
  'public/web/images/',
  'public/web/videos/'
];

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
}

function setCors(req, res) {
  const allowedOrigin = process.env.API_ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  res.setHeader('Vary', 'Origin');
}

function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function authToken(req) {
  const header = req.headers.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return req.headers['x-admin-key'];
}

function requireAuth(req, res) {
  const expected = process.env.SITE_API_KEY;
  if (!expected) {
    send(res, 500, { error: 'SITE_API_KEY is not configured' });
    return false;
  }
  if (!timingSafeEquals(authToken(req), expected)) {
    send(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

function normalizePath(file) {
  if (typeof file !== 'string' || !file.trim()) {
    throw new Error('Missing file path');
  }

  const normalized = file.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    normalized.includes('..') ||
    normalized.startsWith('.') ||
    normalized.includes('//') ||
    normalized.endsWith('/')
  ) {
    throw new Error('Invalid file path');
  }

  const dot = normalized.lastIndexOf('.');
  const extension = dot >= 0 ? normalized.slice(dot).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`File extension "${extension || 'none'}" is not allowed`);
  }

  const allowed = ALLOWED_ROOTS.some(root => {
    if (!root) return !normalized.includes('/');
    return normalized.startsWith(root);
  });
  if (!allowed) {
    throw new Error('File path is outside the allowed site folders');
  }

  return normalized;
}

function isTextFile(file) {
  const dot = file.lastIndexOf('.');
  return dot >= 0 && TEXT_EXTENSIONS.has(file.slice(dot).toLowerCase());
}

function githubConfig() {
  const owner = process.env.GITHUB_OWNER || 'barotti';
  const repo = process.env.GITHUB_REPO || 'MHUB';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured');
  }

  return { owner, repo, branch, token };
}

async function githubRequest(path, options = {}) {
  const { owner, repo, token } = githubConfig();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'm3hub-site-admin-api',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data && data.message ? data.message : `GitHub request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function getFile(file) {
  const { branch } = githubConfig();
  return githubRequest(`/contents/${encodeURIComponentPath(file)}?ref=${encodeURIComponent(branch)}`);
}

function encodeURIComponentPath(file) {
  return file.split('/').map(encodeURIComponent).join('/');
}

function decodeBase64(value) {
  return Buffer.from(String(value || '').replace(/\s/g, ''), 'base64');
}

function encodeContent(body) {
  if (typeof body.contentBase64 === 'string') {
    decodeBase64(body.contentBase64);
    return body.contentBase64.replace(/\s/g, '');
  }
  if (typeof body.content === 'string') {
    return Buffer.from(body.content, 'utf8').toString('base64');
  }
  throw new Error('Send either "content" or "contentBase64"');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  return JSON.parse(req.body);
}

async function listSiteFiles() {
  const { branch } = githubConfig();
  const tree = await githubRequest(`/git/trees/${encodeURIComponent(branch)}?recursive=1`);

  return tree.tree
    .filter(item => item.type === 'blob')
    .map(item => item.path)
    .filter(path => {
      try {
        normalizePath(path);
        return true;
      } catch (_) {
        return false;
      }
    })
    .sort();
}

async function readFile(req, res) {
  if (req.query.list === '1' || req.query.list === 'true') {
    const files = await listSiteFiles();
    send(res, 200, { files });
    return;
  }

  const file = normalizePath(req.query.file);
  const data = await getFile(file);
  const contentBase64 = String(data.content || '').replace(/\s/g, '');
  const payload = {
    file,
    sha: data.sha,
    encoding: 'base64',
    contentBase64,
    size: data.size,
    downloadUrl: data.download_url
  };

  if (isTextFile(file)) {
    payload.content = Buffer.from(contentBase64, 'base64').toString('utf8');
  }

  send(res, 200, payload);
}

async function writeFile(req, res) {
  const body = parseBody(req);
  const file = normalizePath(body.file);
  const { branch } = githubConfig();
  const existing = await getFile(file).catch(error => {
    if (error.status === 404) return null;
    throw error;
  });

  const content = encodeContent(body);
  const message = String(body.message || `Update ${file}`).slice(0, 240);
  const payload = { message, content, branch };
  if (existing && existing.sha) payload.sha = existing.sha;

  const data = await githubRequest(`/contents/${encodeURIComponentPath(file)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  send(res, 200, {
    ok: true,
    file,
    branch,
    commit: data.commit && {
      sha: data.commit.sha,
      message: data.commit.message,
      url: data.commit.html_url
    }
  });
}

async function patchTextFile(req, res) {
  const body = parseBody(req);
  const file = normalizePath(body.file);
  if (!isTextFile(file)) {
    throw new Error('PATCH is available only for text files');
  }
  if (!Array.isArray(body.replacements) || body.replacements.length === 0) {
    throw new Error('Send a non-empty "replacements" array');
  }

  const current = await getFile(file);
  let content = Buffer
    .from(String(current.content || '').replace(/\s/g, ''), 'base64')
    .toString('utf8');

  const results = [];
  for (const replacement of body.replacements) {
    if (typeof replacement.search !== 'string' || typeof replacement.replace !== 'string') {
      throw new Error('Each replacement needs "search" and "replace" strings');
    }
    const before = content;
    content = content.split(replacement.search).join(replacement.replace);
    results.push({
      search: replacement.search,
      changed: before !== content
    });
  }

  if (results.every(result => !result.changed)) {
    send(res, 409, { error: 'No replacement matched', file, results });
    return;
  }

  req.body = {
    file,
    content,
    message: body.message || `Patch ${file}`
  };
  await writeFile(req, res);
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!requireAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      await readFile(req, res);
      return;
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      await writeFile(req, res);
      return;
    }
    if (req.method === 'PATCH') {
      await patchTextFile(req, res);
      return;
    }

    send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    send(res, error.status || 400, {
      error: error.message || 'Request failed',
      details: error.details
    });
  }
};
