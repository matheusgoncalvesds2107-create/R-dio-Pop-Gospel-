const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const DB_FILE = path.join(DATA_DIR, 'radio.json');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';

const RADIO_NAME = process.env.PUBLIC_RADIO_NAME || 'Radio Pop Gospel';
const PARTNER_NAME = process.env.PARTNER_NAME || 'Web Rádio Vem Comigo Deus';

if (process.env.NODE_ENV === 'production' && (!ADMIN_PASSWORD || !SESSION_SECRET)) {
  console.error('Configure ADMIN_PASSWORD e SESSION_SECRET nas variáveis de ambiente.');
  process.exit(1);
}

fs.mkdirSync(AUDIO_DIR, { recursive: true });

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {
      tracks: [],
      playlists: [],
      selectedPlaylistId: null,
      settings: {
        tagline: 'Louvor que toca o coração',
        live: false
      }
    };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function safeTrack(t) {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist || '',
    filename: t.filename,
    size: t.size,
    createdAt: t.createdAt
  };
}

function isAdmin(req, res, next) {
  if (req.session && req.session.admin === true) {
    return next();
  }

  return res.status(401).json({
    error: 'Faça login no painel.'
  });
}

const loginAttempts = new Map();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(express.json({
  limit: '1mb'
}));

app.use(session({
  name: 'rpg.sid',
  secret: SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// ARQUIVOS DO SITE NA RAIZ DO GITHUB

function sendRootFile(filename) {
  return (_req, res) => {
    res.sendFile(path.join(ROOT_DIR, filename));
  };
}

// Página inicial
app.get('/', sendRootFile('index.html'));

// Painel administrativo
app.get('/admin', sendRootFile('admin.html'));
app.get('/admin.html', sendRootFile('admin.html'));

// Arquivos CSS e JavaScript
for (const filename of [
  'style.css',
  'app.js',
  'admin.css',
  'admin.js'
]) {
  app.get(`/${filename}`, sendRootFile(filename));
}

// UPLOAD DE MÚSICAS

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AUDIO_DIR);
  },

  filename: (_req, file, cb) => {
    cb(null, crypto.randomUUID() + '.mp3');
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 40 * 1024 * 1024,
    files: 1
  },

  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (
      ext !== '.mp3' ||
      ![
        'audio/mpeg',
        'audio/mp3',
        'application/octet-stream'
      ].includes(file.mimetype)
    ) {
      return cb(new Error('Envie um arquivo MP3 válido.'));
    }

    cb(null, true);
  }
});

// TESTE DO SERVIDOR

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'radio-pop-gospel'
  });
});

// DADOS PÚBLICOS DA RÁDIO

app.get('/api/public', (_req, res) => {
  const db = readDB();

  res.json({
    name: RADIO_NAME,
    partner: PARTNER_NAME,
    tagline: db.settings.tagline,
    live: !!db.settings.live,

    tracks: db.tracks.map(safeTrack),

    playlists: db.playlists.map(p => ({
      id: p.id,
      name: p.name,
      trackIds: p.trackIds
    })),

    selectedPlaylistId: db.selectedPlaylistId
  });
});

// REPRODUÇÃO DE ÁUDIO

app.get('/api/audio/:id', (req, res) => {
  const db = readDB();

  const track = db.tracks.find(
    t => t.id === req.params.id
  );

  if (!track) {
    return res.status(404).send('Áudio não encontrado');
  }

  const file = path.join(
    AUDIO_DIR,
    path.basename(track.filename)
  );

  if (!fs.existsSync(file)) {
    return res.status(404).send('Arquivo não encontrado');
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');

  res.sendFile(file);
});

// LOGIN ADMINISTRATIVO

app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  const entry = loginAttempts.get(ip) || {
    count: 0,
    until: 0
  };

  if (entry.until > now) {
    return res.status(429).json({
      error: 'Muitas tentativas. Aguarde alguns minutos.'
    });
  }

  const { username, password } = req.body || {};

  const passwordOk =
    typeof password === 'string' &&
    password.length <= 200 &&
    Buffer.byteLength(password) === Buffer.byteLength(ADMIN_PASSWORD) &&
    crypto.timingSafeEqual(
      Buffer.from(password),
      Buffer.from(ADMIN_PASSWORD)
    );

  if (username !== ADMIN_USER || !passwordOk) {
    entry.count++;

    if (entry.count >= 8) {
      entry.count = 0;
      entry.until = now + 10 * 60 * 1000;
    }

    loginAttempts.set(ip, entry);

    return res.status(401).json({
      error: 'Usuário ou senha incorretos.'
    });
  }

  loginAttempts.delete(ip);

  req.session.admin = true;

  res.json({
    ok: true
  });
});

// SAIR DO PAINEL

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// VERIFICAR LOGIN

app.get('/api/session', (req, res) => {
  res.json({
    authenticated: !!(
      req.session &&
      req.session.admin
    )
  });
});

// ENVIAR MÚSICAS MP3

app.post('/api/upload', isAdmin, (req, res) => {
  upload.single('audio')(req, res, err => {
    if (err) {
      return res.status(400).json({
        error: err.message || 'Falha no envio.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Selecione um MP3.'
      });
    }

    const db = readDB();

    const title = String(
      req.body.title ||
      path.parse(req.file.originalname).name
    ).trim().slice(0, 120);

    const artist = String(
      req.body.artist || ''
    ).trim().slice(0, 120);

    const track = {
      id: crypto.randomUUID(),
      title: title || 'Faixa sem título',
      artist,
      filename: req.file.filename,
      size: req.file.size,
      createdAt: new Date().toISOString()
    };

    db.tracks.push(track);

    writeDB(db);

    res.json({
      ok: true,
      track: safeTrack(track)
    });
  });
});

// EXCLUIR MÚSICAS

app.delete('/api/tracks/:id', isAdmin, (req, res) => {
  const db = readDB();

  const idx = db.tracks.findIndex(
    t => t.id === req.params.id
  );

  if (idx < 0) {
    return res.status(404).json({
      error: 'Faixa não encontrada.'
    });
  }

  const [track] = db.tracks.splice(idx, 1);

  try {
    fs.unlinkSync(
      path.join(AUDIO_DIR, path.basename(track.filename))
    );
  } catch {}

  db.playlists.forEach(p => {
    p.trackIds = p.trackIds.filter(
      id => id !== track.id
    );
  });

  writeDB(db);

  res.json({ ok: true });
});

// CRIAR PLAYLIST

app.post('/api/playlists', isAdmin, (req, res) => {
  const name = String(
    req.body.name || ''
  ).trim().slice(0, 80);

  if (!name) {
    return res.status(400).json({
      error: 'Informe o nome da playlist.'
    });
  }

  const db = readDB();

  const playlist = {
    id: crypto.randomUUID(),
    name,
    trackIds: []
  };

  db.playlists.push(playlist);

  if (!db.selectedPlaylistId) {
    db.selectedPlaylistId = playlist.id;
  }

  writeDB(db);

  res.json({
    ok: true,
    playlist
  });
});

// EDITAR PLAYLIST

app.put('/api/playlists/:id', isAdmin, (req, res) => {
  const db = readDB();

  const playlist = db.playlists.find(
    x => x.id === req.params.id
  );

  if (!playlist) {
    return res.status(404).json({
      error: 'Playlist não encontrada.'
    });
  }

  if (typeof req.body.name === 'string') {
    playlist.name =
      req.body.name.trim().slice(0, 80) ||
      playlist.name;
  }

  if (Array.isArray(req.body.trackIds)) {
    const allowed = new Set(
      db.tracks.map(t => t.id)
    );

    playlist.trackIds = [
      ...new Set(
        req.body.trackIds.filter(
          id => allowed.has(id)
        )
      )
    ];
  }

  writeDB(db);

  res.json({
    ok: true,
    playlist
  });
});

// EXCLUIR PLAYLIST

app.delete('/api/playlists/:id', isAdmin, (req, res) => {
  const db = readDB();

  db.playlists = db.playlists.filter(
    p => p.id !== req.params.id
  );

  if (db.selectedPlaylistId === req.params.id) {
    db.selectedPlaylistId =
      db.playlists[0]?.id || null;
  }

  writeDB(db);

  res.json({ ok: true });
});

// SELECIONAR PLAYLIST

app.post('/api/playlists/:id/select', isAdmin, (req, res) => {
  const db = readDB();

  if (!db.playlists.some(
    p => p.id === req.params.id
  )) {
    return res.status(404).json({
      error: 'Playlist não encontrada.'
    });
  }

  db.selectedPlaylistId = req.params.id;

  writeDB(db);

  res.json({ ok: true });
});

// CONFIGURAÇÕES DA RÁDIO

app.put('/api/settings', isAdmin, (req, res) => {
  const db = readDB();

  if (typeof req.body.tagline === 'string') {
    db.settings.tagline =
      req.body.tagline.trim().slice(0, 160);
  }

  if (typeof req.body.live === 'boolean') {
    db.settings.live = req.body.live;
  }

  writeDB(db);

  res.json({ ok: true });
});

// TRATAMENTO DE ERROS

app.use((err, _req, res, _next) => {
  console.error(err.message);

  res.status(400).json({
    error: err.message || 'Erro inesperado.'
  });
});

// INICIAR SERVIDOR

app.listen(PORT, () => {
  console.log(
    `${RADIO_NAME} online na porta ${PORT}`
  );
});
