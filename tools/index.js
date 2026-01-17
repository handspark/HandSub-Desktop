/**
 * Tool Registry - 심플한 도구 관리
 */
const fs = require('fs');
const path = require('path');
const ManifestTool = require('./ManifestTool');

class ToolRegistry {
  constructor() {
    this.tools = new Map();  // 기존 코드 도구 (webhook, http)
    this.toolIcons = new Map();  // 도구별 아이콘 경로
    this.manifestTools = new Map();  // 매니페스트 도구
    this.loadTools();
  }

  loadTools() {
    const toolsDir = __dirname;
    const entries = fs.readdirSync(toolsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

      const folder = path.join(toolsDir, entry.name);
      const jsPath = path.join(folder, 'index.js');
      const manifestPath = path.join(folder, 'manifest.json');
      const iconPath = path.join(folder, 'icon.png');

      // 아이콘 경로 확인 (icon.png 있으면 저장)
      const hasIcon = fs.existsSync(iconPath);

      // 1. 코드 도구 (기존 호환)
      if (fs.existsSync(jsPath)) {
        try {
          const Tool = require(jsPath);
          this.tools.set(Tool.meta.id, Tool);
          // icon.png 있으면 경로 저장, 없으면 meta.icon 사용
          this.toolIcons.set(Tool.meta.id, hasIcon ? iconPath : Tool.meta.icon);
        } catch (e) {
          console.error(`Tool load error (${entry.name}):`, e.message);
        }
      }
      // 2. 매니페스트 도구
      else if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          const tool = new ManifestTool(manifest, entry.name);
          this.manifestTools.set(entry.name, tool);
          // icon.png 있으면 경로 저장, 없으면 manifest icon 사용
          this.toolIcons.set(entry.name, hasIcon ? iconPath : tool.icon);
        } catch (e) {
          console.error(`Manifest load error (${entry.name}):`, e.message);
        }
      }
    }
  }

  // 도구 아이콘 조회
  getIcon(id) {
    return this.toolIcons.get(id) || '🔧';
  }

  // 기존 도구 목록 (설정 UI용)
  list() {
    return Array.from(this.tools.values()).map(Tool => ({
      ...Tool.meta,
      schema: Tool.schema,
      defaults: Tool.defaults
    }));
  }

  // 매니페스트 도구 목록
  listManifestTools() {
    return Array.from(this.manifestTools.values()).map(tool => ({
      id: tool.id,
      name: tool.name,
      icon: tool.icon,
      settings: tool.getSettingsSchema(),
      commands: tool.getCommands()
    }));
  }

  // 모든 명령어 목록 (단축어 자동 등록용)
  getAllCommands() {
    const commands = [];
    for (const tool of this.manifestTools.values()) {
      for (const cmd of tool.getCommands()) {
        commands.push({
          ...cmd,
          toolName: tool.name,
          toolIcon: tool.icon
        });
      }
    }
    return commands;
  }

  // 기존 도구 실행
  async execute(type, config, context) {
    const Tool = this.tools.get(type);
    if (!Tool) return { success: false, error: 'Unknown tool' };
    return Tool.execute(config, context);
  }

  // 매니페스트 도구 실행
  async executeManifest(toolId, shortcut, fieldValues, toolSettings) {
    const tool = this.manifestTools.get(toolId);
    if (!tool) return { success: false, error: 'Unknown manifest tool' };
    return tool.execute(shortcut, fieldValues, toolSettings);
  }

  get(id) {
    return this.tools.get(id) || null;
  }

  getManifest(id) {
    return this.manifestTools.get(id) || null;
  }

  // 유효한 도구 타입인지 확인
  isValidType(type) {
    return this.tools.has(type) || this.manifestTools.has(type);
  }

  // 도구 스키마 조회
  getSchema(type) {
    const Tool = this.tools.get(type);
    return Tool ? Tool.schema : null;
  }
}

const registry = new ToolRegistry();

module.exports = { ToolRegistry, registry };
