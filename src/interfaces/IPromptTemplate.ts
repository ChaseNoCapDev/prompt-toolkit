import type { IResult } from '@chasenocap/di-framework';
import type {
  IPromptTemplate,
  IPromptContext,
  IConstructedPrompt,
  ITemplateValidationResult,
  ITemplateParseResult,
  IPromptConstructionOptions,
  PromptTemplateFormat
} from '../types/PromptTypes.js';

/**
 * Interface for template parsing operations
 */
export interface ITemplateParser {
  /**
   * Parse template from string content
   */
  parse(content: string, format?: PromptTemplateFormat): Promise<IResult<ITemplateParseResult>>;

  /**
   * Parse template from file
   */
  parseFile(filePath: string): Promise<IResult<ITemplateParseResult>>;

  /**
   * Validate template structure and content
   */
  validate(template: IPromptTemplate): Promise<IResult<ITemplateValidationResult>>;

  /**
   * Get supported formats
   */
  getSupportedFormats(): PromptTemplateFormat[];
}

/**
 * Interface for template management and storage
 */
export interface ITemplateRegistry {
  /**
   * Register a template
   */
  register(template: IPromptTemplate): Promise<IResult<void>>;

  /**
   * Get template by ID
   */
  get(id: string): Promise<IResult<IPromptTemplate>>;

  /**
   * List all templates
   */
  list(): Promise<IResult<IPromptTemplate[]>>;

  /**
   * Search templates by criteria
   */
  search(query: string): Promise<IResult<IPromptTemplate[]>>;

  /**
   * Remove template
   */
  remove(id: string): Promise<IResult<void>>;

  /**
   * Check if template exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Get template with inheritance resolved
   */
  getResolved(id: string): Promise<IResult<IPromptTemplate>>;
}

/**
 * Interface for prompt construction
 */
export interface IPromptConstructor {
  /**
   * Construct prompt from template
   */
  construct(
    templateId: string,
    context: IPromptContext,
    options?: IPromptConstructionOptions
  ): Promise<IResult<IConstructedPrompt>>;

  /**
   * Construct prompt from template object
   */
  constructFromTemplate(
    template: IPromptTemplate,
    context: IPromptContext,
    options?: IPromptConstructionOptions
  ): Promise<IResult<IConstructedPrompt>>;

  /**
   * Validate construction context
   */
  validateContext(template: IPromptTemplate, context: IPromptContext): Promise<IResult<ITemplateValidationResult>>;

  /**
   * Estimate token count for constructed prompt
   */
  estimateTokens(content: string): number;
}

/**
 * Interface for context loading strategies
 */
export interface IContextLoader {
  /**
   * Load context based on strategy
   */
  loadContext(strategy: string, options?: Record<string, unknown>): Promise<IResult<IPromptContext>>;

  /**
   * Load progressive context levels
   */
  loadProgressive(levels: number): Promise<IResult<Partial<IPromptContext>>>;

  /**
   * Validate context loading requirements
   */
  validateRequirements(requirements: string[]): Promise<IResult<boolean>>;
}

/**
 * Main interface for the prompt toolkit
 */
export interface IPromptToolkit {
  /**
   * Template parser instance
   */
  readonly parser: ITemplateParser;

  /**
   * Template registry instance
   */
  readonly registry: ITemplateRegistry;

  /**
   * Prompt constructor instance
   */
  readonly constructor: IPromptConstructor;

  /**
   * Context loader instance
   */
  readonly contextLoader: IContextLoader;

  /**
   * Initialize the toolkit
   */
  initialize(): Promise<IResult<void>>;

  /**
   * Shutdown and cleanup resources
   */
  shutdown(): Promise<IResult<void>>;
}