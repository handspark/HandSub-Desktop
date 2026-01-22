/**
 * security.js - 도구 보안 유틸리티
 * SSRF 방지, URL 검증 등
 */

/**
 * SSRF 방지 - 내부/사설 IP 차단
 * @param {string} hostname - 검사할 호스트명
 * @returns {boolean} 사설 호스트이면 true
 */
function isPrivateHost(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return true; // 안전을 위해 차단
  }

  const lowerHost = hostname.toLowerCase();

  // localhost 차단
  if (lowerHost === 'localhost' || lowerHost === '127.0.0.1' || lowerHost === '::1') {
    return true;
  }

  // IPv4 사설 IP 대역 차단
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Pattern);
  if (match) {
    const [, a, b] = match.map(Number);
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0
    if (a === 0) return true;
    // 255.255.255.255 (broadcast)
    if (a === 255 && b === 255) return true;
  }

  // IPv6 사설 주소 차단
  const lowerHostname = hostname.toLowerCase();
  if (
    lowerHostname.startsWith('fe80:') ||  // link-local
    lowerHostname.startsWith('fc') ||      // unique local (fc00::/7)
    lowerHostname.startsWith('fd') ||      // unique local
    lowerHostname === '::1' ||             // loopback
    lowerHostname.startsWith('::ffff:127.') // IPv4-mapped loopback
  ) {
    return true;
  }

  // 위험한 호스트명 패턴 차단
  const dangerousPatterns = [
    /^localhost$/i,
    /^127\./,
    /^0\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /\.local$/i,
    /\.internal$/i,
    /\.localhost$/i,
    /^metadata\./i,           // 클라우드 메타데이터 서비스
    /^169\.254\.169\.254$/,   // AWS/GCP 메타데이터
    /^metadata\.google\.internal$/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  return false;
}

/**
 * URL 보안 검증
 * @param {string} urlString - 검증할 URL
 * @returns {{ valid: boolean, error?: string, url?: URL }}
 */
function validateUrl(urlString) {
  // 기본 검증
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  if (urlString.length > 2000) {
    return { valid: false, error: 'URL too long' };
  }

  // URL 파싱
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // 프로토콜 검증 (http/https만 허용)
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: 'Only HTTP/HTTPS protocols allowed' };
  }

  // SSRF 검사
  if (isPrivateHost(url.hostname)) {
    return { valid: false, error: 'Internal hosts not allowed' };
  }

  // 포트 검사 (위험한 포트 차단)
  const dangerousPorts = [22, 23, 25, 110, 143, 445, 3306, 5432, 6379, 27017];
  if (url.port && dangerousPorts.includes(parseInt(url.port, 10))) {
    return { valid: false, error: 'Port not allowed' };
  }

  return { valid: true, url };
}

/**
 * 안전한 HTTP 요청 실행
 * SSRF 검사 후 요청 수행
 * @param {string} urlString - 요청 URL
 * @param {Object} options - 요청 옵션
 * @returns {Promise<Object>}
 */
async function safeRequest(urlString, options = {}) {
  const validation = validateUrl(urlString);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const url = validation.url;
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? require('https') : require('http');

  const {
    method = 'GET',
    headers = {},
    body = null,
    timeout = 10000
  } = options;

  return new Promise((resolve) => {
    const req = httpModule.request(url, {
      method,
      headers,
      timeout
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          data,
          headers: res.headers
        });
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    if (body && method !== 'GET') {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }

    req.end();
  });
}

// ===== Prototype Pollution 방지 =====

/**
 * 프로토타입 오염 가능한 위험한 키 목록
 */
const DANGEROUS_KEYS = [
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf'
];

/**
 * 키가 프로토타입 오염에 안전한지 확인
 * @param {string} key - 확인할 키
 * @returns {boolean} 안전하면 true
 */
function isSafeKey(key) {
  if (typeof key !== 'string') return false;
  return !DANGEROUS_KEYS.includes(key);
}

/**
 * 객체에 안전하게 속성 설정 (Prototype Pollution 방지)
 * @param {Object} obj - 대상 객체
 * @param {string} key - 키
 * @param {any} value - 값
 * @returns {boolean} 성공 여부
 */
function safeSet(obj, key, value) {
  if (!isSafeKey(key)) {
    console.warn(`[Security] Blocked dangerous key: ${key}`);
    return false;
  }
  obj[key] = value;
  return true;
}

/**
 * JSON을 안전하게 파싱 (위험한 키 제거)
 * @param {string} jsonString - JSON 문자열
 * @returns {Object|null} 파싱된 객체 또는 null
 */
function safeJsonParse(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return sanitizeObject(parsed);
  } catch {
    return null;
  }
}

/**
 * 객체에서 위험한 키 재귀적으로 제거
 * @param {any} obj - 정리할 객체
 * @returns {any} 정리된 객체
 */
function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const key of Object.keys(obj)) {
    if (isSafeKey(key)) {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      console.warn(`[Security] Removed dangerous key: ${key}`);
    }
  }
  return sanitized;
}

/**
 * 객체 병합 시 안전하게 수행 (Object.assign 대체)
 * @param {Object} target - 대상 객체
 * @param {...Object} sources - 소스 객체들
 * @returns {Object} 병합된 객체
 */
function safeMerge(target, ...sources) {
  for (const source of sources) {
    if (source && typeof source === 'object') {
      for (const key of Object.keys(source)) {
        if (isSafeKey(key)) {
          if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            target[key] = safeMerge(target[key] || {}, source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
    }
  }
  return target;
}

module.exports = {
  isPrivateHost,
  validateUrl,
  safeRequest,
  // Prototype Pollution 방지
  isSafeKey,
  safeSet,
  safeJsonParse,
  sanitizeObject,
  safeMerge,
  DANGEROUS_KEYS
};
