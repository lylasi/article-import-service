import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '../src/lib/markdown.js';

describe('htmlToMarkdown', () => {
  it('drops images when keepImages=false', () => {
    const md = htmlToMarkdown('<p>Hello<img src="a.jpg" alt="x" /></p>', { keepImages: false });
    expect(md).not.toContain('![');
  });

  it('keeps code fences', () => {
    const md = htmlToMarkdown('<pre><code class="language-js">console.log(1);</code></pre>');
    expect(md).toContain('```js');
  });
});
