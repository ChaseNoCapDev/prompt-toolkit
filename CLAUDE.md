# CLAUDE.md - Prompt Toolkit Package

This file provides guidance to Claude Code when working with the prompt-toolkit package.

## Package Overview

The prompt-toolkit package provides a comprehensive XML-based template system for creating structured, context-aware prompts for AI development workflows. It's the foundational package for prompt engineering in the metaGOTHIC framework.

### Purpose
Centralized XML template system with variable interpolation, inheritance, and progressive context loading for AI-driven development workflows.

### Size & Scope
- **Target Size**: ~1500 lines (within metaGOTHIC package guidelines)
- **Public Exports**: 15+ items (interfaces, implementations, utilities, types)
- **Dependencies**: di-framework, logger, inversify, reflect-metadata
- **Single Responsibility**: XML prompt template management and construction only

## Architecture

### Core Components

1. **ITemplateParser Interface** (`src/interfaces/IPromptTemplate.ts`)
   - XML template parsing and validation
   - Support for multiple template formats (primarily XML)
   - Template structure validation

2. **XmlTemplateParser Implementation** (`src/implementations/XmlTemplateParser.ts`)
   - Regex-based XML parsing (simple but effective)
   - Variable extraction and validation
   - Context loading and task definition parsing

3. **ITemplateRegistry Interface** (`src/interfaces/IPromptTemplate.ts`)
   - Template storage and retrieval
   - Template inheritance resolution
   - Search and discovery capabilities

4. **TemplateRegistry Implementation** (`src/implementations/TemplateRegistry.ts`)
   - In-memory template storage with inheritance caching
   - Circular dependency detection
   - Template lifecycle management

5. **IPromptConstructor Interface** (`src/interfaces/IPromptTemplate.ts`)
   - Template variable interpolation
   - Context validation
   - Token estimation

6. **PromptConstructor Implementation** (`src/implementations/PromptConstructor.ts`)
   - Advanced variable interpolation with conditionals, loops, switches
   - Handlebars-style template processing
   - Context validation with detailed error reporting

7. **IContextLoader Interface** (`src/interfaces/IPromptTemplate.ts`)
   - Progressive context loading strategies
   - Environment and project context discovery
   - Context requirement validation

8. **ContextLoader Implementation** (`src/implementations/ContextLoader.ts`)
   - Multiple loading strategies (minimal, progressive, all)
   - File system and Git context detection
   - Environment variable filtering

## Design Decisions

### XML Template Schema
The package uses a custom XML schema designed for SDLC prompts:

```xml
<prompt_template id="unique-id" name="Human Name" version="1.0.0">
  <description>Template purpose</description>
  <extends>parent-template-id</extends>
  
  <variables>
    <variable name="var_name" type="string" required="true">
      <description>Variable purpose</description>
    </variable>
  </variables>

  <context_loading strategy="progressive">
    <level depth="1">
      <load>file1.md</load>
      <purpose>Context purpose</purpose>
    </level>
  </context_loading>

  <task_definition>
    <objective>What this template accomplishes</objective>
    <requirements>
      <requirement priority="high" id="req1">Requirement text</requirement>
    </requirements>
    <constraints>
      <constraint>Constraint text</constraint>
    </constraints>
  </task_definition>

  <thinking_level depth="analysis" focus="systematic" duration="deep" />

  <content><![CDATA[
    Template content with {{variable}} interpolation.
    
    {{#if condition}}Conditional content{{/if}}
    {{#each array}}List item: {{this}}{{/each}}
    {{#if_equals var "value"}}Equality check{{/if_equals}}
    {{#switch var}}{{#case "option"}}Switch content{{/case}}{{/switch}}
  ]]></content>

  <metadata>
    <category>template-category</category>
    <estimated_tokens>2500</estimated_tokens>
  </metadata>
</prompt_template>
```

### Variable Interpolation Engine
The package supports advanced template processing:

- **Simple Variables**: `{{variable_name}}`
- **Conditionals**: `{{#if variable}}...{{/if}}`
- **Loops**: `{{#each array}}{{this}}{{/each}}`
- **Equality**: `{{#if_equals var "value"}}...{{/if_equals}}`
- **Switch**: `{{#switch var}}{{#case "val"}}...{{/case}}{{/switch}}`

### Template Inheritance
Templates can extend other templates using the `extends` attribute:

```typescript
// Child template inherits variables and metadata from parent
// Child content completely replaces parent content
// Context loading, task definition, and thinking level override parent
```

### Progressive Context Loading
The context loader supports multiple strategies:

- **Minimal**: Basic system info only (platform, Node version, timestamp)
- **Progressive**: Load context in levels based on project needs
- **All**: Load all available context information

## Usage Patterns

### Basic Template Processing
```typescript
import { createPromptToolkit } from '@chasenocap/prompt-toolkit';

const toolkit = await createPromptToolkit();
if (toolkit.success) {
  const { parser, registry, constructor: promptConstructor } = toolkit.data;

  // Parse XML template
  const parseResult = await parser.parse(xmlContent);
  
  // Register template
  await registry.register(parseResult.data.template);
  
  // Construct prompt
  const context = { variables: { project_name: 'MyApp' } };
  const result = await promptConstructor.construct('template-id', context);
}
```

### Template Inheritance Workflow
```typescript
// Register parent template first
await registry.register(parentTemplate);

// Register child template (with extends attribute)
await registry.register(childTemplate);

// Get resolved template (inheritance merged)
const resolved = await registry.getResolved('child-template-id');
```

### Context-Aware Construction
```typescript
// Load context based on project needs
const contextResult = await contextLoader.loadContext('progressive', {
  includeFileSystem: true,
  includeGit: true
});

// Validate context against template requirements
const validation = await promptConstructor.validateContext(template, context);

// Construct with validation
const options = { validateVariables: true, estimateTokens: true };
const result = await promptConstructor.construct(templateId, context, options);
```

### Dependency Injection Integration
```typescript
import { PROMPT_TYPES, createPromptContainer } from '@chasenocap/prompt-toolkit';

// In service class
@injectable()
class AIPromptService {
  constructor(
    @inject(PROMPT_TYPES.IPromptToolkit) private toolkit: IPromptToolkit,
    @inject(PROMPT_TYPES.ILogger) private logger: ILogger
  ) {}

  async generatePrompt(templateId: string, variables: Record<string, unknown>) {
    const context = { variables, timestamp: new Date() };
    const result = await this.toolkit.constructor.construct(templateId, context, {
      validateVariables: true,
      estimateTokens: true
    });
    
    if (!result.success) {
      this.logger.error('Prompt construction failed', result.error);
      throw result.error;
    }
    
    return result.data;
  }
}
```

## Testing Strategy

### Comprehensive Test Coverage
The package achieves 100% test coverage with:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **XML Parsing Tests**: Template structure validation
- **Variable Interpolation Tests**: All interpolation patterns
- **Inheritance Tests**: Template extension scenarios
- **Context Loading Tests**: All loading strategies
- **Error Handling Tests**: Validation and error scenarios

### Test Fixtures
Example templates for testing:
- Simple templates with basic variables
- Complex templates with all interpolation features
- Inheritance chains with parent/child relationships
- Invalid templates for error testing

## Integration Points

### With metaGOTHIC Services
- Used by `claude-service` for AI prompt construction
- Integrated with GraphQL resolvers for template management
- Context loading for project-specific information

### With Other Packages
- **di-framework**: Dependency injection container setup
- **logger**: Structured logging for all operations
- **claude-client**: Prompt delivery to Claude CLI

## Performance Characteristics

### Template Processing
- **Parsing**: < 50ms for typical templates
- **Interpolation**: < 10ms for complex variables
- **Inheritance Resolution**: Cached after first resolution
- **Memory**: Minimal overhead, templates stored efficiently

### Context Loading
- **Minimal Strategy**: < 5ms (basic system info)
- **Progressive Strategy**: < 100ms (file system + Git)
- **All Strategy**: < 200ms (complete context)

### Registry Operations
- **Template Storage**: In-memory with O(1) access
- **Search**: Linear scan with caching
- **Inheritance**: Cached resolution prevents re-computation

## Error Handling

### Template Validation Errors
```typescript
// Missing required fields
{ type: 'semantic', message: 'Template ID is required' }

// Invalid variable references
{ type: 'missing_variable', message: "Referenced variable 'name' is not defined" }

// Circular inheritance
{ type: 'circular_dependency', message: 'Circular inheritance detected: A -> B -> A' }
```

### Context Validation Errors
```typescript
// Missing required variables
{ type: 'missing_variable', message: "Required variable 'project_name' is missing" }

// Type mismatches
{ type: 'semantic', message: "Variable 'age' expected type 'number' but got 'string'" }
```

### Construction Errors
```typescript
// Template not found
new Error('Template not found: invalid-id')

// Context validation failed
new Error('Context validation failed: Required variable missing')
```

## Common Patterns

### Template Library Management
```typescript
// Load templates from directory
const templates = await loadTemplatesFromDirectory('./templates');
for (const template of templates) {
  await registry.register(template);
}

// Search for templates
const searchResults = await registry.search('authentication');
const authTemplates = searchResults.data;
```

### Dynamic Context Building
```typescript
// Build context progressively
const baseContext = await contextLoader.loadContext('minimal');
const projectContext = await contextLoader.loadContext('progressive', {
  workingDirectory: '/project/path'
});

// Merge contexts
const fullContext = {
  variables: {
    ...baseContext.data.variables,
    ...projectContext.data.variables,
    custom_variable: 'custom_value'
  }
};
```

### Template Composition
```typescript
// Create template chain: base -> specialized -> specific
await registry.register(baseTemplate);       // Foundation
await registry.register(specializedTemplate); // Extends base
await registry.register(specificTemplate);    // Extends specialized

// Use most specific template
const result = await promptConstructor.construct('specific-template', context);
```

## Future Enhancements

1. **YAML Template Support**: Add YAML as alternative to XML
2. **Template Compiler**: Pre-compile templates for performance
3. **Advanced Context**: Database and API context loading
4. **Template Marketplace**: Share and discover templates
5. **Visual Designer**: GUI for template creation
6. **Performance Monitoring**: Template usage analytics

## Troubleshooting

### XML Parsing Issues
- Ensure well-formed XML structure
- Check for unescaped characters in content
- Use CDATA sections for complex content
- Validate against XML schema

### Variable Interpolation Problems
- Check variable names match exactly (case-sensitive)
- Ensure required variables are provided
- Validate variable types match expectations
- Use template validation before construction

### Template Inheritance Issues
- Verify parent template exists before child registration
- Check for circular dependencies
- Ensure inheritance chain is logical
- Use `getResolved()` to see final merged template

### Context Loading Failures
- Check file system permissions
- Verify working directory exists
- Ensure Git repository is properly initialized
- Handle missing context gracefully

## Maintenance Guidelines

1. **Keep XML Schema Stable**: Changes affect all templates
2. **Maintain Backward Compatibility**: Support existing templates
3. **Optimize Performance**: Cache expensive operations
4. **Test Thoroughly**: High test coverage is critical
5. **Document Examples**: Provide clear usage patterns
6. **Monitor Usage**: Track template performance and errors

## Security Considerations

1. **Input Validation**: Sanitize all template content
2. **Context Filtering**: Filter sensitive environment variables
3. **File Access**: Restrict template file loading paths
4. **Memory Limits**: Prevent large template memory usage
5. **Error Information**: Don't leak sensitive data in errors

## Integration with Event System

### Template Events
```typescript
// Template lifecycle events
eventBus.emit('template.registered', { templateId, metadata });
eventBus.emit('template.constructed', { templateId, context, duration });
eventBus.emit('template.validation.failed', { templateId, errors });
```

### Context Loading Events
```typescript
// Context loading events
eventBus.emit('context.loading.started', { strategy, options });
eventBus.emit('context.loading.completed', { strategy, variableCount });
eventBus.emit('context.loading.failed', { strategy, error });
```

This package is central to the metaGOTHIC framework's AI prompt engineering capabilities and should be maintained with high code quality and comprehensive testing.