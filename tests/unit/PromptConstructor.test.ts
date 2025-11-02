/**
 * Tests for PromptConstructor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptConstructor } from '../../src/implementations/PromptConstructor.js';
import type { ITemplateRegistry, IPromptTemplate, IPromptContext } from '../../src/interfaces/IPromptTemplate.js';
import type { ILogger } from '@chasenocap/logger';
import { success } from '@chasenocap/di-framework';

// Mock logger
const mockLogger: ILogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger)
};

// Mock registry
const mockRegistry: ITemplateRegistry = {
  register: vi.fn(),
  get: vi.fn(),
  getResolved: vi.fn(),
  list: vi.fn(),
  search: vi.fn(),
  remove: vi.fn(),
  exists: vi.fn()
};

describe('PromptConstructor', () => {
  let constructor: PromptConstructor;

  beforeEach(() => {
    vi.clearAllMocks();
    constructor = new PromptConstructor(mockRegistry, mockLogger);
  });

  describe('constructFromTemplate', () => {
    it('should construct a simple prompt with variable interpolation', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: 'Hello {{name}}, you are {{age}} years old!'
      };

      const context: IPromptContext = {
        variables: {
          name: 'John',
          age: 30
        }
      };

      const result = await constructor.constructFromTemplate(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Hello John, you are 30 years old!');
        expect(result.data.templateId).toBe('test');
        expect(result.data.context).toEqual(context);
      }
    });

    it('should handle conditional blocks', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: '{{#if showGreeting}}Hello {{name}}!{{/if}}'
      };

      const context: IPromptContext = {
        variables: {
          name: 'John',
          showGreeting: true
        }
      };

      const result = await constructor.constructFromTemplate(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Hello John!');
      }
    });

    it('should handle false conditionals', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: '{{#if showGreeting}}Hello {{name}}!{{/if}}'
      };

      const context: IPromptContext = {
        variables: {
          name: 'John',
          showGreeting: false
        }
      };

      const result = await constructor.constructFromTemplate(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('');
      }
    });

    it('should handle array loops', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: 'Skills: {{#each skills}}- {{this}}\n{{/each}}'
      };

      const context: IPromptContext = {
        variables: {
          skills: ['JavaScript', 'TypeScript', 'Python']
        }
      };

      const result = await constructor.constructFromTemplate(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Skills: - JavaScript\n- TypeScript\n- Python\n');
      }
    });

    it('should handle equality conditionals', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: '{{#if_equals status "active"}}User is active{{/if_equals}}'
      };

      const context: IPromptContext = {
        variables: {
          status: 'active'
        }
      };

      const result = await constructor.constructFromTemplate(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('User is active');
      }
    });

    it('should handle switch statements', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: `{{#switch role}}{{#case "admin"}}Administrator{{/case}}{{#case "user"}}Regular User{{/case}}{{/switch}}`
      };

      const context: IPromptContext = {
        variables: {
          role: 'admin'
        }
      };

      const result = await constructor.constructFromTemplate(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Administrator');
      }
    });

    it('should estimate tokens when requested', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: 'Hello {{name}}'
      };

      const context: IPromptContext = {
        variables: {
          name: 'John'
        }
      };

      const result = await constructor.constructFromTemplate(template, context, {
        estimateTokens: true
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.estimatedTokens).toBeDefined();
        expect(typeof result.data.metadata.estimatedTokens).toBe('number');
        expect(result.data.metadata.estimatedTokens! > 0).toBe(true);
      }
    });
  });

  describe('construct', () => {
    it('should construct prompt using registry', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: 'Hello {{name}}'
      };

      const context: IPromptContext = {
        variables: {
          name: 'John'
        }
      };

      (mockRegistry.getResolved as any).mockResolvedValue(success(template));

      const result = await constructor.construct('test', context);

      expect(result.success).toBe(true);
      expect(mockRegistry.getResolved).toHaveBeenCalledWith('test');
      if (result.success) {
        expect(result.data.content).toBe('Hello John');
      }
    });
  });

  describe('validateContext', () => {
    it('should validate required variables', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: 'Hello {{name}}',
        variables: [
          {
            name: 'name',
            type: 'string',
            required: true
          },
          {
            name: 'age',
            type: 'number',
            required: false
          }
        ]
      };

      const context: IPromptContext = {
        variables: {
          name: 'John'
        }
      };

      const result = await constructor.validateContext(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
        expect(result.data.errors).toHaveLength(0);
      }
    });

    it('should detect missing required variables', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: 'Hello {{name}}',
        variables: [
          {
            name: 'name',
            type: 'string',
            required: true
          }
        ]
      };

      const context: IPromptContext = {
        variables: {}
      };

      const result = await constructor.validateContext(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(false);
        expect(result.data.errors.length).toBeGreaterThan(0);
        expect(result.data.errors[0]!.message).toContain('name');
      }
    });

    it('should validate variable types', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: 'Age: {{age}}',
        variables: [
          {
            name: 'age',
            type: 'number',
            required: true
          }
        ]
      };

      const context: IPromptContext = {
        variables: {
          age: 'not a number'
        }
      };

      const result = await constructor.validateContext(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(false);
        expect(result.data.errors.some(e => e.message.includes('type'))).toBe(true);
      }
    });

    it('should warn about undefined variables', async () => {
      const template: IPromptTemplate = {
        id: 'test',
        name: 'Test Template',
        content: 'Hello',
        variables: []
      };

      const context: IPromptContext = {
        variables: {
          extraVariable: 'value'
        }
      };

      const result = await constructor.validateContext(template, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(result.data.warnings[0]!.message).toContain('extraVariable');
      }
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for content', () => {
      const content = 'This is a sample text with multiple words.';
      const tokens = constructor.estimateTokens(content);
      
      expect(typeof tokens).toBe('number');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(content.length); // Should be less than character count
    });

    it('should return higher estimates for longer content', () => {
      const shortContent = 'Short text';
      const longContent = 'This is a much longer text with many more words and sentences that should result in a higher token estimate.';
      
      const shortTokens = constructor.estimateTokens(shortContent);
      const longTokens = constructor.estimateTokens(longContent);
      
      expect(longTokens).toBeGreaterThan(shortTokens);
    });
  });
});