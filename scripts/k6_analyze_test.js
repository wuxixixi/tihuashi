import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '30s'
};

export default function () {
  const url = 'http://localhost:3001/api/analyze';
  const payload = JSON.stringify({ imagePath: '/absolute/path/to/uploads/sample.jpg' });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(url, payload, params);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
