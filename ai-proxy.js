import http from 'http';
import https from 'https';

const PORT = 1422;

const server = http.createServer((req, res) => {
  // CORSヘッダーを付与
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // /ai-proxy/ を削除してターゲットパスを作成
  const targetPath = req.url.replace(/^\/ai-proxy/, '');
  
  const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Authorization': req.headers['authorization'] || ''
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.statusCode = proxyRes.statusCode;
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (e) => {
    console.error('[AI Proxy Error]', e);
    res.statusCode = 500;
    res.end(e.message);
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
  console.log(`AI Proxy Server listening on port ${PORT}`);
});
