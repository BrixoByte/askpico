import { describe, expect, it } from 'vitest';
import { buildMermaidDoc } from '@utils/mermaidDoc';

describe('buildMermaidDoc', () => {
  it('embeds the source as JSON and renders it strict', () => {
    const doc = buildMermaidDoc('graph TD; A-->B;');
    expect(doc).toContain('securityLevel: ' + "'strict'");
    expect(doc).toContain('"graph TD; A-->B;"');
    expect(doc).toContain('mermaid.render');
    expect(doc).toContain('panzoom(svg');
  });

  it('pins mermaid and panzoom versions', () => {
    const doc = buildMermaidDoc('graph TD; A-->B;');
    expect(doc).toContain('mermaid@11.4.1');
    expect(doc).toContain('panzoom@9.4.3');
  });

  it('neutralizes closing script tags inside the source', () => {
    const doc = buildMermaidDoc('graph TD; A["</script><script>alert(1)</script>"];');
    const jsonBlock = doc.split('id="diagram-src"')[1] ?? '';
    expect(jsonBlock).not.toContain('</script><script>');
    expect(doc.indexOf('<script')).toBeLessThan(doc.indexOf('id="diagram-src"'));
  });

  it('has a source fallback path on render failure', () => {
    const doc = buildMermaidDoc('not a diagram');
    expect(doc).toContain('Could not render diagram');
    expect(doc).toContain('id="fallback"');
  });

  it('keeps Pico palette theme variables', () => {
    const doc = buildMermaidDoc('graph TD; A-->B;');
    expect(doc).toContain('themeVariables');
    expect(doc).toContain('#5a9400');
  });
});
