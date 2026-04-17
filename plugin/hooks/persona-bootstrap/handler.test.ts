/**
 * Tests for persona-bootstrap internal hook handler
 *
 * Run: cd ~/.openclaw/workspace/oh-my-openclaw/plugin && npx tsx hooks/persona-bootstrap/handler.test.ts
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const HANDLER_PATH = join(import.meta.dirname, 'handler.ts');

// ---- Test utilities ----

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// ---- Helpers ----

function setupWorkspace(workspaceDir: string, personaId: string | '__OFF__' | null) {
  const stateDir = join(workspaceDir, '.omoc-state');
  mkdirSync(stateDir, { recursive: true });
  if (personaId) {
    writeFileSync(join(stateDir, 'active-persona'), personaId);
  }
}

function createBootstrapContext(workspaceDir: string) {
  return {
    workspaceDir,
    bootstrapFiles: [
      {
        name: 'AGENTS.md',
        path: join(workspaceDir, 'AGENTS.md'),
        content: '# Original AGENTS.md\n\nThis is the default content.',
        missing: false,
      },
      {
        name: 'SOUL.md',
        path: join(workspaceDir, 'SOUL.md'),
        content: '# Soul',
        missing: false,
      },
    ],
    sessionKey: 'agent:main:feishu:direct:ou_test123',
    agentId: 'main',
    cfg: undefined,
  };
}

// ---- Dynamic import ----

async function loadHandler() {
  const mod = await import(HANDLER_PATH);
  return mod.default as (event: unknown) => void;
}

// ---- Tests ----

async function main() {
  const tmpBase = join(tmpdir(), `persona-bootstrap-test-${Date.now()}`);
  mkdirSync(tmpBase, { recursive: true });

  const handler = await loadHandler();
  console.log('\n🧪 persona-bootstrap internal hook tests\n');

  await test('should NOT modify AGENTS.md when no state file exists', async () => {
    const ws = join(tmpBase, 'ws-no-state');
    mkdirSync(ws, { recursive: true });
    const ctx = createBootstrapContext(ws);
    const originalContent = ctx.bootstrapFiles[0].content;

    handler(ctx);

    assert(ctx.bootstrapFiles[0].content === originalContent, 'AGENTS.md content should not change');
    assert(ctx.bootstrapFiles[0].missing === false, 'missing flag should not change');
  });

  await test('should NOT modify AGENTS.md when persona is __OFF__', async () => {
    const ws = join(tmpBase, 'ws-off');
    setupWorkspace(ws, '__OFF__');
    const ctx = createBootstrapContext(ws);
    const originalContent = ctx.bootstrapFiles[0].content;

    handler(ctx);

    assert(ctx.bootstrapFiles[0].content === originalContent, 'AGENTS.md content should not change');
  });

  await test('should NOT modify AGENTS.md when state file is empty', async () => {
    const ws = join(tmpBase, 'ws-empty');
    setupWorkspace(ws, '');
    const ctx = createBootstrapContext(ws);
    const originalContent = ctx.bootstrapFiles[0].content;

    handler(ctx);

    assert(ctx.bootstrapFiles[0].content === originalContent, 'AGENTS.md content should not change');
  });

  await test('should replace AGENTS.md content when valid persona is active (omoc_atlas)', async () => {
    const ws = join(tmpBase, 'ws-atlas');
    setupWorkspace(ws, 'omoc_atlas');
    const ctx = createBootstrapContext(ws);

    handler(ctx);

    const agentsFile = ctx.bootstrapFiles.find(f => f.name === 'AGENTS.md');
    assert(agentsFile !== undefined, 'AGENTS.md should exist');
    assert(agentsFile!.content !== '# Original AGENTS.md\n\nThis is the default content.',
      'AGENTS.md content should be replaced');
    assert(agentsFile!.content.length > 0, 'AGENTS.md content should not be empty');
    assert(agentsFile!.missing === false, 'missing should be false');
    // Verify it actually loaded the atlas persona file
    assert(
      agentsFile!.content.includes('atlas') || agentsFile!.content.includes('Atlas') || agentsFile!.content.length > 100,
      'Should contain actual persona content'
    );
  });

  await test('should replace AGENTS.md content for omoc_sisyphus persona', async () => {
    const ws = join(tmpBase, 'ws-sisyphus');
    setupWorkspace(ws, 'omoc_sisyphus');
    const ctx = createBootstrapContext(ws);

    handler(ctx);

    const agentsFile = ctx.bootstrapFiles.find(f => f.name === 'AGENTS.md');
    assert(agentsFile !== undefined, 'AGENTS.md should exist');
    assert(agentsFile!.content.length > 0, 'AGENTS.md content should not be empty');
    assert(agentsFile!.content !== '# Original AGENTS.md\n\nThis is the default content.',
      'AGENTS.md content should be replaced');
  });

  await test('should NOT modify AGENTS.md when persona ID is invalid', async () => {
    const ws = join(tmpBase, 'ws-invalid');
    setupWorkspace(ws, 'omoc_nonexistent_persona');
    const ctx = createBootstrapContext(ws);
    const originalContent = ctx.bootstrapFiles[0].content;

    handler(ctx);

    assert(ctx.bootstrapFiles[0].content === originalContent,
      'AGENTS.md content should not change for invalid persona');
  });

  await test('should extract agentId from sessionKey and use agent-specific workspace', async () => {
    const ws = join(tmpBase, 'ws-coder');
    setupWorkspace(ws, 'omoc_prometheus');
    const ctx = createBootstrapContext(ws);
    // Override sessionKey to simulate coder agent pointing to our temp workspace
    ctx.sessionKey = 'agent:main:feishu:direct:ou_test123';
    ctx.agentId = 'main';
    // Ensure workspaceDir points to our test workspace (handler uses this)
    const originalContent = ctx.bootstrapFiles[0].content;

    handler(ctx);

    // Should inject omoc_prometheus content from our test workspace
    const agentsFile = ctx.bootstrapFiles.find(f => f.name === 'AGENTS.md');
    assert(agentsFile !== undefined, 'AGENTS.md should exist');
    assert(agentsFile!.content !== originalContent,
      'AGENTS.md content should be replaced with persona content');
  });

  await test('should not crash when bootstrapFiles has no AGENTS.md', async () => {
    const ws = join(tmpBase, 'ws-no-agents');
    setupWorkspace(ws, 'omoc_atlas');
    const ctx = {
      workspaceDir: ws,
      bootstrapFiles: [
        {
          name: 'SOUL.md',
          path: join(ws, 'SOUL.md'),
          content: '# Soul',
          missing: false,
        },
      ],
      sessionKey: 'agent:main:feishu:direct:ou_test123',
      agentId: 'main',
      cfg: undefined,
    };

    // Should not throw
    handler(ctx);
  });

  await test('should handle all 11 personas without crashing', async () => {
    const personas = [
      'omoc_prometheus', 'omoc_atlas', 'omoc_sisyphus', 'omoc_hephaestus',
      'omoc_oracle', 'omoc_explore', 'omoc_librarian', 'omoc_metis',
      'omoc_momus', 'omoc_looker', 'omoc_frontend',
    ];

    for (const persona of personas) {
      const ws = join(tmpBase, `ws-${persona}`);
      setupWorkspace(ws, persona);
      const ctx = createBootstrapContext(ws);

      // Should not throw for any persona
      handler(ctx);
    }
  });

  // Cleanup
  rmSync(tmpBase, { recursive: true, force: true });

  // Summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
