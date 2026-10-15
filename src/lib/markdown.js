import { parseHTML } from 'linkedom';

// 注意：這裡刻意不用 turndown。turndown 在 Worker 裡會走 Node 分支去要 document，
// 直接拋 `ReferenceError: document is not defined`（線上實測 500）。
// 這個版本用 linkedom 自己走 DOM 樹，Workers / Node / Docker 都能跑。
export function htmlToMarkdown(html, options = {}) {
  if (!html) {
    return '';
  }
  const { document } = parseHTML(wrapHtml(html));
  const context = {
    keepImages: Boolean(options.keepImages),
    listStack: [],
    inPre: false
  };
  const output = renderChildren(document.body || document, context);
  return collapseBlankLines(output).trim();
}

function wrapHtml(html) {
  if (/^\s*<(!doctype|html)\b/i.test(html)) {
    return html;
  }
  return `<!doctype html><html><body>${html}</body></html>`;
}

function renderChildren(node, ctx) {
  if (!node || !node.childNodes) {
    return '';
  }
  let result = '';
  node.childNodes.forEach((child) => {
    result += renderNode(child, ctx);
  });
  return result;
}

function renderNode(node, ctx) {
  switch (node.nodeType) {
    case 3: // text
      return formatText(node.textContent, ctx);
    case 1: // element
      return renderElement(node, ctx);
    default:
      return '';
  }
}

function renderElement(node, ctx) {
  const tag = node.nodeName.toLowerCase();
  switch (tag) {
    case 'p':
    case 'div':
    case 'section':
    case 'article':
      return block(renderChildren(node, ctx));
    case 'br':
      return '  \n';
    case 'strong':
    case 'b':
      return emphasize(renderInline(node, ctx), '**');
    case 'em':
    case 'i':
      return emphasize(renderInline(node, ctx), '*');
    case 'u':
      return emphasize(renderInline(node, ctx), '_');
    case 'del':
    case 's':
      return emphasize(renderInline(node, ctx), '~~');
    case 'span':
      return renderInline(node, ctx);
    case 'a':
      return renderLink(node, ctx);
    case 'img':
      return renderImage(node, ctx);
    case 'blockquote':
      return renderBlockquote(node, ctx);
    case 'pre':
      return renderPre(node, ctx);
    case 'code':
      return renderCode(node, ctx);
    case 'ul':
      return renderList(node, ctx, 'ul');
    case 'ol':
      return renderList(node, ctx, 'ol');
    case 'li':
      return renderListItem(node, ctx);
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return renderHeading(node, ctx, Number(tag.slice(1)) || 1);
    case 'hr':
      return '\n\n---\n\n';
    case 'figure':
      return block(renderChildren(node, ctx));
    case 'figcaption':
      return block(`_${renderInline(node, ctx).trim()}_`);
    default:
      return renderChildren(node, ctx);
  }
}

function renderInline(node, ctx) {
  return renderChildren(node, ctx);
}

function emphasize(value, marker) {
  const text = value.trim();
  if (!text) {
    return '';
  }
  if (marker === '~~') {
    return `~~${text}~~`;
  }
  return `${marker}${text}${marker}`;
}

function renderHeading(node, ctx, level) {
  const content = renderInline(node, ctx).trim();
  if (!content) {
    return '';
  }
  const hashes = '#'.repeat(Math.max(1, Math.min(level, 6)));
  return `\n${hashes} ${content}\n\n`;
}

function renderLink(node, ctx) {
  const href = node.getAttribute('href') || '';
  const text = renderInline(node, ctx).trim();
  if (!href) {
    return text;
  }
  return `[${text || href}](${href})`;
}

function renderImage(node, ctx) {
  if (!ctx.keepImages) {
    return '';
  }
  const src = node.getAttribute('src');
  if (!src) {
    return '';
  }
  const alt = node.getAttribute('alt') || '';
  return `![${escapeMarkdown(alt)}](${src})`;
}

function renderBlockquote(node, ctx) {
  const content = renderChildren(node, ctx).trim();
  if (!content) {
    return '';
  }
  const quoted = content.split(/\n+/).map((line) => `> ${line}`).join('\n');
  return `${quoted}\n\n`;
}

function renderPre(node, ctx) {
  const previous = ctx.inPre;
  ctx.inPre = true;
  const codeNode = node.querySelector?.('code');
  const text = (codeNode?.textContent ?? node.textContent) || '';
  ctx.inPre = previous;
  const code = text.replace(/\s+$/, '');
  const language = detectLanguage(codeNode);
  return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
}

function detectLanguage(node) {
  if (!node) {
    return '';
  }
  const className = node.getAttribute('class') || '';
  const raw = node.getAttribute('data-language') || className.match(/language-([a-z0-9+#-]+)/i)?.[1] || '';
  return /^[a-z0-9+#-]+$/i.test(raw) ? raw : '';
}

function renderCode(node, ctx) {
  if (ctx.inPre) {
    return node.textContent || '';
  }
  const content = (node.textContent || '').trim();
  if (!content) {
    return '';
  }
  return `\`${content.replace(/`/g, '\\`')}\``;
}

function renderList(node, ctx, type) {
  ctx.listStack.push({ type, index: 0 });
  const body = Array.from(node.children).map((child) => renderListItem(child, ctx)).join('');
  ctx.listStack.pop();
  return body ? `\n${body}\n` : '';
}

function renderListItem(node, ctx) {
  if (node.nodeName.toLowerCase() !== 'li') {
    return renderNode(node, ctx);
  }
  const current = ctx.listStack[ctx.listStack.length - 1];
  const indent = '  '.repeat(Math.max(0, ctx.listStack.length - 1));
  let prefix = '- ';
  if (current?.type === 'ol') {
    current.index += 1;
    prefix = `${current.index}. `;
  }
  const content = renderChildren(node, ctx).trim().replace(/\n/g, `\n${indent}  `);
  return `${indent}${prefix}${content}\n`;
}

function block(value) {
  const text = value.trim();
  return text ? `${text}\n\n` : '';
}

function formatText(text, ctx) {
  if (!text) {
    return '';
  }
  if (ctx.inPre) {
    return text;
  }
  return text.replace(/\s+/g, ' ');
}

function escapeMarkdown(text) {
  return String(text || '').replace(/([\\`*_{}[\]()#+\-!.])/g, '\\$1');
}

function collapseBlankLines(value) {
  return value.replace(/\n{3,}/g, '\n\n');
}
