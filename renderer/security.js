/**
 * security.js - 렌더러 보안 유틸리티
 * XSS 방지를 위한 HTML 이스케이프 등
 */

/**
 * HTML 특수문자 이스케이프
 * @param {string} str - 이스케이프할 문자열
 * @returns {string} 이스케이프된 문자열
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') str = String(str);

  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;'
  };

  return str.replace(/[&<>"'`/]/g, char => escapeMap[char]);
}

/**
 * URL 검증 (file:// 프로토콜 포함)
 * @param {string} url - 검증할 URL
 * @returns {boolean} 유효한 URL이면 true
 */
export function isValidFileUrl(url) {
  if (!url || typeof url !== 'string') return false;

  // file:// URL 검증
  if (url.startsWith('file://')) {
    // 경로 탐색 공격 방지
    const path = url.replace('file://', '');
    if (path.includes('..') || path.includes('%2e%2e') || path.includes('%2E%2E')) {
      return false;
    }
    // 허용된 확장자만
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];
    const lowerPath = path.toLowerCase();
    return allowedExtensions.some(ext => lowerPath.endsWith(ext));
  }

  // http/https URL
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 안전한 아이콘 경로 검증
 * @param {string} iconPath - 아이콘 경로
 * @returns {boolean} 안전한 경로이면 true
 */
export function isValidIconPath(iconPath) {
  if (!iconPath || typeof iconPath !== 'string') return false;

  // 이모지는 허용 (짧은 문자열, 특수문자 없음)
  if (iconPath.length <= 4 && !iconPath.includes('/') && !iconPath.includes('\\')) {
    return true;
  }

  // 파일 경로 검증
  if (iconPath.includes('/') || iconPath.includes('\\')) {
    // 경로 탐색 방지
    if (iconPath.includes('..')) return false;

    // 허용된 확장자만
    const allowedExtensions = ['.png', '.svg', '.jpg', '.jpeg', '.gif', '.webp', '.ico'];
    const lowerPath = iconPath.toLowerCase();
    return allowedExtensions.some(ext => lowerPath.endsWith(ext));
  }

  return true;
}

/**
 * CSS 색상 값 검증
 * @param {string} color - 색상 값
 * @returns {boolean} 유효한 색상이면 true
 */
export function isValidColor(color) {
  if (!color || typeof color !== 'string') return false;

  // hex 색상
  if (/^#[0-9A-Fa-f]{3,8}$/.test(color)) return true;

  // rgb/rgba
  if (/^rgba?\([^)]+\)$/.test(color)) {
    // 숫자와 콤마, 공백만 허용
    const inner = color.match(/\(([^)]+)\)/)?.[1] || '';
    return /^[\d\s,./]+$/.test(inner);
  }

  // 알려진 색상 이름만 허용
  const safeColors = ['red', 'green', 'blue', 'white', 'black', 'gray', 'transparent'];
  return safeColors.includes(color.toLowerCase());
}

/**
 * DOM 요소 안전하게 생성
 * @param {string} tag - 태그 이름
 * @param {Object} attrs - 속성 객체
 * @param {string} textContent - 텍스트 내용 (자동 이스케이프됨)
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, textContent = null) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on')) {
      // 이벤트 핸들러는 무시 (보안)
      continue;
    } else {
      el.setAttribute(key, String(value));
    }
  }

  if (textContent !== null) {
    el.textContent = textContent; // 자동 이스케이프
  }

  return el;
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
  '__lookupSetter__'
];

/**
 * 키가 프로토타입 오염에 안전한지 확인
 * @param {string} key - 확인할 키
 * @returns {boolean} 안전하면 true
 */
export function isSafeKey(key) {
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
export function safeSet(obj, key, value) {
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
export function safeJsonParse(jsonString) {
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
export function sanitizeObject(obj) {
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
    }
  }
  return sanitized;
}
