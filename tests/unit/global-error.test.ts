import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import GlobalError from '../../app/global-error';

// Built with createElement rather than JSX so the suite stays within the
// tests/unit/**/*.test.ts pattern that vitest.config.ts collects.
function render() {
  return renderToStaticMarkup(
    createElement(GlobalError, {
      error: new Error('root layout exploded'),
      reset: vi.fn(),
    }),
  );
}

describe('app/global-error.tsx', () => {
  it('supplies its own document shell because it replaces the root layout', () => {
    const markup = render();

    expect(markup).toContain('<html');
    expect(markup).toContain('lang="vi"');
    expect(markup).toContain('<body>');
  });

  it('renders the shared recovery copy and retry control', () => {
    const markup = render();

    expect(markup).toContain('Đã có lỗi không mong muốn.');
    expect(markup).toContain('Thử lại');
    expect(markup).toContain('type="button"');
  });

  it('never exposes the thrown error to the rendered page', () => {
    const markup = render();

    expect(markup).not.toContain('root layout exploded');
  });
});
