/**
 * Dependency injection container setup for prompt-toolkit
 */

import { Container } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import { createLogger } from '@chasenocap/logger';
import type { IResult } from '@chasenocap/di-framework';
import { success, failure } from '@chasenocap/di-framework';

// Import all interfaces and implementations
import type {
  IPromptToolkit,
  ITemplateParser,
  ITemplateRegistry,
  IPromptConstructor,
  IContextLoader
} from '../interfaces/IPromptTemplate.js';

import { PromptToolkit } from '../implementations/PromptToolkit.js';
import { XmlTemplateParser } from '../implementations/XmlTemplateParser.js';
import { TemplateRegistry } from '../implementations/TemplateRegistry.js';
import { PromptConstructor } from '../implementations/PromptConstructor.js';
import { ContextLoader } from '../implementations/ContextLoader.js';

import { PROMPT_TYPES } from '../types/InjectionTokens.js';

/**
 * Configuration options for the prompt toolkit
 */
export interface IPromptToolkitConfig {
  logger?: ILogger;
  loggerName?: string;
}

/**
 * Create a pre-configured dependency injection container for the prompt toolkit
 */
export function createPromptContainer(config?: IPromptToolkitConfig): Container {
  const container = new Container();

  // Bind logger
  const logger = config?.logger || createLogger(config?.loggerName || 'prompt-toolkit');
  container.bind<ILogger>(PROMPT_TYPES.ILogger).toConstantValue(logger);

  // Bind core implementations
  container.bind<ITemplateParser>(PROMPT_TYPES.ITemplateParser).to(XmlTemplateParser).inSingletonScope();
  container.bind<ITemplateRegistry>(PROMPT_TYPES.ITemplateRegistry).to(TemplateRegistry).inSingletonScope();
  container.bind<IPromptConstructor>(PROMPT_TYPES.IPromptConstructor).to(PromptConstructor).inSingletonScope();
  container.bind<IContextLoader>(PROMPT_TYPES.IContextLoader).to(ContextLoader).inSingletonScope();
  container.bind<IPromptToolkit>(PROMPT_TYPES.IPromptToolkit).to(PromptToolkit).inSingletonScope();

  // Bind configuration
  container.bind(PROMPT_TYPES.PromptToolkitConfig).toConstantValue(config || {});

  return container;
}

/**
 * Create and initialize a prompt toolkit instance
 */
export async function createPromptToolkit(config?: IPromptToolkitConfig): Promise<IResult<IPromptToolkit>> {
  try {
    const container = createPromptContainer(config);
    const toolkit = container.get<IPromptToolkit>(PROMPT_TYPES.IPromptToolkit);
    
    // Initialize the toolkit
    const initResult = await toolkit.initialize();
    if (!initResult.success) {
      return failure(initResult.error);
    }

    return success(toolkit);
  } catch (error) {
    return failure(error as Error);
  }
}

/**
 * Helper function to get a specific service from a container
 */
export function getPromptService<T>(container: Container, token: symbol): T {
  return container.get<T>(token);
}

/**
 * Create a container with custom logger
 */
export function createPromptContainerWithLogger(logger: ILogger): Container {
  return createPromptContainer({ logger });
}