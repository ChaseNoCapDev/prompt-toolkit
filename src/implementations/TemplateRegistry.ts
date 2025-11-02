import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IResult } from '@chasenocap/di-framework';
import { success, failure } from '@chasenocap/di-framework';
import type { 
  ITemplateRegistry,
  IPromptTemplate
} from '../interfaces/IPromptTemplate.js';
import { PROMPT_TYPES } from '../types/InjectionTokens.js';

/**
 * In-memory template registry with inheritance support
 */
@injectable()
export class TemplateRegistry implements ITemplateRegistry {
  private readonly templates = new Map<string, IPromptTemplate>();
  private readonly inheritanceCache = new Map<string, IPromptTemplate>();

  constructor(
    @inject(PROMPT_TYPES.ILogger) private readonly logger: ILogger
  ) {}

  async register(template: IPromptTemplate): Promise<IResult<void>> {
    try {
      // Validate template
      if (!template.id) {
        return failure(new Error('Template ID is required'));
      }

      if (!template.name) {
        return failure(new Error('Template name is required'));
      }

      if (!template.content) {
        return failure(new Error('Template content is required'));
      }

      // Check for circular inheritance
      if (template.extends) {
        const circularCheck = await this.checkCircularInheritance(template.id, template.extends);
        if (!circularCheck.success) {
          return circularCheck;
        }
      }

      // Store template
      this.templates.set(template.id, { ...template });
      
      // Clear inheritance cache for this template and any that inherit from it
      this.clearInheritanceCache(template.id);

      this.logger.info(`Registered template: ${template.id}`, { 
        templateId: template.id,
        name: template.name,
        hasInheritance: !!template.extends
      });

      return success(undefined);
    } catch (error) {
      this.logger.error('Failed to register template', error as Error, { 
        templateId: template.id 
      });
      return failure(error as Error);
    }
  }

  async get(id: string): Promise<IResult<IPromptTemplate>> {
    try {
      const template = this.templates.get(id);
      
      if (!template) {
        return failure(new Error(`Template not found: ${id}`));
      }

      return success({ ...template });
    } catch (error) {
      this.logger.error('Failed to get template', error as Error, { templateId: id });
      return failure(error as Error);
    }
  }

  async list(): Promise<IResult<IPromptTemplate[]>> {
    try {
      const templates = Array.from(this.templates.values()).map(t => ({ ...t }));
      
      this.logger.debug(`Listed ${templates.length} templates`);
      
      return success(templates);
    } catch (error) {
      this.logger.error('Failed to list templates', error as Error);
      return failure(error as Error);
    }
  }

  async search(query: string): Promise<IResult<IPromptTemplate[]>> {
    try {
      const lowerQuery = query.toLowerCase();
      const matches: IPromptTemplate[] = [];

      for (const template of this.templates.values()) {
        // Search in name, description, and metadata
        const searchableText = [
          template.name,
          template.description || '',
          template.id,
          JSON.stringify(template.metadata || {})
        ].join(' ').toLowerCase();

        if (searchableText.includes(lowerQuery)) {
          matches.push({ ...template });
        }
      }

      this.logger.debug(`Search for '${query}' returned ${matches.length} results`);

      return success(matches);
    } catch (error) {
      this.logger.error('Failed to search templates', error as Error, { query });
      return failure(error as Error);
    }
  }

  async remove(id: string): Promise<IResult<void>> {
    try {
      if (!this.templates.has(id)) {
        return failure(new Error(`Template not found: ${id}`));
      }

      // Check if any other templates inherit from this one
      const dependents = this.findDependentTemplates(id);
      if (dependents.length > 0) {
        return failure(new Error(
          `Cannot remove template ${id}: other templates inherit from it: ${dependents.join(', ')}`
        ));
      }

      this.templates.delete(id);
      this.clearInheritanceCache(id);

      this.logger.info(`Removed template: ${id}`);

      return success(undefined);
    } catch (error) {
      this.logger.error('Failed to remove template', error as Error, { templateId: id });
      return failure(error as Error);
    }
  }

  async exists(id: string): Promise<boolean> {
    return this.templates.has(id);
  }

  async getResolved(id: string): Promise<IResult<IPromptTemplate>> {
    try {
      // Check cache first
      const cached = this.inheritanceCache.get(id);
      if (cached) {
        return success({ ...cached });
      }

      // Get base template
      const baseResult = await this.get(id);
      if (!baseResult.success) {
        return baseResult;
      }

      let template = baseResult.data;

      // Resolve inheritance chain
      if (template.extends) {
        const parentResult = await this.getResolved(template.extends);
        if (!parentResult.success) {
          return failure(new Error(
            `Failed to resolve parent template '${template.extends}' for template '${id}': ${parentResult.error.message}`
          ));
        }

        const parent = parentResult.data;
        template = this.mergeTemplates(parent, template);
      }

      // Cache resolved template
      this.inheritanceCache.set(id, template);

      this.logger.debug(`Resolved template with inheritance: ${id}`, {
        templateId: id,
        hasInheritance: !!baseResult.data.extends
      });

      return success({ ...template });
    } catch (error) {
      this.logger.error('Failed to resolve template', error as Error, { templateId: id });
      return failure(error as Error);
    }
  }

  private async checkCircularInheritance(templateId: string, parentId: string): Promise<IResult<void>> {
    const visited = new Set<string>();
    let currentId = parentId;

    while (currentId) {
      if (visited.has(currentId)) {
        return failure(new Error(
          `Circular inheritance detected: ${Array.from(visited).join(' -> ')} -> ${currentId}`
        ));
      }

      if (currentId === templateId) {
        return failure(new Error(
          `Template cannot inherit from itself: ${templateId}`
        ));
      }

      visited.add(currentId);
      
      const template = this.templates.get(currentId);
      if (!template) {
        return failure(new Error(`Parent template not found: ${currentId}`));
      }

      currentId = template.extends || '';
    }

    return success(undefined);
  }

  private findDependentTemplates(parentId: string): string[] {
    const dependents: string[] = [];

    for (const [id, template] of this.templates) {
      if (template.extends === parentId) {
        dependents.push(id);
      }
    }

    return dependents;
  }

  private mergeTemplates(parent: IPromptTemplate, child: IPromptTemplate): IPromptTemplate {
    // Merge templates with child taking precedence
    const merged: IPromptTemplate = {
      ...parent,
      ...child,
      // Merge arrays and objects
      variables: [
        ...(parent.variables || []),
        ...(child.variables || [])
      ],
      metadata: {
        ...(parent.metadata || {}),
        ...(child.metadata || {})
      }
    };

    // Child content replaces parent content completely
    if (child.content) {
      merged.content = child.content;
    }

    // Context loading strategy: child overrides parent
    if (child.contextLoading) {
      merged.contextLoading = child.contextLoading;
    }

    // Task definition: child overrides parent
    if (child.taskDefinition) {
      merged.taskDefinition = child.taskDefinition;
    }

    // Thinking level: child overrides parent
    if (child.thinkingLevel) {
      merged.thinkingLevel = child.thinkingLevel;
    }

    // Clear extends since we've resolved the inheritance
    delete merged.extends;

    return merged;
  }

  private clearInheritanceCache(templateId: string): void {
    // Clear cache for this template
    this.inheritanceCache.delete(templateId);

    // Clear cache for any templates that might inherit from this one
    const dependents = this.findDependentTemplates(templateId);
    for (const dependent of dependents) {
      this.clearInheritanceCache(dependent);
    }
  }
}