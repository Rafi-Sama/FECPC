#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

// ANSI color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function runStep(command, args, options = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const durationMs = Math.round(performance.now() - start);
      resolve({
        success: code === 0,
        code,
        durationMs,
        stdout,
        stderr,
      });
    });

    proc.on('error', (err) => {
      const durationMs = Math.round(performance.now() - start);
      resolve({
        success: false,
        code: 1,
        durationMs,
        stdout,
        stderr: err.message,
      });
    });
  });
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function main() {
  console.log(`\n${c.bold}${c.cyan}┌──────────────────────────────────────────────────────────┐${c.reset}`);
  console.log(`${c.bold}${c.cyan}│   FECPC Monorepo Automated Workspace Health Check        │${c.reset}`);
  console.log(`${c.bold}${c.cyan}└──────────────────────────────────────────────────────────┘${c.reset}\n`);

  const results = [];
  let hasFailure = false;

  const steps = [
    {
      title: 'Auto-Fix Code Formatting (Prettier)',
      desc: 'Formattable files (.ts, .tsx, .json, .js, .mjs)',
      command: 'pnpm',
      args: ['exec', 'prettier', '--write', 'apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', '*.json'],
      fixable: true,
    },
    {
      title: 'Auto-Fix ESLint Issues',
      desc: 'Lint rules & auto-fixes across all packages',
      command: 'pnpm',
      args: ['exec', 'eslint', 'apps', 'packages', '--fix'],
      fixable: true,
    },
    {
      title: 'TypeScript Type Checking',
      desc: 'Strict type validation across all workspaces',
      command: 'pnpm',
      args: ['turbo', 'run', 'typecheck'],
      fixable: false,
    },
    {
      title: 'Automated Test Suite',
      desc: 'Unit, domain & security contract specifications',
      command: 'pnpm',
      args: ['turbo', 'run', 'test'],
      fixable: false,
    },
    {
      title: 'Production Bundle Build',
      desc: 'Next.js Turbopack & Fastify/NestJS output compilation',
      command: 'pnpm',
      args: ['turbo', 'run', 'build'],
      fixable: false,
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    process.stdout.write(` ${c.gray}[${i + 1}/${steps.length}]${c.reset} ${c.bold}${step.title}${c.reset}... `);

    const res = await runStep(step.command, step.args);

    if (res.success) {
      const tag = step.fixable ? `${c.green}✓ FIXED / VERIFIED${c.reset}` : `${c.green}✓ PASSED${c.reset}`;
      console.log(`${tag} ${c.dim}(${formatDuration(res.durationMs)})${c.reset}`);
      results.push({
        title: step.title,
        status: 'PASSED',
        durationMs: res.durationMs,
        fixable: step.fixable,
      });
    } else {
      console.log(`${c.red}✗ FAILED${c.reset} ${c.dim}(${formatDuration(res.durationMs)})${c.reset}`);
      results.push({
        title: step.title,
        status: 'FAILED',
        durationMs: res.durationMs,
        fixable: step.fixable,
        error: (res.stderr || res.stdout || 'Unknown error').trim(),
      });
      hasFailure = true;
      // Stop on first failure to show immediate actionable error
      break;
    }
  }

  console.log(`\n${c.bold}════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}                   SUMMARY REPORT                          ${c.reset}`);
  console.log(`${c.bold}════════════════════════════════════════════════════════════${c.reset}`);

  for (const r of results) {
    const icon = r.status === 'PASSED' ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    const name = r.title.padEnd(42, ' ');
    const time = formatDuration(r.durationMs).padStart(8, ' ');
    const statusText = r.status === 'PASSED' ? `${c.green}OK${c.reset}` : `${c.red}FAIL${c.reset}`;
    console.log(`  ${icon} ${name} [${statusText}] ${c.dim}${time}${c.reset}`);

    if (r.error) {
      console.log(`\n${c.red}── Details for ${r.title}: ──${c.reset}`);
      console.log(r.error.split('\n').slice(-15).join('\n'));
      console.log(`${c.red}──────────────────────────────────────────────────────────${c.reset}\n`);
    }
  }

  console.log(`${c.bold}════════════════════════════════════════════════════════════${c.reset}\n`);

  if (hasFailure) {
    console.log(`${c.red}${c.bold}✗ Some checks failed. Resolve the errors above and rerun pnpm check.${c.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${c.green}${c.bold}✨ All checks passed! Workspace is clean, formatted, and ready for dev.${c.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal checker error:', err);
  process.exit(1);
});
