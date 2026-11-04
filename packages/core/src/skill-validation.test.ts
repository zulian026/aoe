import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills/aoe');
const REFERENCES_DIR = path.join(SKILL_DIR, 'references');
const EXAMPLES_DIR = path.join(SKILL_DIR, 'examples');

const REQUIRED_REFERENCES = [
  'output-hierarchy.md',
  'status-system.md',
  'progress-reporting.md',
  'file-changes.md',
  'command-output.md',
  'diagnostics.md',
  'visual-formatting.md',
  'engine-integration.md',
];

const REQUIRED_EXAMPLES = [
  'task-in-progress.md',
  'task-completed.md',
  'task-failed.md',
  'code-review.md',
  'implementation-report.md',
  'debugging-session.md',
];

const CANONICAL_STATUSES = [
  'IDLE',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'BLOCKED',
  'CANCELLED',
  'WARNING',
];

describe('AOE Skill Validation Suite', () => {
  describe('1. SKILL.md Frontmatter and Structure', () => {
    const skillPath = path.join(SKILL_DIR, 'SKILL.md');

    it('exists and is readable', () => {
      expect(fs.existsSync(skillPath)).toBe(true);
    });

    it('contains valid YAML frontmatter with name and description', () => {
      const content = fs.readFileSync(skillPath, 'utf8');
      expect(content).toMatch(/^---\r?\n[\s\S]*?\r?\n---/);
      expect(content).toMatch(/name:\s*aoe/);
      expect(content).toMatch(/description:\s*.+/);
    });

    it('contains all required top-level architectural sections', () => {
      const content = fs.readFileSync(skillPath, 'utf8');
      expect(content).toContain('Core Invariants');
      expect(content).toContain('Information Hierarchy');
      expect(content).toContain('Semantic Status Lifecycle');
      expect(content).toContain('Operational Presentation Standards');
      expect(content).toContain('Safe Engine Detection & Fallback');
      expect(content).toContain('Reference Documentation');
      expect(content).toContain('Reference Examples');
    });

    describe('frontmatter parser regression tests', () => {
      const frontmatterPattern = /^---\r?\n[\s\S]*?\r?\n---/;

      it('accepts standard LF newlines in frontmatter', () => {
        const lfContent = '---\nname: aoe\ndescription: test\n---\n# Body\n';
        expect(lfContent).toMatch(frontmatterPattern);
      });

      it('accepts Windows CRLF newlines in frontmatter', () => {
        const crlfContent = '---\r\nname: aoe\r\ndescription: test\r\n---\r\n# Body\r\n';
        expect(crlfContent).toMatch(frontmatterPattern);
      });

      it('rejects input missing the opening delimiter', () => {
        const missingOpen = 'name: aoe\ndescription: test\n---\n# Body\n';
        expect(missingOpen).not.toMatch(frontmatterPattern);
      });

      it('rejects input missing the closing delimiter', () => {
        const missingClose = '---\nname: aoe\ndescription: test\n# Body without closing\n';
        expect(missingClose).not.toMatch(frontmatterPattern);
      });

      it('rejects input without newline immediately following opening delimiter', () => {
        const malformedOpen = '---name: aoe\n---\n# Body\n';
        expect(malformedOpen).not.toMatch(frontmatterPattern);
      });
    });
  });

  describe('2. Required Reference Documents', () => {
    for (const refFile of REQUIRED_REFERENCES) {
      describe(`Reference: ${refFile}`, () => {
        const refPath = path.join(REFERENCES_DIR, refFile);

        it(`exists at references/${refFile}`, () => {
          expect(fs.existsSync(refPath)).toBe(true);
        });

        it('contains all required standardized sections', () => {
          const content = fs.readFileSync(refPath, 'utf8');
          expect(content).toContain('## Purpose');
          expect(content).toContain('## Rules');
          expect(content).toContain('## Formatting Conventions');
          expect(content).toContain('## Good Examples');
          expect(content).toContain('## Bad Examples');
          expect(content).toContain('## Edge Cases');
        });
      });
    }
  });

  describe('3. Required Example Documents', () => {
    for (const egFile of REQUIRED_EXAMPLES) {
      describe(`Example: ${egFile}`, () => {
        const egPath = path.join(EXAMPLES_DIR, egFile);

        it(`exists at examples/${egFile}`, () => {
          expect(fs.existsSync(egPath)).toBe(true);
        });

        it('contains substantive, non-empty content', () => {
          const content = fs.readFileSync(egPath, 'utf8');
          expect(content.trim().length).toBeGreaterThan(150);
        });

        it('uses a canonical semantic status badge', () => {
          const content = fs.readFileSync(egPath, 'utf8');
          const hasCanonicalStatus = CANONICAL_STATUSES.some((st) => content.includes(`\`${st}\``));
          expect(hasCanonicalStatus).toBe(true);
        });
      });
    }
  });

  describe('4. Internal Link Consistency', () => {
    it('verifies all linked reference and example files in SKILL.md exist', () => {
      const skillPath = path.join(SKILL_DIR, 'SKILL.md');
      const content = fs.readFileSync(skillPath, 'utf8');

      // Match markdown links e.g. [text](file:///path/to/file.md) or (path/to/file.md)
      const linkRegex = /\]\((file:\/\/\/([^)]+)|([a-zA-Z0-9_./-]+\.md))\)/g;
      let match: RegExpExecArray | null;
      let linksFound = 0;

      while ((match = linkRegex.exec(content)) !== null) {
        linksFound++;
        const targetPath = match[2]
          ? match[2].startsWith('/')
            ? match[2]
            : '/' + match[2]
          : path.resolve(SKILL_DIR, match[3]);
        expect(fs.existsSync(targetPath), `Target path does not exist: ${targetPath}`).toBe(true);
      }

      expect(linksFound).toBeGreaterThanOrEqual(
        REQUIRED_REFERENCES.length + REQUIRED_EXAMPLES.length,
      );
    });
  });

  describe('5. Semantic Status Consistency', () => {
    it('defines all 7 canonical statuses identically across SKILL.md and status-system.md', () => {
      const statusDoc = fs.readFileSync(path.join(REFERENCES_DIR, 'status-system.md'), 'utf8');
      const skillDoc = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

      for (const status of CANONICAL_STATUSES) {
        expect(statusDoc).toContain(`\`${status}\``);
        expect(skillDoc).toContain(`\`${status}\``);
      }
    });

    it('enforces verification before completion rule in status-system.md and SKILL.md', () => {
      const statusDoc = fs.readFileSync(path.join(REFERENCES_DIR, 'status-system.md'), 'utf8');
      const skillDoc = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

      expect(statusDoc.toLowerCase()).toContain('verification before completion');
      expect(skillDoc.toLowerCase()).toContain('verify before completion');
    });
  });

  describe('6. Deterministic Progress and Anti-Fabrication Rules', () => {
    it('explicitly prohibits fabricated percentages', () => {
      const progressDoc = fs.readFileSync(
        path.join(REFERENCES_DIR, 'progress-reporting.md'),
        'utf8',
      );
      const skillDoc = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

      expect(progressDoc.toLowerCase()).toContain('never fabricate percentages');
      expect(skillDoc.toLowerCase()).toContain('never fabricate progress');
    });

    it('mandates evidence-backed file change assertions', () => {
      const fileChangesDoc = fs.readFileSync(path.join(REFERENCES_DIR, 'file-changes.md'), 'utf8');
      expect(fileChangesDoc.toLowerCase()).toContain('evidence requirement');
    });
  });

  describe('7. Safe Engine Detection & Fallback Contract', () => {
    it('specifies native markdown fallback when AOE engine is absent', () => {
      const engineDoc = fs.readFileSync(path.join(REFERENCES_DIR, 'engine-integration.md'), 'utf8');
      const skillDoc = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

      expect(engineDoc.toLowerCase()).toContain('portable-first');
      expect(engineDoc.toLowerCase()).toContain('fallback to native');
      expect(skillDoc.toLowerCase()).toContain('portable-first & standalone');
    });

    it('strictly forbids automatic dependency or CLI installation', () => {
      const engineDoc = fs.readFileSync(path.join(REFERENCES_DIR, 'engine-integration.md'), 'utf8');
      const skillDoc = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

      expect(engineDoc.toLowerCase()).toContain('no automatic installation');
      expect(skillDoc.toLowerCase()).toContain('no automatic execution');
    });
  });

  describe('8. Privacy and Safety Standards', () => {
    it('strictly protects private chain-of-thought and credentials in SKILL.md', () => {
      const skillDoc = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
      expect(skillDoc.toLowerCase()).toContain('privacy & reasoning protection');
      expect(skillDoc.toLowerCase()).toContain('chain-of-thought');
    });

    it('mandates masking sensitive information in command output', () => {
      const cmdDoc = fs.readFileSync(path.join(REFERENCES_DIR, 'command-output.md'), 'utf8');
      expect(cmdDoc.toLowerCase()).toContain('mask sensitive information');
    });
  });
});
