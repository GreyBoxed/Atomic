import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const CONVENTIONAL_COMMITS_SPEC = `# Conventional Commits v1.0.0

The Conventional Commits specification is a lightweight convention on top of commit messages. It provides a set of rules for creating an explicit commit history, which makes it easier to write automated tools on top of. This convention dovetails with SemVer, by describing the features, fixes, and breaking changes made in commit messages.

## Structure

\`\`\`
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
\`\`\`

## Types

| Type         | Description                                    | SemVer |
|--------------|------------------------------------------------|--------|
| **feat**     | Introduces a new feature to the codebase       | MINOR  |
| **fix**      | Patches a bug in the codebase                  | PATCH  |
| **docs**     | Documentation-only changes                     | —      |
| **style**    | Formatting, white-space (no code change)       | —      |
| **refactor** | Code change that neither fixes nor adds        | —      |
| **perf**     | Performance improvement                        | PATCH  |
| **test**     | Adding or correcting tests                     | —      |
| **build**    | Build system or dependency changes             | —      |
| **ci**       | CI configuration changes                       | —      |
| **chore**    | Other changes (not src or test)                | —      |
| **revert**   | Reverts a previous commit                      | —      |

Types other than feat and fix are permitted per team conventions.

## Specification

1. Commits MUST be prefixed with a type, which consists of a noun (feat, fix, etc.), an optional scope, an optional \`!\`, and a required terminal colon and space.
2. The type \`feat\` MUST be used when a commit adds a new feature to the application or library.
3. The type \`fix\` MUST be used when a commit represents a bug fix for the application.
4. A scope MAY be provided after a type. A scope MUST consist of a noun describing a section of the codebase surrounded by parentheses, e.g., \`fix(parser):\`.
5. A description MUST immediately follow the colon and space after the type/scope prefix. The description is a short summary of the code changes, e.g., \`fix: array parsing issue when multiple spaces were contained in string\`.
6. A longer commit body MAY be provided after the short description, providing additional contextual information about the code changes. The body MUST begin one blank line after the description.
7. A commit body is free-form and MAY consist of any number of newline-separated paragraphs.
8. One or more footers MAY be provided one blank line after the body. Each footer MUST consist of a word token, followed by either a \`:<space>\` or \`<space>#\` separator, followed by a string value (inspired by the git trailer convention).
9. A footer's token MUST use \`-\` in place of whitespace characters, e.g., \`Acked-by\` (this helps differentiate the footer section from a multi-paragraph body). An exception is made for \`BREAKING CHANGE\`, which MAY also be used as a token.
10. A footer's value MAY contain spaces and newlines, and parsing MUST terminate when the next valid footer token/separator pair is observed.
11. Breaking changes MUST be indicated in the type/scope prefix of a commit, or as an entry in the footer.
12. If included as a footer, a breaking change MUST consist of the uppercase text \`BREAKING CHANGE\`, followed by a colon, space, and description, e.g., \`BREAKING CHANGE: environment variables now take precedence over config files\`.
13. If included in the type/scope prefix, breaking changes MUST be indicated by a \`!\` immediately before the \`:\`. If \`!\` is used, \`BREAKING CHANGE:\` MAY be omitted from the footer section, and the commit description SHALL be used to describe the breaking change.
14. Types other than \`feat\` and \`fix\` MAY be used in your commit messages, e.g., \`docs: update ref docs\`.
15. The units of information that make up Conventional Commits MUST NOT be treated as case sensitive by implementors, with the exception of \`BREAKING CHANGE\` which MUST be uppercase.
16. \`BREAKING-CHANGE\` MUST be synonymous with \`BREAKING CHANGE\`, when used as a token in a footer.

## SemVer Relationship

- \`fix\` type commits should be translated to PATCH releases.
- \`feat\` type commits should be translated to MINOR releases.
- Commits with \`BREAKING CHANGE\`, regardless of type, should be translated to MAJOR releases.

## Examples

### Commit with description and breaking change footer
\`\`\`
feat: allow provided config object to extend other configs

BREAKING CHANGE: \\\`extends\\\` key in config file is now used for extending other config files
\`\`\`

### Commit with \`!\` to draw attention to breaking change
\`\`\`
feat!: send an email to the customer when a product is shipped
\`\`\`

### Commit with scope and \`!\` to draw attention to breaking change
\`\`\`
feat(api)!: send an email to the customer when a product is shipped
\`\`\`

### Commit with both \`!\` and BREAKING CHANGE footer
\`\`\`
feat!: drop support for Node 6

BREAKING CHANGE: use JavaScript features not available in Node 6.
\`\`\`

### Commit with no body
\`\`\`
docs: correct spelling of CHANGELOG
\`\`\`

### Commit with scope
\`\`\`
feat(lang): add Polish language
\`\`\`

### Commit with multi-paragraph body and multiple footers
\`\`\`
fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

Remove timeouts which were used to mitigate the racing issue but are
obsolete now.

Reviewed-by: Z
Refs: #123
\`\`\`

### Revert example
\`\`\`
revert: let us never again speak of the noodle incident

Refs: 676104e, a215868
\`\`\`

## FAQ

- **Initial development:** Proceed as if you have already released the product. Somebody, even if it is your fellow developers, will want to know what has changed.
- **Type casing:** Any casing may be used, but it is best to be consistent.
- **Multiple types in one commit:** Go back and make multiple commits whenever possible. Part of the benefit of Conventional Commits is the ability to make more organized commits and PRs.
- **Revert handling:** The spec does not mandate revert behavior. Instead it leaves this to tooling authors to use the flexibility of types and footers. One recommendation is to use the \`revert\` type with a footer referencing the commit SHAs being reverted.
- **Rapid development:** Conventional Commits discourages moving fast in a disorganized way. It helps you move fast long-term across multiple projects with varied contributors.
- **Contributor flexibility:** Not all contributors need to follow the spec if lead maintainers squash and rewrite messages before merging.
`;

export function registerCommitConventions(server: McpServer): void {
  server.resource(
    "commit-conventions",
    "atomic-commit://conventions",
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: CONVENTIONAL_COMMITS_SPEC,
        },
      ],
    })
  );
}
