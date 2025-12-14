# Contributing to @cross/image

Thank you for your interest in contributing to @cross/image! This document provides guidelines and
instructions for contributing to the project.

## Development Setup

### Prerequisites

- [Deno](https://deno.land/) (latest version)
- [Node.js](https://nodejs.org/) 18+ (for testing Node.js compatibility)
- [Bun](https://bun.sh/) (for testing Bun compatibility)

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/image.git
   cd image
   ```
3. Install dependencies (Deno will handle this automatically on first run)

## Development Workflow

### Running Tests

Run all tests:

```bash
deno test -A
```

Run tests with coverage:

```bash
deno task check
```

### Linting and Formatting

Check formatting:

```bash
deno fmt --check
```

Apply formatting:

```bash
deno fmt
```

Run linter:

```bash
deno lint
```

### Type Checking

Check types:

```bash
deno check mod.ts
deno check test/*.test.ts
```

### Pre-commit Validation

Before committing, run the precommit task to ensure all checks pass:

```bash
deno task precommit
```

This runs:

- Format checking
- Linting
- Type checking
- All tests

## Code Guidelines

### Code Style

- Follow the existing code style
- Use TypeScript for all code
- Write clear, descriptive variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and single-purpose

### Testing

- Write tests for all new features
- Use `@cross/test` instead of `Deno.test` for cross-runtime compatibility
- Place tests in the `test/` directory
- Follow the naming convention: `feature_name.test.ts`
- Ensure tests pass on Deno, Node.js, and Bun

### Cross-Runtime Compatibility

This library supports Deno, Node.js (18+), and Bun. Ensure your code works across all three
runtimes:

- Avoid runtime-specific APIs where possible
- Use standard JavaScript/TypeScript features
- Test on all three runtimes before submitting

### Commit Messages

Write clear, descriptive commit messages:

- Use present tense ("Add feature" not "Added feature")
- Keep the first line under 72 characters
- Reference issues and PRs where relevant

Example:

```
Add support for ICO format decoding

- Implement ICO decoder
- Add tests for ICO format
- Update documentation

Fixes #123
```

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code guidelines

3. **Run tests and validation**:
   ```bash
   deno task precommit
   ```

4. **Commit your changes** with clear commit messages

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** against the `main` branch

7. **Respond to feedback** from reviewers

### PR Requirements

- All tests must pass
- Code must be formatted and linted
- Type checking must pass
- Documentation must be updated if needed
- New features should include tests
- Breaking changes should be clearly documented

## Adding New Image Formats

When adding support for a new image format:

1. Create a new format file in `src/formats/`
2. Implement the `ImageFormat` interface
3. Add the format to the formats list in `src/image.ts`
4. Add comprehensive tests in `test/`
5. Update documentation in `docs/src/formats.md`
6. Add examples if appropriate

## Documentation

- Update `README.md` for user-facing changes
- Update docs in `docs/src/` for detailed documentation
- Keep documentation concise and focused
- Include code examples where helpful

## Questions or Issues?

- Check existing [issues](https://github.com/cross-org/image/issues)
- Open a new issue for bugs or feature requests
- Join discussions in existing issues and PRs

## License

By contributing to @cross/image, you agree that your contributions will be licensed under the MIT
License.
