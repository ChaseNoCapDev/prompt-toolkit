import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IResult } from '@chasenocap/di-framework';
import { success, failure } from '@chasenocap/di-framework';
import type {
  IPromptToolkit,
  ITemplateParser,
  ITemplateRegistry,
  IPromptConstructor,
  IContextLoader
} from '../interfaces/IPromptTemplate.js';
import { PROMPT_TYPES } from '../types/InjectionTokens.js';

/**
 * Main prompt toolkit implementation
 */
@injectable()
export class PromptToolkit implements IPromptToolkit {
  constructor(
    @inject(PROMPT_TYPES.ITemplateParser) public readonly parser: ITemplateParser,
    @inject(PROMPT_TYPES.ITemplateRegistry) public readonly registry: ITemplateRegistry,
    @inject(PROMPT_TYPES.IPromptConstructor) public readonly constructor: IPromptConstructor,
    @inject(PROMPT_TYPES.IContextLoader) public readonly contextLoader: IContextLoader,
    @inject(PROMPT_TYPES.ILogger) private readonly logger: ILogger
  ) {}

  async initialize(): Promise<IResult<void>> {
    try {
      this.logger.info('Initializing PromptToolkit');

      // Load default templates if any exist
      await this.loadDefaultTemplates();

      this.logger.info('PromptToolkit initialized successfully');
      return success(undefined);
    } catch (error) {
      this.logger.error('Failed to initialize PromptToolkit', error as Error);
      return failure(error as Error);
    }
  }

  async shutdown(): Promise<IResult<void>> {
    try {
      this.logger.info('Shutting down PromptToolkit');

      // Perform any necessary cleanup
      // For now, there's nothing to clean up

      this.logger.info('PromptToolkit shutdown completed');
      return success(undefined);
    } catch (error) {
      this.logger.error('Failed to shutdown PromptToolkit', error as Error);
      return failure(error as Error);
    }
  }

  private async loadDefaultTemplates(): Promise<void> {
    try {
      // Load built-in templates from the templates directory
      const path = await import('path');
      const fs = await import('fs/promises');
      
      const templatesDir = path.join(__dirname, '..', 'templates');
      
      try {
        const files = await fs.readdir(templatesDir);
        const xmlFiles = files.filter(file => file.endsWith('.xml'));

        for (const file of xmlFiles) {
          try {
            const filePath = path.join(templatesDir, file);
            const parseResult = await this.parser.parseFile(filePath);
            
            if (parseResult.success) {
              const registerResult = await this.registry.register(parseResult.data.template);
              if (registerResult.success) {
                this.logger.debug(`Loaded default template: ${parseResult.data.template.id}`);
              } else {
                this.logger.warn(`Failed to register template from ${file}`, registerResult.error);
              }
            } else {
              this.logger.warn(`Failed to parse template file ${file}`, parseResult.error);
            }
          } catch (error) {
            this.logger.warn(`Error loading template file ${file}`, error as Error);
          }
        }
      } catch (error) {
        this.logger.debug('No templates directory found or error reading it', error as Error);
      }
    } catch (error) {
      this.logger.warn('Failed to load default templates', error as Error);
    }
  }
}