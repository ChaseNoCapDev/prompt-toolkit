/**
 * Integration tests for PromptToolkit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPromptToolkit } from '../../src/utils/PromptContainer.js';
import type { IPromptToolkit, IPromptTemplate, IPromptContext } from '../../src/interfaces/IPromptTemplate.js';

describe('PromptToolkit Integration', () => {
  let toolkit: IPromptToolkit;

  beforeEach(async () => {
    const result = await createPromptToolkit();
    expect(result.success).toBe(true);
    if (result.success) {
      toolkit = result.data;
    }
  });

  describe('End-to-End Template Processing', () => {
    it('should parse, register, and construct a complete template', async () => {
      const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<prompt_template id="e2e-test" name="End-to-End Test" version="1.0.0">
  <description>Complete end-to-end test template</description>
  
  <variables>
    <variable name="project_name" type="string" required="true">
      <description>Name of the project</description>
    </variable>
    <variable name="complexity" type="string" required="false" default="medium">
      <description>Project complexity level</description>
    </variable>
    <variable name="features" type="array" required="false">
      <description>List of features</description>
    </variable>
  </variables>

  <content>
    <![CDATA[
# {{project_name}} Analysis

This project has {{complexity}} complexity.

{{#if features}}
## Features
{{#each features}}
- {{this}}
{{/each}}
{{/if}}

{{#if_equals complexity "high"}}
⚠️ High complexity project requires extra attention.
{{/if_equals}}

{{#switch complexity}}
{{#case "low"}}
✅ Simple project, straightforward implementation.
{{/case}}
{{#case "medium"}}
⚖️ Balanced project, standard practices apply.
{{/case}}
{{#case "high"}}
🔥 Complex project, requires careful planning.
{{/case}}
{{/switch}}
    ]]>
  </content>

  <metadata>
    <category>integration-test</category>
    <estimated_tokens>300</estimated_tokens>
  </metadata>
</prompt_template>`;

      // Step 1: Parse the template
      const parseResult = await toolkit.parser.parse(xmlTemplate);
      expect(parseResult.success).toBe(true);
      
      if (!parseResult.success) return;
      const template = parseResult.data.template;

      // Step 2: Register the template
      const registerResult = await toolkit.registry.register(template);
      expect(registerResult.success).toBe(true);

      // Step 3: Verify it exists
      const exists = await toolkit.registry.exists('e2e-test');
      expect(exists).toBe(true);

      // Step 4: Construct a prompt
      const context: IPromptContext = {
        variables: {
          project_name: 'My Awesome App',
          complexity: 'high',
          features: ['Authentication', 'Real-time Chat', 'File Upload']
        }
      };

      const constructResult = await toolkit.constructor.construct('e2e-test', context, {
        validateVariables: true,
        estimateTokens: true
      });

      expect(constructResult.success).toBe(true);
      
      if (constructResult.success) {
        const prompt = constructResult.data;
        
        // Verify content interpolation
        expect(prompt.content).toContain('My Awesome App');
        expect(prompt.content).toContain('high complexity');
        expect(prompt.content).toContain('Authentication');
        expect(prompt.content).toContain('Real-time Chat');
        expect(prompt.content).toContain('File Upload');
        expect(prompt.content).toContain('⚠️ High complexity project');
        expect(prompt.content).toContain('🔥 Complex project');

        // Verify metadata
        expect(prompt.templateId).toBe('e2e-test');
        expect(prompt.metadata.estimatedTokens).toBeGreaterThan(0);
        expect(prompt.metadata.constructedAt).toBeInstanceOf(Date);
      }
    });

    it('should handle template inheritance', async () => {
      // Parent template
      const parentTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<prompt_template id="base-analysis" name="Base Analysis Template" version="1.0.0">
  <description>Base template for analysis</description>
  
  <variables>
    <variable name="title" type="string" required="true">
      <description>Analysis title</description>
    </variable>
  </variables>

  <content>
    <![CDATA[
# {{title}}

## Base Analysis
This is the base analysis structure.
    ]]>
  </content>
</prompt_template>`;

      // Child template that extends parent
      const childTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<prompt_template id="detailed-analysis" name="Detailed Analysis Template" version="1.0.0">
  <description>Detailed analysis extending base</description>
  <extends>base-analysis</extends>
  
  <variables>
    <variable name="details" type="string" required="true">
      <description>Additional details</description>
    </variable>
  </variables>

  <content>
    <![CDATA[
# {{title}}

## Detailed Analysis
{{details}}

Additional detailed analysis content.
    ]]>
  </content>
</prompt_template>`;

      // Parse and register parent
      const parentResult = await toolkit.parser.parse(parentTemplate);
      expect(parentResult.success).toBe(true);
      if (parentResult.success) {
        await toolkit.registry.register(parentResult.data.template);
      }

      // Parse and register child
      const childResult = await toolkit.parser.parse(childTemplate);
      expect(childResult.success).toBe(true);
      if (childResult.success) {
        await toolkit.registry.register(childResult.data.template);
      }

      // Get resolved child template (should include parent variables)
      const resolvedResult = await toolkit.registry.getResolved('detailed-analysis');
      expect(resolvedResult.success).toBe(true);
      
      if (resolvedResult.success) {
        const resolved = resolvedResult.data;
        
        // Should have variables from both templates
        expect(resolved.variables).toBeDefined();
        expect(resolved.variables!.length).toBe(2);
        expect(resolved.variables!.some(v => v.name === 'title')).toBe(true);
        expect(resolved.variables!.some(v => v.name === 'details')).toBe(true);
        
        // Should use child content (not parent)
        expect(resolved.content).toContain('Detailed Analysis');
        expect(resolved.content).not.toContain('Base Analysis');
      }
    });

    it('should validate context and provide meaningful errors', async () => {
      const template: IPromptTemplate = {
        id: 'validation-test',
        name: 'Validation Test',
        content: 'Hello {{name}}, age: {{age}}',
        variables: [
          {
            name: 'name',
            type: 'string',
            required: true
          },
          {
            name: 'age',
            type: 'number',
            required: true
          }
        ]
      };

      await toolkit.registry.register(template);

      // Missing required variable
      const invalidContext: IPromptContext = {
        variables: {
          name: 'John'
          // missing age
        }
      };

      const result = await toolkit.constructor.construct('validation-test', invalidContext, {
        validateVariables: true
      });

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('age');
    });

    it('should handle context loading strategies', async () => {
      // Test minimal context loading
      const minimalResult = await toolkit.contextLoader.loadContext('minimal');
      expect(minimalResult.success).toBe(true);
      
      if (minimalResult.success) {
        const context = minimalResult.data;
        expect(context.variables.platform).toBeDefined();
        expect(context.variables.nodeVersion).toBeDefined();
        expect(context.variables.timestamp).toBeDefined();
      }

      // Test progressive context loading
      const progressiveResult = await toolkit.contextLoader.loadProgressive(2);
      expect(progressiveResult.success).toBe(true);
      
      if (progressiveResult.success) {
        const context = progressiveResult.data;
        expect(context.variables).toBeDefined();
        expect(Object.keys(context.variables!).length).toBeGreaterThan(0);
      }
    });

    it('should search templates effectively', async () => {
      // Register a few test templates
      const templates = [
        {
          id: 'search-test-1',
          name: 'Authentication Template',
          content: 'Auth content',
          metadata: { category: 'security' }
        },
        {
          id: 'search-test-2', 
          name: 'Database Template',
          content: 'DB content',
          metadata: { category: 'data' }
        }
      ];

      for (const template of templates) {
        await toolkit.registry.register(template);
      }

      // Search by name
      const authResult = await toolkit.registry.search('authentication');
      expect(authResult.success).toBe(true);
      if (authResult.success) {
        expect(authResult.data.length).toBe(1);
        expect(authResult.data[0]!.id).toBe('search-test-1');
      }

      // Search by category
      const securityResult = await toolkit.registry.search('security');
      expect(securityResult.success).toBe(true);
      if (securityResult.success) {
        expect(securityResult.data.length).toBe(1);
        expect(securityResult.data[0]!.id).toBe('search-test-1');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent template gracefully', async () => {
      const context: IPromptContext = { variables: {} };
      
      const result = await toolkit.constructor.construct('non-existent', context);
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('not found');
    });

    it('should handle circular inheritance', async () => {
      const template1 = {
        id: 'circular-1',
        name: 'Circular 1',
        content: 'Content 1',
        extends: 'circular-2'
      };

      const template2 = {
        id: 'circular-2',
        name: 'Circular 2', 
        content: 'Content 2',
        extends: 'circular-1'
      };

      await toolkit.registry.register(template1);
      
      const result = await toolkit.registry.register(template2);
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('circular');
    });
  });
});