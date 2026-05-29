async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.message || `Request failed with ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function publicBaseUrl(envName, fallbackPort) {
  return process.env[envName] || `http://localhost:${fallbackPort}`;
}

module.exports = {
  money,
  publicBaseUrl,
  requestJson,
};
