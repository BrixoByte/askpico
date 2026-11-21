// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MarkdownToHtml from './MarkdownToHtml';

afterEach(cleanup);

describe('Markdown to HTML tool', () => {
  it('shows the converted HTML in a visible output panel after Convert', () => {
    render(<MarkdownToHtml />);
    expect(screen.queryByLabelText('html output')).toBeNull();

    fireEvent.change(screen.getByLabelText('markdown input'), { target: { value: '# Hi' } });
    fireEvent.click(screen.getByText('Convert'));

    const output = screen.getByLabelText('html output');
    expect(output.textContent).toContain('<h1>Hi</h1>');
  });
});
