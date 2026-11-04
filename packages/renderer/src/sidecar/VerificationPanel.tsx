import React from 'react';
import { Box, Text } from 'ink';
import type { AoeTheme } from '@zyanx04/themes';
import type { SidecarVerificationEvidence } from '@zyanx04/core';
import { Panel, resolveThemeColor } from '@zyanx04/components';

export interface VerificationPanelProps {
  verificationStatus: {
    verified: boolean;
    evidenceCount: number;
    evidenceList: SidecarVerificationEvidence[];
  };
  sessionStatus: 'uninitialized' | 'active' | 'completed' | 'failed' | 'cancelled';
  hasActiveTasks: boolean;
  width?: number;
  theme?: AoeTheme;
  noColor?: boolean;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  verificationStatus,
  sessionStatus,
  hasActiveTasks,
  width,
  theme,
  noColor = false,
}) => {
  const successColor = resolveThemeColor('success', theme, noColor);
  const warningColor = resolveThemeColor('warning', theme, noColor);
  const errorColor = resolveThemeColor('error', theme, noColor);
  const mutedColor = resolveThemeColor('foregroundMuted', theme, noColor);
  const subtleColor = resolveThemeColor('foregroundSubtle', theme, noColor);

  // Derive verification badge strictly based on evidence
  let badgeLabel = 'UNKNOWN';
  let badgeColor = subtleColor;
  let explanation = 'Session state not yet determined.';

  if (sessionStatus === 'uninitialized') {
    badgeLabel = 'UNKNOWN';
    badgeColor = subtleColor;
    explanation = 'Awaiting initial agent lifecycle events.';
  } else if (verificationStatus.verified && verificationStatus.evidenceCount > 0) {
    badgeLabel = 'VERIFIED';
    badgeColor = successColor;
    explanation = `${verificationStatus.evidenceCount} canonical verification check(s) passed.`;
  } else if (sessionStatus === 'failed') {
    badgeLabel = 'FAILED';
    badgeColor = errorColor;
    explanation = 'Task or session completed with failure status.';
  } else if (hasActiveTasks || sessionStatus === 'active') {
    badgeLabel = 'PENDING';
    badgeColor = warningColor;
    explanation = 'Execution in progress. Final verification pending task completion.';
  } else if (sessionStatus === 'completed') {
    badgeLabel = 'UNVERIFIED';
    badgeColor = mutedColor;
    explanation = 'Session ended without explicit verification artifacts or checks.';
  }

  return (
    <Panel
      title="VERIFICATION"
      metadata={`[${badgeLabel}]`}
      width={width}
      theme={theme}
      noColor={noColor}
    >
      <Box flexDirection="column" width="100%">
        {/* Verification Status Badge */}
        <Box flexDirection="row" alignItems="center">
          <Box flexShrink={0}>
            <Text bold color={badgeColor}>
              {badgeLabel === 'VERIFIED'
                ? '✔ VERIFIED'
                : badgeLabel === 'FAILED'
                  ? '✖ FAILED'
                  : badgeLabel === 'PENDING'
                    ? '⏳ PENDING'
                    : badgeLabel === 'UNVERIFIED'
                      ? '○ UNVERIFIED'
                      : '? UNKNOWN'}
            </Text>
          </Box>
          <Box marginLeft={1}>
            <Text color={mutedColor}>— {explanation}</Text>
          </Box>
        </Box>

        {/* Verification Evidence List */}
        {verificationStatus.evidenceList.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={subtleColor} bold>
              Evidence Artifacts:
            </Text>
            {verificationStatus.evidenceList.slice(-3).map((ev, idx) => (
              <Box key={idx} flexDirection="row" marginLeft={1}>
                <Text color={successColor}>• </Text>
                <Text color={mutedColor}>[{ev.taskId}] </Text>
                <Text>{ev.resultSummary ?? 'Verified with exit code 0 / clean assert'}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Panel>
  );
};
