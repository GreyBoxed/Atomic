import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface TempRepo {
  dir: string;
  git: (...args: string[]) => Promise<string>;
  writeFile: (relativePath: string, content: string) => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * Create a temporary git repo for testing.
 * Includes git user config so commits work without global config.
 */
export async function createTempRepo(
  options: { initialCommit?: boolean } = {}
): Promise<TempRepo> {
  const dir = await mkdtemp(join(tmpdir(), "atomic-test-"));

  const gitCmd = async (...args: string[]): Promise<string> => {
    const { stdout } = await execFileAsync("git", args, {
      cwd: dir,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  };

  await gitCmd("init");
  await gitCmd("config", "user.name", "Test");
  await gitCmd("config", "user.email", "test@test.com");

  const writeFileHelper = async (
    relativePath: string,
    content: string
  ): Promise<void> => {
    await writeFile(join(dir, relativePath), content);
  };

  if (options.initialCommit !== false) {
    await writeFileHelper("README.md", "# test\n");
    await gitCmd("add", "README.md");
    await gitCmd("commit", "-m", "initial commit");
  }

  return {
    dir,
    git: gitCmd,
    writeFile: writeFileHelper,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
