const fs = require('fs');
const crypto = require('crypto');

const env = process.env.ENV;
const SPARK_STORAGE_LIMIT_BYTES_DEFAULT = 1024 * 1024 * 1024; // 1 GiB

const parsePositiveInt = (raw, fallback) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const sparkStorageLimitBytes = parsePositiveInt(
  process.env.FIRESTORE_SPARK_STORAGE_LIMIT_BYTES,
  SPARK_STORAGE_LIMIT_BYTES_DEFAULT
);

const loadServiceAccount = () => {
  if (env === 'dev') {
    return JSON.parse(fs.readFileSync('./retro-collections-dev.json', 'utf8'));
  }

  if (env === 'prod') {
    return JSON.parse(fs.readFileSync('./retro-collections-prod.json', 'utf8'));
  }

  console.error("Invalid ENV value. Must be 'dev' or 'prod'.");
  process.exit(1);
};

const base64urlJson = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const signJwt = ({ key, scope }) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: key.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64urlJson(header)}.${base64urlJson(claimSet)}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(key.private_key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${unsigned}.${signature}`;
};

const getAccessToken = async (key) => {
  const assertion = signJwt({
    key,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(
      `Token request failed (${tokenRes.status}): ${JSON.stringify(tokenJson)}`
    );
  }

  return tokenJson.access_token;
};

const getJson = async ({ url, accessToken }) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `GET ${url} failed (${res.status}): ${JSON.stringify(json)}`
    );
  }

  return json;
};

const listFirestoreMetricTypes = async ({ projectId, accessToken }) => {
  const types = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({
      filter: 'metric.type = starts_with("firestore.googleapis.com/")',
      pageSize: '1000',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/metricDescriptors?${params.toString()}`;
    const payload = await getJson({ url, accessToken });

    for (const descriptor of payload.metricDescriptors || []) {
      if (typeof descriptor.type === 'string') {
        types.push(descriptor.type);
      }
    }

    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  return types;
};

const selectMetricType = (allTypes, includeKeywords) =>
  allTypes.find((type) => {
    const normalized = type.toLowerCase();
    return includeKeywords.every((keyword) => normalized.includes(keyword));
  }) || null;

const extractPointBytes = (point) => {
  const value = point?.value || {};

  if (typeof value.int64Value !== 'undefined') {
    const parsed = Number(value.int64Value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value.doubleValue !== 'undefined') {
    const parsed = Number(value.doubleValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getLatestMetricValue = async ({ projectId, accessToken, metricType }) => {
  if (!metricType) return null;

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 1000 * 60 * 60 * 24 * 7);

  const params = new URLSearchParams({
    filter: `metric.type="${metricType}"`,
    'interval.startTime': startTime.toISOString(),
    'interval.endTime': endTime.toISOString(),
    view: 'FULL',
    'aggregation.alignmentPeriod': '3600s',
    'aggregation.perSeriesAligner': 'ALIGN_MAX',
    pageSize: '10',
  });

  const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params.toString()}`;
  const payload = await getJson({ url, accessToken });

  let latest = null;
  for (const series of payload.timeSeries || []) {
    for (const point of series.points || []) {
      const pointBytes = extractPointBytes(point);
      if (pointBytes == null) continue;
      if (latest == null || pointBytes > latest) {
        latest = pointBytes;
      }
    }
  }

  return latest;
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return 'n/a';

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  if (bytes === 0) return '0 B';

  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exp;
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[exp]}`;
};

const formatPercent = (value, total) => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0)
    return 'n/a';
  return `${((value / total) * 100).toFixed(2)}%`;
};

(async () => {
  try {
    const key = loadServiceAccount();
    const projectId = key.project_id;

    if (!projectId) {
      throw new Error('Missing project_id in service account file.');
    }

    const accessToken = await getAccessToken(key);

    const metricTypes = await listFirestoreMetricTypes({
      projectId,
      accessToken,
    });

    const documentMetricType =
      selectMetricType(metricTypes, ['document', 'storage', 'byte']) ||
      selectMetricType(metricTypes, ['document', 'byte']);

    const indexMetricType =
      selectMetricType(metricTypes, ['index', 'storage', 'byte']) ||
      selectMetricType(metricTypes, ['index', 'byte']);

    const documentBytes =
      (await getLatestMetricValue({
        projectId,
        accessToken,
        metricType: documentMetricType,
      })) ?? 0;

    const indexBytes =
      (await getLatestMetricValue({
        projectId,
        accessToken,
        metricType: indexMetricType,
      })) ?? 0;

    const totalBytes = documentBytes + indexBytes;
    const freeBytes = Math.max(0, sparkStorageLimitBytes - totalBytes);

    const report = {
      env,
      projectId,
      sparkStorageLimitBytes,
      sparkStorageLimitHuman: formatBytes(sparkStorageLimitBytes),
      metrics: {
        documentMetricType,
        indexMetricType,
      },
      usage: {
        documents: {
          bytes: documentBytes,
          human: formatBytes(documentBytes),
          percentOfSparkLimit: formatPercent(
            documentBytes,
            sparkStorageLimitBytes
          ),
        },
        indexes: {
          bytes: indexBytes,
          human: formatBytes(indexBytes),
          percentOfSparkLimit: formatPercent(
            indexBytes,
            sparkStorageLimitBytes
          ),
        },
        totalUsed: {
          bytes: totalBytes,
          human: formatBytes(totalBytes),
          percentOfSparkLimit: formatPercent(
            totalBytes,
            sparkStorageLimitBytes
          ),
        },
        freeRemaining: {
          bytes: freeBytes,
          human: formatBytes(freeBytes),
          percentOfSparkLimit: formatPercent(freeBytes, sparkStorageLimitBytes),
        },
      },
    };

    console.log('Firestore Spark storage report');
    console.log(`Project: ${projectId}`);
    console.log(
      `Limit:   ${report.sparkStorageLimitHuman} (${sparkStorageLimitBytes} B)`
    );
    console.log('');
    console.log(
      `Documents: ${report.usage.documents.human} (${report.usage.documents.percentOfSparkLimit})`
    );
    console.log(
      `Indexes:   ${report.usage.indexes.human} (${report.usage.indexes.percentOfSparkLimit})`
    );
    console.log(
      `Used:      ${report.usage.totalUsed.human} (${report.usage.totalUsed.percentOfSparkLimit})`
    );
    console.log(
      `Free:      ${report.usage.freeRemaining.human} (${report.usage.freeRemaining.percentOfSparkLimit})`
    );
    console.log('');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('db-storage-usage failed');
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  }
})();
