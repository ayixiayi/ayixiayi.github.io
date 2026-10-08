export const site = {
  name: 'ayixiayi',
  url: 'https://www.ayixiayi.com',
  description: 'SJTU 自动化 · Sophomore · 兴趣导向型开发者。',
  github: 'https://github.com/ayixiayi',
};

export const navigation = [
  { href: '/projects/', label: '项目' },
  { href: '/blog/', label: '博客' },
  { href: '/about/', label: '关于' },
];

export const projects = [
  {
    title: 'OpenMem',
    description:
      'AI 编程 Agent 的长期记忆 MCP 服务器：按项目隔离、跨会话延续，默认完全离线运行。',
    tags: ['TypeScript', 'MCP', 'AI Agent'],
    url: 'https://github.com/ayixiayi/OpenMem',
    motif: 'memory',
  },
  {
    title: 'agentrc',
    description:
      '编码 Agent 的个人配置层，像 .bashrc 一样只补 Amp、Claude Code 与 Codex 没有的部分：危险命令拦截、AI 审批与共享偏好。',
    tags: ['TypeScript', 'Amp', 'Claude Code'],
    url: 'https://github.com/ayixiayi/agentrc',
    motif: 'orchestration',
  },
  {
    title: 'MusicBarOs',
    description: 'SJTU 工程学导论课项目，还原前流媒体时代的音乐播放体验。',
    tags: ['JavaScript'],
    url: 'https://github.com/ayixiayi/MusicBarOs',
    motif: 'music',
  },
] as const;
