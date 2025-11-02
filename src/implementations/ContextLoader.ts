import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IResult } from '@chasenocap/di-framework';
import { success, failure } from '@chasenocap/di-framework';
import type {
  IContextLoader,
  IPromptContext
} from '../interfaces/IPromptTemplate.js';
import { PROMPT_TYPES } from '../types/InjectionTokens.js';

/**
 * Context loader with progressive loading strategies
 */
@injectable()
export class ContextLoader implements IContextLoader {
  constructor(
    @inject(PROMPT_TYPES.ILogger) private readonly logger: ILogger
  ) {}

  async loadContext(
    strategy: string,
    options?: Record<string, unknown>
  ): Promise<IResult<IPromptContext>> {
    try {
      const context: IPromptContext = {
        variables: {},
        environment: { ...process.env },
        timestamp: new Date(),
        sessionId: options?.sessionId as string
      };

      switch (strategy) {
        case 'progressive':
          return this.loadProgressiveContext(context, options);
        
        case 'all':
          return this.loadAllContext(context, options);
        
        case 'minimal':
          return this.loadMinimalContext(context, options);
        
        default:
          return failure(new Error(`Unknown context loading strategy: ${strategy}`));
      }
    } catch (error) {
      this.logger.error('Failed to load context', error as Error, { strategy });
      return failure(error as Error);
    }
  }

  async loadProgressive(levels: number): Promise<IResult<Partial<IPromptContext>>> {
    try {
      const context: Partial<IPromptContext> = {
        variables: {}
      };

      // Load context progressively based on levels
      for (let level = 1; level <= levels; level++) {
        const levelResult = await this.loadContextLevel(level);
        if (levelResult.success) {
          // Merge variables from this level
          Object.assign(context.variables!, levelResult.data.variables);
        }
      }

      this.logger.debug(`Loaded progressive context for ${levels} levels`, {
        levels,
        variableCount: Object.keys(context.variables!).length
      });

      return success(context);
    } catch (error) {
      this.logger.error('Failed to load progressive context', error as Error, { levels });
      return failure(error as Error);
    }
  }

  async validateRequirements(requirements: string[]): Promise<IResult<boolean>> {
    try {
      const missing: string[] = [];

      for (const requirement of requirements) {
        const available = await this.checkRequirementAvailability(requirement);
        if (!available) {
          missing.push(requirement);
        }
      }

      if (missing.length > 0) {
        this.logger.warn('Missing context requirements', { missing });
        return success(false);
      }

      return success(true);
    } catch (error) {
      this.logger.error('Failed to validate requirements', error as Error, { requirements });
      return failure(error as Error);
    }
  }

  private async loadProgressiveContext(
    baseContext: IPromptContext,
    options?: Record<string, unknown>
  ): Promise<IResult<IPromptContext>> {
    try {
      // Level 1: Basic environment and project info
      const level1 = await this.loadBasicProjectInfo();
      if (level1.success) {
        Object.assign(baseContext.variables, level1.data);
      }

      // Level 2: File system context (if requested)
      if (options?.includeFileSystem) {
        const level2 = await this.loadFileSystemContext(options.workingDirectory as string);
        if (level2.success) {
          Object.assign(baseContext.variables, level2.data);
        }
      }

      // Level 3: Git context (if available)
      if (options?.includeGit) {
        const level3 = await this.loadGitContext(options.workingDirectory as string);
        if (level3.success) {
          Object.assign(baseContext.variables, level3.data);
        }
      }

      this.logger.debug('Loaded progressive context', {
        variableCount: Object.keys(baseContext.variables).length,
        hasFileSystem: !!options?.includeFileSystem,
        hasGit: !!options?.includeGit
      });

      return success(baseContext);
    } catch (error) {
      return failure(error as Error);
    }
  }

  private async loadAllContext(
    baseContext: IPromptContext,
    options?: Record<string, unknown>
  ): Promise<IResult<IPromptContext>> {
    try {
      // Load all available context
      const workingDir = options?.workingDirectory as string || process.cwd();
      
      const [basicInfo, fileSystem, gitInfo] = await Promise.allSettled([
        this.loadBasicProjectInfo(),
        this.loadFileSystemContext(workingDir),
        this.loadGitContext(workingDir)
      ]);

      // Merge all successful results
      if (basicInfo.status === 'fulfilled' && basicInfo.value.success) {
        Object.assign(baseContext.variables, basicInfo.value.data);
      }

      if (fileSystem.status === 'fulfilled' && fileSystem.value.success) {
        Object.assign(baseContext.variables, fileSystem.value.data);
      }

      if (gitInfo.status === 'fulfilled' && gitInfo.value.success) {
        Object.assign(baseContext.variables, gitInfo.value.data);
      }

      this.logger.debug('Loaded all available context', {
        variableCount: Object.keys(baseContext.variables).length
      });

      return success(baseContext);
    } catch (error) {
      return failure(error as Error);
    }
  }

  private async loadMinimalContext(
    baseContext: IPromptContext,
    _options?: Record<string, unknown>
  ): Promise<IResult<IPromptContext>> {
    try {
      // Only load essential variables
      baseContext.variables = {
        timestamp: new Date().toISOString(),
        platform: process.platform,
        nodeVersion: process.version
      };

      this.logger.debug('Loaded minimal context', {
        variableCount: Object.keys(baseContext.variables).length
      });

      return success(baseContext);
    } catch (error) {
      return failure(error as Error);
    }
  }

  private async loadContextLevel(level: number): Promise<IResult<{ variables: Record<string, unknown> }>> {
    const variables: Record<string, unknown> = {};

    switch (level) {
      case 1:
        // Basic system info
        variables.platform = process.platform;
        variables.nodeVersion = process.version;
        variables.timestamp = new Date().toISOString();
        break;

      case 2:
        // Working directory info
        variables.workingDirectory = process.cwd();
        try {
          const fs = await import('fs/promises');
          const packageJsonPath = `${process.cwd()}/package.json`;
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          variables.projectName = packageJson.name;
          variables.projectVersion = packageJson.version;
        } catch {
          // Ignore if package.json doesn't exist
        }
        break;

      case 3:
        // Environment variables (filtered)
        variables.environment = this.getFilteredEnvironment();
        break;

      default:
        this.logger.warn(`Unknown context level: ${level}`);
    }

    return success({ variables });
  }

  private async loadBasicProjectInfo(): Promise<IResult<Record<string, unknown>>> {
    try {
      const variables: Record<string, unknown> = {
        platform: process.platform,
        nodeVersion: process.version,
        workingDirectory: process.cwd(),
        timestamp: new Date().toISOString()
      };

      // Try to load package.json info
      try {
        const fs = await import('fs/promises');
        const packageJsonPath = `${process.cwd()}/package.json`;
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        variables.projectName = packageJson.name;
        variables.projectVersion = packageJson.version;
        variables.projectDescription = packageJson.description;
        variables.projectType = packageJson.type || 'commonjs';
      } catch {
        // Package.json not found or invalid - not an error
        variables.projectName = 'unknown';
      }

      return success(variables);
    } catch (error) {
      return failure(error as Error);
    }
  }

  private async loadFileSystemContext(workingDir?: string): Promise<IResult<Record<string, unknown>>> {
    try {
      const dir = workingDir || process.cwd();
      const fs = await import('fs/promises');
      
      const variables: Record<string, unknown> = {
        workingDirectory: dir
      };

      try {
        const files = await fs.readdir(dir);
        variables.fileCount = files.length;
        variables.hasPackageJson = files.includes('package.json');
        variables.hasTsConfig = files.includes('tsconfig.json');
        variables.hasGitIgnore = files.includes('.gitignore');
        
        // Check for common project types
        if (files.includes('package.json')) {
          variables.projectType = 'nodejs';
        }
        if (files.includes('Cargo.toml')) {
          variables.projectType = 'rust';
        }
        if (files.includes('pyproject.toml') || files.includes('setup.py')) {
          variables.projectType = 'python';
        }
      } catch (error) {
        this.logger.warn('Failed to read directory contents', { dir, error });
      }

      return success(variables);
    } catch (error) {
      return failure(error as Error);
    }
  }

  private async loadGitContext(workingDir?: string): Promise<IResult<Record<string, unknown>>> {
    try {
      const variables: Record<string, unknown> = {};

      // Basic git info - in a real implementation, you'd use git commands
      // For now, just check if .git exists
      try {
        const fs = await import('fs/promises');
        const gitDir = `${workingDir || process.cwd()}/.git`;
        await fs.access(gitDir);
        
        variables.isGitRepository = true;
        // In a real implementation, you'd run git commands to get:
        // - current branch
        // - commit hash
        // - remote URL
        // - modified files
        // etc.
      } catch {
        variables.isGitRepository = false;
      }

      return success(variables);
    } catch (error) {
      return failure(error as Error);
    }
  }

  private async checkRequirementAvailability(requirement: string): Promise<boolean> {
    // Check if a specific context requirement is available
    switch (requirement) {
      case 'package.json':
        try {
          const fs = await import('fs/promises');
          await fs.access(`${process.cwd()}/package.json`);
          return true;
        } catch {
          return false;
        }

      case 'git':
        try {
          const fs = await import('fs/promises');
          await fs.access(`${process.cwd()}/.git`);
          return true;
        } catch {
          return false;
        }

      case 'typescript':
        try {
          const fs = await import('fs/promises');
          await fs.access(`${process.cwd()}/tsconfig.json`);
          return true;
        } catch {
          return false;
        }

      default:
        // Unknown requirement
        return false;
    }
  }

  private getFilteredEnvironment(): Record<string, string> {
    // Return filtered environment variables (exclude sensitive ones)
    const filtered: Record<string, string> = {};
    const allowedPrefixes = ['NODE_', 'npm_', 'PATH'];
    const excludeKeys = ['TOKEN', 'SECRET', 'PASSWORD', 'KEY'];

    for (const [key, value] of Object.entries(process.env)) {
      if (!value) continue;

      const shouldInclude = allowedPrefixes.some(prefix => key.startsWith(prefix)) &&
                           !excludeKeys.some(exclude => key.toUpperCase().includes(exclude));

      if (shouldInclude) {
        filtered[key] = value;
      }
    }

    return filtered;
  }
}