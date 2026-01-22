/**
 * HTTP Request Tool
 * 다양한 HTTP 메서드, 헤더, 바디 타입 지원
 */
const BaseTool = require('../BaseTool');
const { validateUrl, safeJsonParse, sanitizeObject } = require('../security');
const https = require('https');
const http = require('http');

class HttpTool extends BaseTool {
  static get meta() {
    return {
      id: 'http',
      name: 'HTTP Request',
      description: 'HTTP 요청을 전송합니다 (GET, POST, PUT, DELETE, PATCH)',
      icon: '🌐',
      category: 'integration',
      version: '1.0.0'
    };
  }

  static get schema() {
    return [
      {
        name: 'url',
        type: 'text',
        label: 'URL',
        placeholder: 'https://api.example.com/endpoint',
        required: true
      },
      {
        name: 'method',
        type: 'select',
        label: 'Method',
        options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'POST',
        required: true
      },
      {
        name: 'headers',
        type: 'keyvalue',
        label: 'Headers',
        required: false
      },
      {
        name: 'queryParams',
        type: 'keyvalue',
        label: 'Query Parameters',
        required: false
      },
      {
        name: 'bodyType',
        type: 'select',
        label: 'Body Type',
        options: ['json', 'form', 'raw', 'none'],
        default: 'json',
        required: false
      },
      {
        name: 'body',
        type: 'textarea',
        label: 'Body 템플릿',
        placeholder: '{"text": "{{내용}}"}',
        required: false,
        hint: '{{필드명}} 형식으로 동적 값 지정',
        showWhen: { field: 'bodyType', notEquals: 'none' }
      }
    ];
  }

  static get defaults() {
    return {
      url: '',
      method: 'POST',
      headers: {},
      queryParams: {},
      bodyType: 'json',
      body: ''
    };
  }

  static validate(config) {
    const errors = [];

    if (!config.url) {
      errors.push('URL is required');
    } else {
      // SSRF 방지 검증 포함
      const urlValidation = validateUrl(config.url);
      if (!urlValidation.valid) {
        errors.push(urlValidation.error);
      }
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (config.method && !validMethods.includes(config.method)) {
      errors.push('Invalid HTTP method');
    }

    return { valid: errors.length === 0, errors };
  }

  static async execute(config, context = {}) {
    try {
      // SSRF 방지: URL 보안 검증
      const urlValidation = validateUrl(config.url);
      if (!urlValidation.valid) {
        return { success: false, error: urlValidation.error };
      }

      const url = urlValidation.url;

      if (config.queryParams && typeof config.queryParams === 'object') {
        for (const [key, value] of Object.entries(config.queryParams)) {
          if (key && value !== undefined) {
            url.searchParams.append(key, value);
          }
        }
      }

      // 쿼리 파라미터 추가 후 다시 SSRF 검증 (리다이렉트 공격 방지)
      const finalValidation = validateUrl(url.toString());
      if (!finalValidation.valid) {
        return { success: false, error: finalValidation.error };
      }

      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const method = config.method || 'POST';
      const bodyType = config.bodyType || 'json';

      const headers = { ...config.headers };
      if (!headers['Content-Type'] && bodyType !== 'none') {
        headers['Content-Type'] = this.getContentType(bodyType);
      }

      let body = this.processBody(config, context, bodyType);

      return new Promise((resolve) => {
        const req = httpModule.request(url, {
          method,
          headers,
          timeout: 10000
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({
              success: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data: this.parseResponse(data, res.headers['content-type'])
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
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  static getContentType(bodyType) {
    const types = {
      json: 'application/json',
      form: 'application/x-www-form-urlencoded',
      raw: 'text/plain'
    };
    return types[bodyType] || 'application/json';
  }

  static processBody(config, context, bodyType) {
    if (bodyType === 'none') return '';

    let body = config.body || '';
    const { content } = context;

    if (content) {
      // Prototype Pollution 방지
      let variables = safeJsonParse(content);
      if (!variables) {
        variables = { content };
      }

      if (body && typeof variables === 'object') {
        body = this.replaceVariables(body, variables);

        if (body.includes('{{content}}') && variables.content) {
          body = body.split('{{content}}').join(variables.content);
        }
      } else if (!body) {
        body = JSON.stringify({ text: content });
      }
    }

    return body;
  }

  static parseResponse(data, contentType) {
    if (contentType && contentType.includes('application/json')) {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }
}

module.exports = HttpTool;
