import TurndownService from 'turndown';

export function htmlToMarkdown(html, options = {}) {
  const service = createTurndown(options);
  return service.turndown(html || '');
}

function createTurndown(options) {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*'
  });

  service.addRule('figure', {
    filter: ['figure'],
    replacement(content) {
      return `\n\n${content.trim()}\n\n`;
    }
  });

  service.addRule('codeBlocks', {
    filter: (node) => node.nodeName === 'PRE' && node.querySelector('code'),
    replacement(content, node) {
      const code = node.querySelector('code');
      const className = code.getAttribute('class') || '';
      const language =
        code.getAttribute('data-language') ||
        (className.match(/language-([a-z0-9]+)/i)?.[1] || '');
      const langToken = language ? `${language}` : '';
      return `\n\n\`\`\`${langToken}\n${code.textContent}\n\`\`\`\n\n`;
    }
  });

  if (!options.keepImages) {
    service.addRule('removeImages', {
      filter: ['img'],
      replacement() {
        return '';
      }
    });
  }

  return service;
}
