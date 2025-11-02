import { injectable } from 'inversify';
import type { IResult } from '@chasenocap/di-framework';
import type { 
  ITemplateParser,
  IPromptTemplate,
  ITemplateValidationResult,
  ITemplateParseResult,
  PromptTemplateFormat,
  IVariable,
  IContextLoading,
  ITaskDefinition,
  IThinkingLevel,
  ITemplateValidationError
} from '../interfaces/IPromptTemplate.js';
import { success, failure } from '@chasenocap/di-framework';

/**
 * XML-based template parser for prompt templates
 */
@injectable()
export class XmlTemplateParser implements ITemplateParser {
  private readonly supportedFormats: PromptTemplateFormat[] = ['xml'];

  async parse(content: string, format?: PromptTemplateFormat): Promise<IResult<ITemplateParseResult>> {
    try {
      const detectedFormat = format || this.detectFormat(content);
      
      if (detectedFormat !== 'xml') {
        return failure(new Error(`Unsupported format: ${detectedFormat}`));
      }

      const template = await this.parseXmlContent(content);
      
      return success({
        template,
        format: detectedFormat,
        raw: content
      });
    } catch (error) {
      return failure(error as Error);
    }
  }

  async parseFile(filePath: string): Promise<IResult<ITemplateParseResult>> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parse(content);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async validate(template: IPromptTemplate): Promise<IResult<ITemplateValidationResult>> {
    const errors: ITemplateValidationError[] = [];
    const warnings: ITemplateValidationError[] = [];

    // Validate required fields
    if (!template.id) {
      errors.push({
        type: 'semantic',
        message: 'Template ID is required'
      });
    }

    if (!template.name) {
      errors.push({
        type: 'semantic', 
        message: 'Template name is required'
      });
    }

    if (!template.content) {
      errors.push({
        type: 'semantic',
        message: 'Template content is required'
      });
    }

    // Validate variables
    if (template.variables) {
      for (const variable of template.variables) {
        if (!variable.name) {
          errors.push({
            type: 'semantic',
            message: 'Variable name is required'
          });
        }
        
        if (!variable.type) {
          errors.push({
            type: 'semantic',
            message: `Variable ${variable.name} must have a type`
          });
        }
      }
    }

    // Check for circular dependencies in template inheritance
    if (template.extends) {
      // This would need to be implemented with access to the registry
      warnings.push({
        type: 'semantic',
        message: 'Template inheritance circular dependency check requires registry access'
      });
    }

    // Validate variable references in content
    const variableRefs = this.extractVariableReferences(template.content);
    const definedVariables = template.variables?.map(v => v.name) || [];
    
    for (const ref of variableRefs) {
      if (!definedVariables.includes(ref)) {
        warnings.push({
          type: 'missing_variable',
          message: `Referenced variable '${ref}' is not defined in template variables`
        });
      }
    }

    return success({
      valid: errors.length === 0,
      errors,
      warnings
    });
  }

  getSupportedFormats(): PromptTemplateFormat[] {
    return [...this.supportedFormats];
  }

  private detectFormat(content: string): PromptTemplateFormat {
    const trimmed = content.trim();
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<prompt_template')) {
      return 'xml';
    }
    return 'xml'; // Default to XML for now
  }

  private async parseXmlContent(content: string): Promise<IPromptTemplate> {
    // Simple XML parsing - in a real implementation, you'd use a proper XML parser
    // For now, we'll use basic regex parsing for the main elements
    
    const template: Partial<IPromptTemplate> = {};

    // Parse root element attributes
    const rootMatch = content.match(/<prompt_template([^>]*)>/);
    if (rootMatch) {
      const attributes = this.parseAttributes(rootMatch[1] || '');
      template.id = attributes.id;
      template.name = attributes.name;
      template.version = attributes.version;
      template.author = attributes.author;
    }

    // Parse description
    const descMatch = content.match(/<description>\s*(.*?)\s*<\/description>/s);
    if (descMatch) {
      template.description = descMatch[1]?.trim();
    }

    // Parse extends
    const extendsMatch = content.match(/<extends>(.*?)<\/extends>/);
    if (extendsMatch) {
      template.extends = extendsMatch[1]?.trim();
    }

    // Parse variables
    template.variables = this.parseVariables(content);

    // Parse context loading
    template.contextLoading = this.parseContextLoading(content);

    // Parse task definition
    template.taskDefinition = this.parseTaskDefinition(content);

    // Parse thinking level
    template.thinkingLevel = this.parseThinkingLevel(content);

    // Parse content (CDATA section)
    const contentMatch = content.match(/<content>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/content>/s);
    if (contentMatch) {
      template.content = contentMatch[1] || '';
    } else {
      // Try regular content
      const simpleContentMatch = content.match(/<content>(.*?)<\/content>/s);
      template.content = simpleContentMatch?.[1] || '';
    }

    // Parse metadata
    template.metadata = this.parseMetadata(content);

    // Validate required fields
    if (!template.id || !template.name || !template.content) {
      throw new Error('Missing required template fields: id, name, or content');
    }

    return template as IPromptTemplate;
  }

  private parseAttributes(attributeString: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const regex = /(\w+)="([^"]+)"/g;
    let match;
    
    while ((match = regex.exec(attributeString)) !== null) {
      attributes[match[1]!] = match[2]!;
    }
    
    return attributes;
  }

  private parseVariables(content: string): IVariable[] {
    const variables: IVariable[] = [];
    const variablesMatch = content.match(/<variables>(.*?)<\/variables>/s);
    
    if (!variablesMatch) return variables;

    const variableMatches = variablesMatch[1]?.matchAll(/<variable([^>]*?)>(.*?)<\/variable>/gs);
    
    if (variableMatches) {
      for (const match of variableMatches) {
        const attributes = this.parseAttributes(match[1] || '');
        const innerContent = match[2] || '';
        
        const descriptionMatch = innerContent.match(/<description>(.*?)<\/description>/s);
        
        variables.push({
          name: attributes.name,
          type: attributes.type as IVariable['type'],
          required: attributes.required === 'true',
          default: attributes.default,
          description: descriptionMatch?.[1]?.trim()
        });
      }
    }
    
    return variables;
  }

  private parseContextLoading(content: string): IContextLoading | undefined {
    const contextMatch = content.match(/<context_loading([^>]*?)>(.*?)<\/context_loading>/s);
    
    if (!contextMatch) return undefined;

    const attributes = this.parseAttributes(contextMatch[1] || '');
    const strategy = attributes.strategy as IContextLoading['strategy'];
    
    // Parse levels
    const levelsContent = contextMatch[2] || '';
    const levelMatches = levelsContent.matchAll(/<level([^>]*?)>(.*?)<\/level>/gs);
    
    const levels = [];
    for (const levelMatch of levelMatches) {
      const levelAttrs = this.parseAttributes(levelMatch[1] || '');
      const levelContent = levelMatch[2] || '';
      
      const loadMatches = levelContent.matchAll(/<load>(.*?)<\/load>/g);
      const load = Array.from(loadMatches, m => m[1]?.trim() || '');
      
      const purposeMatch = levelContent.match(/<purpose>(.*?)<\/purpose>/);
      
      levels.push({
        depth: parseInt(levelAttrs.depth) || 1,
        load,
        purpose: purposeMatch?.[1]?.trim()
      });
    }

    return {
      strategy,
      levels
    };
  }

  private parseTaskDefinition(content: string): ITaskDefinition | undefined {
    const taskMatch = content.match(/<task_definition>(.*?)<\/task_definition>/s);
    
    if (!taskMatch) return undefined;

    const taskContent = taskMatch[1] || '';
    
    const objectiveMatch = taskContent.match(/<objective>(.*?)<\/objective>/s);
    const objective = objectiveMatch?.[1]?.trim() || '';

    // Parse requirements
    const requirements = [];
    // First find the requirements section
    const requirementsMatch = taskContent.match(/<requirements>(.*?)<\/requirements>/s);
    if (requirementsMatch) {
      const requirementsContent = requirementsMatch[1] || '';
      const reqMatches = requirementsContent.matchAll(/<requirement([^>]*?)>(.*?)<\/requirement>/gs);
      
      for (const reqMatch of reqMatches) {
        const reqAttrs = this.parseAttributes(reqMatch[1] || '');
        requirements.push({
          id: reqAttrs.id,
          description: reqMatch[2]?.trim() || '',
          priority: reqAttrs.priority as 'high' | 'medium' | 'low',
          dependencies: reqAttrs.depends_on ? [reqAttrs.depends_on] : undefined
        });
      }
    }

    // Parse constraints
    const constraints = [];
    const constraintMatches = taskContent.matchAll(/<constraint[^>]*?>(.*?)<\/constraint>/gs);
    for (const constraintMatch of constraintMatches) {
      const constraintText = constraintMatch[1]?.trim() || '';
      // Remove any leading HTML tags that might have been captured
      const cleanText = constraintText.replace(/^<[^>]*>/, '').trim();
      constraints.push(cleanText);
    }

    return {
      objective,
      requirements,
      constraints: constraints.length > 0 ? constraints : undefined
    };
  }

  private parseThinkingLevel(content: string): IThinkingLevel | undefined {
    const thinkingMatch = content.match(/<thinking_level([^>]*?)>/);
    
    if (!thinkingMatch) return undefined;

    const attributes = this.parseAttributes(thinkingMatch[1] || '');
    
    return {
      depth: attributes.depth as IThinkingLevel['depth'],
      focus: attributes.focus,
      duration: attributes.duration
    };
  }

  private parseMetadata(content: string): Record<string, unknown> | undefined {
    const metadataMatch = content.match(/<metadata>(.*?)<\/metadata>/s);
    
    if (!metadataMatch) return undefined;

    const metadata: Record<string, unknown> = {};
    const metadataContent = metadataMatch[1] || '';

    // Simple parsing for common metadata fields
    const categoryMatch = metadataContent.match(/<category>(.*?)<\/category>/);
    if (categoryMatch) {
      metadata.category = categoryMatch[1]?.trim();
    }

    const tokensMatch = metadataContent.match(/<estimated_tokens>(.*?)<\/estimated_tokens>/);
    if (tokensMatch) {
      metadata.estimated_tokens = parseInt(tokensMatch[1]?.trim() || '0');
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private extractVariableReferences(content: string): string[] {
    const references = new Set<string>();
    
    // Match {{variable}} patterns
    const matches = content.matchAll(/\{\{([^}]+)\}\}/g);
    for (const match of matches) {
      const variable = match[1]?.trim();
      if (variable) {
        references.add(variable);
      }
    }
    
    return Array.from(references);
  }
}