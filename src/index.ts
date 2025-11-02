/**
 * @chasenocap/prompt-toolkit - XML template system and prompt construction utilities
 * 
 * Main exports for the metaGOTHIC prompt toolkit package
 */

// Re-export reflect-metadata for decorator support
import 'reflect-metadata';

// Core interfaces
export type {
  IPromptToolkit,
  ITemplateParser,
  ITemplateRegistry,
  IPromptConstructor,
  IContextLoader
} from './interfaces/IPromptTemplate.js';

// Types
export type {
  IPromptTemplate,
  IPromptContext,
  IConstructedPrompt,
  IVariable,
  ICondition,
  IContextLevel,
  IContextLoading,
  ITask,
  ITaskDefinition,
  IThinkingLevel,
  ITemplateValidationError,
  ITemplateValidationResult,
  IPromptConstructionOptions,
  ITemplateParseResult,
  PromptTemplateFormat
} from './types/PromptTypes.js';

// Implementations
export { XmlTemplateParser } from './implementations/XmlTemplateParser.js';
export { TemplateRegistry } from './implementations/TemplateRegistry.js';
export { PromptConstructor } from './implementations/PromptConstructor.js';
export { ContextLoader } from './implementations/ContextLoader.js';
export { PromptToolkit } from './implementations/PromptToolkit.js';

// Injection tokens
export { PROMPT_TYPES, type PromptTypes } from './types/InjectionTokens.js';

// Utility functions
export { createPromptToolkit, createPromptContainer } from './utils/PromptContainer.js';