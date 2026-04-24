import { writeFile, mkdir } from 'fs/promises';
import { spawnSync } from 'child_process';

/**
 * Renders Mermaid code to a PNG. Returns the output path, or null if rendering fails.
 * We swallow errors on purpose: a failed diagram shouldn't block a text post.
 */
export async function renderMermaid(code: string): Promise<string | null> {
  try {
    const dir = '/tmp/linkedin-bot';
    await mkdir(dir, { recursive: true });
    const inPath = `${dir}/diagram.mmd`;
    const outPath = `${dir}/diagram.png`;
    await writeFile(inPath, code);

    const result = spawnSync(
      'npx',
      ['-y', '@mermaid-js/mermaid-cli', '-i', inPath, '-o', outPath, '-b', 'white', '-w', '1200'],
      { stdio: 'inherit' }
    );

    if (result.status !== 0) {
      console.warn('Mermaid render failed, posting without image');
      return null;
    }
    return outPath;
  } catch (err) {
    console.warn('Mermaid render errored:', err);
    return null;
  }
}
