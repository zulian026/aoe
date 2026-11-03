import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import { ProgressBar } from '../ProgressBar.js';

describe('ProgressBar', () => {
  it('renders determinate percentage correctly', () => {
    const output = renderToString(<ProgressBar percentage={50} width={20} unicode={false} />);
    expect(output).toContain('50%');
    expect(output).toContain('=');
  });

  it('calculates percentage from completedWork and totalWork', () => {
    const output = renderToString(
      <ProgressBar completedWork={4} totalWork={10} width={20} unicode={false} />,
    );
    expect(output).toContain('40%');
    expect(output).toContain('(4/10)');
  });

  it('handles zero or negative totalWork without division by zero or NaN', () => {
    const output1 = renderToString(<ProgressBar completedWork={5} totalWork={0} width={20} />);
    expect(output1).not.toContain('NaN');
    expect(output1).not.toContain('Infinity');
    expect(output1).toContain('indeterminate');

    const output2 = renderToString(<ProgressBar completedWork={5} totalWork={-10} width={20} />);
    expect(output2).not.toContain('NaN');
    expect(output2).toContain('indeterminate');
  });

  it('handles undefined progress as indeterminate', () => {
    const output = renderToString(<ProgressBar width={20} />);
    expect(output).toContain('indeterminate');
  });

  it('distinguishes estimated progress from verified progress', () => {
    const est = renderToString(
      <ProgressBar percentage={75} isEstimate={true} width={20} unicode={false} />,
    );
    const verified = renderToString(
      <ProgressBar percentage={75} isEstimate={false} width={20} unicode={false} />,
    );

    expect(est).toContain('~75% (est)');
    expect(verified).toContain('75%');
    expect(verified).not.toContain('(est)');
  });

  it('displays verifiedWork count when different from completedWork', () => {
    const output = renderToString(
      <ProgressBar completedWork={8} totalWork={10} verifiedWork={6} width={20} mode="detailed" />,
    );
    expect(output).toContain('[verified: 6]');
  });

  it('clamps width within safe boundaries', () => {
    const narrow = renderToString(<ProgressBar percentage={100} width={2} unicode={false} />);
    // Clamped to minimum width of 5
    expect(narrow).toContain('=====');
  });

  it('renders custom unit and description', () => {
    const output = renderToString(
      <ProgressBar
        completedWork={12}
        totalWork={24}
        unit="files"
        description="analyzing AST"
        width={20}
      />,
    );
    expect(output).toContain('12/24 files');
    expect(output).toContain('analyzing AST');
  });
});
