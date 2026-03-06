import fs from 'node:fs';
import dns from 'node:dns/promises';

function parseEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    out[key] = val;
  }
  return out;
}

async function main() {
  const env = {
    ...parseEnvFile('.env'),
    ...process.env,
  };

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.error(`Invalid VITE_SUPABASE_URL: ${url}`);
    process.exit(1);
  }

  console.log(`Supabase host: ${parsed.host}`);

  try {
    const resolved = await dns.lookup(parsed.hostname);
    console.log(`DNS resolved: ${resolved.address}`);
  } catch (error) {
    console.error(`DNS failed: ${error.code || error.message}`);
    process.exit(2);
  }

  const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/patients?select=id&limit=1`;
  try {
    const resp = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const body = await resp.text();
    console.log(`HTTP status: ${resp.status}`);
    if (!resp.ok) {
      console.error(`REST check failed: ${body.slice(0, 280)}`);
      process.exit(3);
    }
    console.log('Supabase REST check passed.');
  } catch (error) {
    console.error(`REST request failed: ${error.message}`);
    process.exit(4);
  }
}

main();
