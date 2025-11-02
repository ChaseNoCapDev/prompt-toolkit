/**
 * Dependency injection tokens for the prompt-toolkit package
 */

export const PROMPT_TYPES = {
  // Core interfaces
  IPromptToolkit: Symbol.for('IPromptToolkit'),
  ITemplateParser: Symbol.for('ITemplateParser'),
  ITemplateRegistry: Symbol.for('ITemplateRegistry'),
  IPromptConstructor: Symbol.for('IPromptConstructor'),
  IContextLoader: Symbol.for('IContextLoader'),

  // External dependencies
  ILogger: Symbol.for('ILogger'),

  // Configuration
  PromptToolkitConfig: Symbol.for('PromptToolkitConfig')
} as const;

export type PromptTypes = typeof PROMPT_TYPES;