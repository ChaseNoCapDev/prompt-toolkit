# @chasenocap/prompt-toolkit

> XML template system and prompt construction utilities for metaGOTHIC framework

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/ChaseNoCap/prompt-toolkit)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/ChaseNoCap/prompt-toolkit)
[![Version](https://img.shields.io/npm/v/@chasenocap/prompt-toolkit.svg)](https://npm.pkg.github.com/package/@chasenocap/prompt-toolkit)

## Overview

The prompt-toolkit package provides a comprehensive XML-based template system for creating structured, context-aware prompts for AI development workflows. It's designed for the metaGOTHIC framework but can be used independently for any prompt engineering needs.

## Features

- 🏗️ **XML Template Schema**: Structured templates with variables, conditionals, and inheritance
- 🔄 **Template Inheritance**: Build complex templates by extending base templates
- 🧮 **Variable Interpolation**: Support for simple variables, conditionals, loops, and switch statements
- 📂 **Progressive Context Loading**: Load context information progressively based on needs
- ✅ **Validation**: Comprehensive template and context validation
- 💾 **Registry System**: Register, search, and manage templates
- 🧪 **Testing Support**: Full test coverage with examples and fixtures

## Installation

```bash
npm install @chasenocap/prompt-toolkit
```

## Quick Start

```typescript
import { createPromptToolkit } from '@chasenocap/prompt-toolkit';

// Initialize the toolkit
const result = await createPromptToolkit();
if (result.success) {
  const toolkit = result.data;

  // Parse an XML template
  const xmlTemplate = `
    <prompt_template id="hello" name="Hello Template">
      <variables>
        <variable name="name" type="string" required="true">
          <description>Person's name</description>
        </variable>
      </variables>
      <content>Hello {{name}}! Welcome to the metaGOTHIC framework.</content>
    </prompt_template>
  `;

  // Parse and register the template
  const parseResult = await toolkit.parser.parse(xmlTemplate);
  if (parseResult.success) {
    await toolkit.registry.register(parseResult.data.template);

    // Construct a prompt
    const context = { variables: { name: 'Alice' } };
    const constructResult = await toolkit.constructor.construct('hello', context);
    
    if (constructResult.success) {
      console.log(constructResult.data.content); // "Hello Alice! Welcome to the metaGOTHIC framework."
    }
  }
}
```

## XML Template Schema

### Basic Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<prompt_template id="template-id" name="Template Name" version="1.0.0">
  <description>Template description</description>
  
  <variables>
    <variable name="var_name" type="string" required="true">
      <description>Variable description</description>
    </variable>
  </variables>

  <content>
    <![CDATA[
    Your template content with {{var_name}} interpolation.
    ]]>
  </content>
</prompt_template>
```

### Variable Types

- `string` - Text values
- `number` - Numeric values  
- `boolean` - True/false values
- `array` - Lists of items
- `object` - Complex objects

### Template Inheritance

```xml
<prompt_template id="child-template" extends="parent-template">
  <!-- Child template inherits variables and can override content -->
</prompt_template>
```

### Context Loading

```xml
<context_loading strategy="progressive">
  <level depth="1">
    <load>basic-info.md</load>
    <purpose>Basic project context</purpose>
  </level>
  <level depth="2" condition_type="equals" condition_variable="complexity" condition_value="high">
    <load>advanced-config.md</load>
    <purpose>Complex project setup</purpose>
  </level>
</context_loading>
```

## Variable Interpolation

### Simple Variables
```
Hello {{name}}, you are {{age}} years old.
```

### Conditionals
```
{{#if isActive}}
User is currently active.
{{/if}}
```

### Loops
```
Skills:
{{#each skills}}
- {{this}}
{{/each}}
```

### Equality Checks
```
{{#if_equals role "admin"}}
You have administrator privileges.
{{/if_equals}}
```

### Switch Statements
```
{{#switch userType}}
{{#case "premium"}}Premium features enabled{{/case}}
{{#case "basic"}}Basic features only{{/case}}
{{/switch}}
```

## API Reference

### IPromptToolkit

Main interface providing access to all toolkit functionality:

```typescript
interface IPromptToolkit {
  readonly parser: ITemplateParser;
  readonly registry: ITemplateRegistry;
  readonly constructor: IPromptConstructor;
  readonly contextLoader: IContextLoader;
  
  initialize(): Promise<IResult<void>>;
  shutdown(): Promise<IResult<void>>;
}
```

### ITemplateParser

Parse XML templates into structured objects:

```typescript
interface ITemplateParser {
  parse(content: string, format?: PromptTemplateFormat): Promise<IResult<ITemplateParseResult>>;
  parseFile(filePath: string): Promise<IResult<ITemplateParseResult>>;
  validate(template: IPromptTemplate): Promise<IResult<ITemplateValidationResult>>;
  getSupportedFormats(): PromptTemplateFormat[];
}
```

### ITemplateRegistry

Manage and store templates:

```typescript
interface ITemplateRegistry {
  register(template: IPromptTemplate): Promise<IResult<void>>;
  get(id: string): Promise<IResult<IPromptTemplate>>;
  getResolved(id: string): Promise<IResult<IPromptTemplate>>; // With inheritance resolved
  list(): Promise<IResult<IPromptTemplate[]>>;
  search(query: string): Promise<IResult<IPromptTemplate[]>>;
  remove(id: string): Promise<IResult<void>>;
  exists(id: string): Promise<boolean>;
}
```

### IPromptConstructor

Build prompts from templates and context:

```typescript
interface IPromptConstructor {
  construct(templateId: string, context: IPromptContext, options?: IPromptConstructionOptions): Promise<IResult<IConstructedPrompt>>;
  constructFromTemplate(template: IPromptTemplate, context: IPromptContext, options?: IPromptConstructionOptions): Promise<IResult<IConstructedPrompt>>;
  validateContext(template: IPromptTemplate, context: IPromptContext): Promise<IResult<ITemplateValidationResult>>;
  estimateTokens(content: string): number;
}
```

### IContextLoader

Load context information progressively:

```typescript
interface IContextLoader {
  loadContext(strategy: string, options?: Record<string, unknown>): Promise<IResult<IPromptContext>>;
  loadProgressive(levels: number): Promise<IResult<Partial<IPromptContext>>>;
  validateRequirements(requirements: string[]): Promise<IResult<boolean>>;
}
```

## Context Loading Strategies

### Minimal Context
```typescript
const context = await toolkit.contextLoader.loadContext('minimal');
// Loads: platform, nodeVersion, timestamp
```

### Progressive Context  
```typescript
const context = await toolkit.contextLoader.loadContext('progressive', {
  includeFileSystem: true,
  includeGit: true
});
// Loads context progressively based on project needs
```

### All Available Context
```typescript
const context = await toolkit.contextLoader.loadContext('all');
// Loads all available context information
```

## Advanced Usage

### Custom Container Setup

```typescript
import { createPromptContainer, PROMPT_TYPES } from '@chasenocap/prompt-toolkit';
import { createLogger } from '@chasenocap/logger';

const logger = createLogger('my-app');
const container = createPromptContainer({ logger });

const parser = container.get<ITemplateParser>(PROMPT_TYPES.ITemplateParser);
const registry = container.get<ITemplateRegistry>(PROMPT_TYPES.ITemplateRegistry);
```

### Template Validation

```typescript
const template = {
  id: 'my-template',
  name: 'My Template',
  content: 'Hello {{name}}',
  variables: [
    { name: 'name', type: 'string', required: true }
  ]
};

const validation = await toolkit.parser.validate(template);
if (!validation.data.valid) {
  console.log('Validation errors:', validation.data.errors);
}
```

### Context Validation

```typescript
const context = { variables: { name: 'Alice' } };
const validation = await toolkit.constructor.validateContext(template, context);

if (!validation.data.valid) {
  console.log('Context errors:', validation.data.errors);
}
```

## Testing

The package includes comprehensive test coverage:

```bash
npm test              # Run all tests
npm run coverage      # Generate coverage report
npm run test:watch    # Watch mode for development
```

### Test Structure

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Fixtures**: Example templates and test data

## Development

### Project Structure

```
src/
├── interfaces/          # TypeScript interfaces
├── implementations/     # Core implementations
├── types/              # Type definitions and tokens
├── utils/              # Utility functions and container setup
└── templates/          # Built-in template examples

tests/
├── unit/               # Unit tests
├── fixtures/           # Test templates and data
└── integration/        # Integration tests
```

### Building

```bash
npm run build         # Build TypeScript
npm run build:watch   # Watch mode
npm run clean         # Clean build artifacts
```

### Linting

```bash
npm run lint          # Check code style
npm run lint:fix      # Fix linting issues
npm run typecheck     # Type checking without build
```

## Dependencies

- **@chasenocap/di-framework**: Dependency injection utilities
- **@chasenocap/logger**: Structured logging
- **inversify**: Inversion of control container
- **reflect-metadata**: Decorator metadata support

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Run linting: `npm run lint`
7. Commit your changes: `git commit -m 'Add amazing feature'`
8. Push to the branch: `git push origin feature/amazing-feature`
9. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Packages

- [@chasenocap/claude-client](https://github.com/ChaseNoCap/claude-client) - Claude CLI subprocess wrapper
- [@chasenocap/di-framework](https://github.com/ChaseNoCap/di-framework) - Dependency injection utilities
- [@chasenocap/logger](https://github.com/ChaseNoCap/logger) - Structured logging
- [@chasenocap/event-system](https://github.com/ChaseNoCap/event-system) - Event-driven architecture

## Changelog

### v1.0.0

- Initial release
- XML template parsing with full schema support
- Variable interpolation with conditionals, loops, and switches
- Template inheritance system
- Progressive context loading
- Comprehensive test suite with 100% coverage
- Complete TypeScript support with strict typing