import type { SessionSnapshot, TaskSnapshot } from '@aoe/core';
import { OBSIDIAN_THEME, type ThemeDefinition } from '@aoe/themes';
import { formatDuration, maskSecrets, stripAnsi } from '@aoe/components';
import { supportsColor, isNoColor } from './environment.js';

export interface StaticRendererOptions {
  stream?: NodeJS.WritableStream;
  theme?: ThemeDefinition;
  noColor?: boolean;
}

export class StaticRenderer {
  private readonly stream: NodeJS.WritableStream;
  private readonly theme: ThemeDefinition;
  private readonly noColor: boolean;
  private lastSessionStatus?: string;
  private lastCompletedTasks = 0;
  private lastFailedTasks = 0;
  private lastFileChangesCount = 0;
  private lastDiagnosticsCount = 0;

  constructor(options: StaticRendererOptions = {}) {
    this.stream = options.stream ?? process.stdout;
    this.theme = options.theme ?? OBSIDIAN_THEME;
    this.noColor =
      options.noColor ?? (isNoColor() || !supportsColor(this.stream as NodeJS.WriteStream));
  }

  public getTheme(): ThemeDefinition {
    return this.theme;
  }

  /**
   * Renders a linear text representation of the SessionSnapshot.
   */
  public render(snapshot: SessionSnapshot): void {
    const lines: string[] = [];

    // Header banner on status change or initial render
    if (this.lastSessionStatus !== snapshot.status) {
      this.lastSessionStatus = snapshot.status;
      const statusTag = `[${snapshot.status.toUpperCase()}]`;
      const agentText = snapshot.agent?.name ? ` (agent: ${snapshot.agent.name})` : '';
      const durText = snapshot.durationMs ? ` - ${formatDuration(snapshot.durationMs)}` : '';
      lines.push(`AOE Session ${snapshot.sessionId}: ${statusTag}${agentText}${durText}`);
    }

    // Overall Progress if available
    if (snapshot.progress) {
      const pct =
        snapshot.progress.percentage ??
        (snapshot.progress.totalWork && snapshot.progress.totalWork > 0
          ? Math.round((snapshot.progress.completedWork / snapshot.progress.totalWork) * 100)
          : null);

      if (pct !== null) {
        const est = snapshot.progress.isEstimate ? ' ~' : ' ';
        const desc = snapshot.progress.description ? ` - ${snapshot.progress.description}` : '';
        lines.push(
          `  Progress:${est}${pct}% (${snapshot.progress.completedWork}/${snapshot.progress.totalWork ?? '?'})${desc}`,
        );
      }
    }

    // Task Summary
    const taskCount = snapshot.tasks.size;
    if (
      taskCount > 0 &&
      (snapshot.completedTaskCount !== this.lastCompletedTasks ||
        snapshot.failedTaskCount !== this.lastFailedTasks)
    ) {
      this.lastCompletedTasks = snapshot.completedTaskCount;
      this.lastFailedTasks = snapshot.failedTaskCount;

      lines.push(
        `  Tasks (${taskCount}): ${snapshot.completedTaskCount} completed, ${snapshot.activeTaskCount} active, ${snapshot.failedTaskCount} failed`,
      );

      // List tasks
      for (const task of snapshot.tasks.values()) {
        const taskLine = this.formatTaskLine(task);
        lines.push(`    ${taskLine}`);
      }
    }

    // New file changes
    if (snapshot.fileChanges.length > this.lastFileChangesCount) {
      const newChanges = snapshot.fileChanges.slice(this.lastFileChangesCount);
      this.lastFileChangesCount = snapshot.fileChanges.length;

      for (const fc of newChanges) {
        const delta = fc.lineDelta
          ? ` (+${fc.lineDelta.added ?? 0} -${fc.lineDelta.removed ?? 0})`
          : '';
        const verified = fc.evidence?.verifiedOnDisk ? ' [verified]' : ' [unverified]';
        lines.push(`  File [${fc.action}]: ${fc.path}${delta}${verified}`);
      }
    }

    // New diagnostics
    if (snapshot.diagnostics.length > this.lastDiagnosticsCount) {
      const newDiags = snapshot.diagnostics.slice(this.lastDiagnosticsCount);
      this.lastDiagnosticsCount = snapshot.diagnostics.length;

      for (const diag of newDiags) {
        const hyp = diag.isHypothesis ? ' [HYPOTHESIS]' : '';
        const loc = diag.location?.path
          ? ` at ${diag.location.path}:${diag.location.line ?? 0}`
          : '';
        lines.push(`  Diagnostic [${diag.severity.toUpperCase()}]${hyp}${loc}: ${diag.message}`);
        if (diag.suggestedRemediation) {
          lines.push(`    Remediation: ${diag.suggestedRemediation}`);
        }
      }
    }

    // Write formatted lines to stream
    for (const line of lines) {
      const sanitized = this.noColor ? stripAnsi(maskSecrets(line)) : maskSecrets(line);
      this.stream.write(`${sanitized}\n`);
    }
  }

  private formatTaskLine(task: TaskSnapshot): string {
    const statusTag = `[${task.status.toUpperCase()}]`;
    const dur = task.durationMs ? ` (${formatDuration(task.durationMs)})` : '';
    const desc = task.resultSummary ? ` - ${task.resultSummary}` : '';
    return `${task.name} ${statusTag}${dur}${desc}`;
  }
}
