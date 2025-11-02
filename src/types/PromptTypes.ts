/**
 * Core types for the prompt-toolkit package
 */

export interface IVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: unknown;
  description?: string;
}

export interface ICondition {
  type: 'equals' | 'exists' | 'in' | 'contains' | 'not' | 'and' | 'or';
  variable?: string;
  value?: unknown;
  conditions?: ICondition[];
}

export interface IContextLevel {
  depth: number;
  condition?: ICondition;
  load: string[];
  purpose?: string;
}

export interface IContextLoading {
  strategy: 'progressive' | 'all' | 'minimal';
  levels?: IContextLevel[];
}

export interface ITask {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[];
  estimate?: string;
}

export interface ITaskDefinition {
  objective: string;
  requirements: ITask[];
  constraints?: string[];
  deliverables?: string[];
}

export interface IThinkingLevel {
  depth: 'surface' | 'analysis' | 'strategic' | 'architectural';
  focus?: string;
  duration?: string;
}

export interface IPromptTemplate {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  extends?: string; // Template inheritance
  variables?: IVariable[];
  contextLoading?: IContextLoading;
  taskDefinition?: ITaskDefinition;
  thinkingLevel?: IThinkingLevel;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface IPromptContext {
  variables: Record<string, unknown>;
  environment?: Record<string, unknown>;
  timestamp?: Date;
  sessionId?: string;
}

export interface IConstructedPrompt {
  id: string;
  templateId: string;
  content: string;
  context: IPromptContext;
  metadata: {
    constructedAt: Date;
    templateVersion?: string;
    estimatedTokens?: number;
  };
}

export interface ITemplateValidationError {
  type: 'syntax' | 'semantic' | 'missing_variable' | 'circular_dependency';
  message: string;
  location?: {
    line?: number;
    column?: number;
    element?: string;
  };
}

export interface ITemplateValidationResult {
  valid: boolean;
  errors: ITemplateValidationError[];
  warnings: ITemplateValidationError[];
}

export interface IPromptConstructionOptions {
  validateVariables?: boolean;
  includeMetadata?: boolean;
  estimateTokens?: boolean;
  context?: Partial<IPromptContext>;
}

export type PromptTemplateFormat = 'xml' | 'yaml' | 'json';

export interface ITemplateParseResult {
  template: IPromptTemplate;
  format: PromptTemplateFormat;
  raw: string;
}