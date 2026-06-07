const localPlugin = {
  rules: {
    "no-single-statement-if-block": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Disallow single-statement if/else and loop block bodies, and auto-fix when safe"
        },
        fixable: "code",
        schema: [],
        messages: {
          noIfBlock:
            "Avoid single-statement if blocks; prefer a direct one-line if statement or refactor the condition.",
          noElseBlock:
            "Avoid single-statement else blocks; prefer a direct one-line statement or refactor the condition.",
          noLoopBlock:
            "Avoid single-statement loop blocks; prefer a direct one-line statement or refactor the loop body."
        }
      },
      create(context) {
        const sourceCode = context.sourceCode;

        function isLexicalDeclaration(statement) {
          return (
            statement.type === "VariableDeclaration" && statement.kind !== "var"
          );
        }

        function hasCommentsInside(block, statement) {
          const textBeforeStmt = sourceCode.text.slice(
            block.range[0] + 1,
            statement.range[0]
          );
          const textAfterStmt = sourceCode.text.slice(
            statement.range[1],
            block.range[1] - 1
          );

          return /\/\/|\/\*/.test(textBeforeStmt + textAfterStmt);
        }

        function canAutoFix(block, statement) {
          if (statement.type === "FunctionDeclaration") return false;
          if (statement.type === "ClassDeclaration") return false;
          if (isLexicalDeclaration(statement)) return false;
          if (hasCommentsInside(block, statement)) return false;
          return true;
        }

        function reportSingleStatementBlock(block, messageId) {
          const statement = block.body[0];

          context.report({
            node: block,
            messageId,
            fix(fixer) {
              if (!canAutoFix(block, statement)) return null;
              return fixer.replaceText(block, sourceCode.getText(statement));
            }
          });
        }

        return {
          IfStatement(node) {
            if (
              node.consequent.type === "BlockStatement" &&
              node.consequent.body.length === 1
            ) {
              reportSingleStatementBlock(node.consequent, "noIfBlock");
            }

            if (
              node.alternate &&
              node.alternate.type === "BlockStatement" &&
              node.alternate.body.length === 1
            ) {
              reportSingleStatementBlock(node.alternate, "noElseBlock");
            }
          },
          ForStatement(node) {
            if (
              node.body.type === "BlockStatement" &&
              node.body.body.length === 1
            ) {
              reportSingleStatementBlock(node.body, "noLoopBlock");
            }
          },
          ForInStatement(node) {
            if (
              node.body.type === "BlockStatement" &&
              node.body.body.length === 1
            ) {
              reportSingleStatementBlock(node.body, "noLoopBlock");
            }
          },
          ForOfStatement(node) {
            if (
              node.body.type === "BlockStatement" &&
              node.body.body.length === 1
            ) {
              reportSingleStatementBlock(node.body, "noLoopBlock");
            }
          },
          WhileStatement(node) {
            if (
              node.body.type === "BlockStatement" &&
              node.body.body.length === 1
            ) {
              reportSingleStatementBlock(node.body, "noLoopBlock");
            }
          },
          DoWhileStatement(node) {
            if (
              node.body.type === "BlockStatement" &&
              node.body.body.length === 1
            ) {
              reportSingleStatementBlock(node.body, "noLoopBlock");
            }
          }
        };
      }
    }
  }
};

export default localPlugin;
