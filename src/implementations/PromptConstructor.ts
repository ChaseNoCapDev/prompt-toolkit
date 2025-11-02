import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IResult } from '@chasenocap/di-framework';
import { success, failure } from '@chasenocap/di-framework';
import type {
  IPromptConstructor,
  ITemplateRegistry,
  IPromptTemplate,
  IPromptContext,
  IConstructedPrompt,
  IPromptConstructionOptions,
  ITemplateValidationResult,
  ITemplateValidationError
} from '../interfaces/IPromptTemplate.js';
import { PROMPT_TYPES } from '../types/InjectionTokens.js';

/**
 * Prompt constructor with variable interpolation and validation
 */
@injectable()
export class PromptConstructor implements IPromptConstructor {
  constructor(
    @inject(PROMPT_TYPES.ITemplateRegistry) private readonly registry: ITemplateRegistry,
    @inject(PROMPT_TYPES.ILogger) private readonly logger: ILogger
  ) {}

  async construct(
    templateId: string,
    context: IPromptContext,
    options?: IPromptConstructionOptions
  ): Promise<IResult<IConstructedPrompt>> {
    try {
      // Get resolved template (with inheritance)
      const templateResult = await this.registry.getResolved(templateId);
      if (!templateResult.success) {
        return failure(templateResult.error);
      }

      return this.constructFromTemplate(templateResult.data, context, options);
    } catch (error) {
      this.logger.error('Failed to construct prompt', error as Error, {
        templateId,
        sessionId: context.sessionId
      });
      return failure(error as Error);
    }
  }

  async constructFromTemplate(
    template: IPromptTemplate,
    context: IPromptContext,
    options?: IPromptConstructionOptions
  ): Promise<IResult<IConstructedPrompt>> {
    try {
      // Validate context if requested
      if (options?.validateVariables) {
        const validationResult = await this.validateContext(template, context);
        if (!validationResult.success) {
          return failure(validationResult.error);
        }

        if (!validationResult.data.valid) {
          return failure(new Error(
            `Context validation failed: ${validationResult.data.errors.map(e => e.message).join(', ')}`
          ));
        }
      }

      // Interpolate variables in content
      const interpolatedContent = this.interpolateVariables(template.content, context.variables);

      // Estimate tokens if requested
      let estimatedTokens: number | undefined;
      if (options?.estimateTokens) {
        estimatedTokens = this.estimateTokens(interpolatedContent);
      }

      const constructedPrompt: IConstructedPrompt = {
        id: this.generateId(),
        templateId: template.id,
        content: interpolatedContent,
        context: { ...context },
        metadata: {
          constructedAt: new Date(),
          templateVersion: template.version,
          estimatedTokens
        }
      };

      this.logger.debug('Constructed prompt', {
        promptId: constructedPrompt.id,
        templateId: template.id,
        estimatedTokens,
        contentLength: interpolatedContent.length
      });

      return success(constructedPrompt);
    } catch (error) {
      this.logger.error('Failed to construct prompt from template', error as Error, {
        templateId: template.id,
        sessionId: context.sessionId
      });
      return failure(error as Error);
    }
  }

  async validateContext(
    template: IPromptTemplate,
    context: IPromptContext
  ): Promise<IResult<ITemplateValidationResult>> {
    try {
      const errors: ITemplateValidationError[] = [];
      const warnings: ITemplateValidationError[] = [];

      if (!template.variables) {
        return success({
          valid: true,
          errors,
          warnings
        });
      }

      // Check required variables
      for (const variable of template.variables) {
        const value = context.variables[variable.name];
        
        if (variable.required && (value === undefined || value === null)) {
          errors.push({
            type: 'missing_variable',
            message: `Required variable '${variable.name}' is missing`
          });
          continue;
        }

        // Type validation
        if (value !== undefined && value !== null) {
          const typeError = this.validateVariableType(variable.name, value, variable.type);
          if (typeError) {
            errors.push(typeError);
          }
        }
      }

      // Check for undefined variables in context
      for (const [name, value] of Object.entries(context.variables)) {
        const defined = template.variables.some(v => v.name === name);
        if (!defined && value !== undefined) {
          warnings.push({
            type: 'semantic',
            message: `Variable '${name}' is not defined in template but provided in context`
          });
        }
      }

      return success({
        valid: errors.length === 0,
        errors,
        warnings
      });
    } catch (error) {
      this.logger.error('Failed to validate context', error as Error, {
        templateId: template.id
      });
      return failure(error as Error);
    }
  }

  estimateTokens(content: string): number {
    // Simple token estimation: roughly 4 characters per token
    // This is a basic approximation - real implementation would use a proper tokenizer
    const charCount = content.length;
    const estimatedTokens = Math.ceil(charCount / 4);
    
    // Add some overhead for formatting and structure
    return Math.ceil(estimatedTokens * 1.1);
  }

  private interpolateVariables(content: string, variables: Record<string, unknown>): string {
    let interpolated = content;

    // Handle simple {{variable}} interpolation
    interpolated = interpolated.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const name = variableName.trim();
      const value = variables[name];
      
      if (value === undefined || value === null) {
        this.logger.warn(`Variable '${name}' is undefined during interpolation`);
        return match; // Keep original if undefined
      }

      return this.formatValue(value);
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    interpolated = this.processConditionals(interpolated, variables);

    // Handle loops {{#each array}}...{{/each}}
    interpolated = this.processLoops(interpolated, variables);

    // Handle equality conditionals {{#if_equals variable "value"}}...{{/if_equals}}
    interpolated = this.processEqualityConditionals(interpolated, variables);

    // Handle switch statements {{#switch variable}}{{#case "value"}}...{{/case}}{{/switch}}
    interpolated = this.processSwitchStatements(interpolated, variables);

    return interpolated;
  }

  private processConditionals(content: string, variables: Record<string, unknown>): string {
    const regex = /\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/gs;
    
    return content.replace(regex, (match, condition, innerContent) => {
      const variableName = condition.trim();
      const value = variables[variableName];
      
      // Truthiness check
      if (this.isTruthy(value)) {
        return this.interpolateVariables(innerContent, variables);
      }
      
      return '';
    });
  }

  private processLoops(content: string, variables: Record<string, unknown>): string {
    const regex = /\{\{#each\s+([^}]+)\}\}(.*?)\{\{\/each\}\}/gs;
    
    return content.replace(regex, (match, arrayName, template) => {
      const name = arrayName.trim();
      const array = variables[name];
      
      if (!Array.isArray(array)) {
        this.logger.warn(`Variable '${name}' is not an array for #each loop`);
        return '';
      }
      
      return array.map((item, index) => {
        const itemContext = {
          ...variables,
          this: item,
          '@index': index,
          '@first': index === 0,
          '@last': index === array.length - 1
        };
        
        return this.interpolateVariables(template, itemContext);
      }).join('');
    });
  }

  private processEqualityConditionals(content: string, variables: Record<string, unknown>): string {
    const regex = /\{\{#if_equals\s+([^}]+?)\s+"([^"]+)"\}\}(.*?)\{\{\/if_equals\}\}/gs;
    
    return content.replace(regex, (match, variableName, expectedValue, innerContent) => {
      const name = variableName.trim();
      const value = variables[name];
      
      if (String(value) === expectedValue) {
        return this.interpolateVariables(innerContent, variables);
      }
      
      return '';
    });
  }

  private processSwitchStatements(content: string, variables: Record<string, unknown>): string {
    const switchRegex = /\{\{#switch\s+([^}]+)\}\}(.*?)\{\{\/switch\}\}/gs;
    
    return content.replace(switchRegex, (match, variableName, switchContent) => {
      const name = variableName.trim();
      const value = String(variables[name] || '');
      
      // Find matching case
      const caseRegex = /\{\{#case\s+"([^"]+)"\}\}(.*?)\{\{\/case\}\}/gs;
      let caseMatch;
      
      while ((caseMatch = caseRegex.exec(switchContent)) !== null) {
        const caseValue = caseMatch[1];
        const caseContent = caseMatch[2];
        
        if (value === caseValue) {
          return this.interpolateVariables(caseContent || '', variables);
        }
      }
      
      // No match found
      return '';
    });
  }

  private formatValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.formatValue(item)).join(', ');
    }
    
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    
    return String(value);
  }

  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'number') {
      return value !== 0;
    }
    
    if (typeof value === 'string') {
      return value.length > 0;
    }
    
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    
    return true;
  }

  private validateVariableType(
    name: string,
    value: unknown,
    expectedType: string
  ): ITemplateValidationError | null {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    // Special handling for object type
    if (expectedType === 'object' && actualType === 'object' && value !== null && !Array.isArray(value)) {
      return null;
    }
    
    if (actualType !== expectedType) {
      return {
        type: 'semantic',
        message: `Variable '${name}' expected type '${expectedType}' but got '${actualType}'`
      };
    }
    
    return null;
  }

  private generateId(): string {
    return `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}