const http = require('http');
const fs = require('fs');
const path = require('path');

const filePath = 'H:\\tihuashi\\backend\\uploads\\1773296512267.jpg';
const fileName = path.basename(filePath);
const fileContent = fs.readFileSync(filePath);

const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

const header = Buffer.from(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="image"; filename="${fileName}"\r\n` +
  `Content-Type: image/jpeg\r\n\r\n`
);

const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

const body = Buffer.concat([header, fileContent, footer]);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/upload',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Error:', e.message));

req.write(body);
req.end();
