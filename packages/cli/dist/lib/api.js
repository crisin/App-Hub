import { HUB_PORT } from '@apphub/shared';
const HUB_URL = process.env.APPHUB_URL ?? `http://localhost:${HUB_PORT}`;
export async function hubFetch(path, options) {
    let res;
    try {
        res = await fetch(`${HUB_URL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
    }
    catch (err) {
        throw new Error(`Could not connect to App Hub at ${HUB_URL}.\n` +
            `\n` +
            `Is the hub running? Start it with:\n` +
            `  npm run dev                           # development mode\n` +
            `  npm run start                         # production mode\n` +
            `  launchctl kickstart gui/$(id -u)/com.apphub.server  # if installed as service\n` +
            `\n` +
            `Check health: curl -s ${HUB_URL}/api/health | jq`);
    }
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error(`Hub returned non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!data.ok) {
        throw new Error(data.error ?? `Request failed: ${res.status}`);
    }
    return data.data;
}
