/**
 * @file ESLint rule encouraging class-based repository pattern
 */

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer class-based repositories extending BaseRepository",
      recommended: false,
    },
    messages: {
      useClass: "Use class-based repositories extending BaseRepository instead of exported functions.",
    },
    schema: [],
  },
  create(context) {
    const memberMethods = new Set(["from", "insert", "update", "delete", "select"]);
    const visitorKeys = context.getSourceCode().visitorKeys;

    const traverse = (node, state) => {
      if (!node || state.found) return;

      if (node.type === "CallExpression") {
        const callee = node.callee;
        if (callee.type === "Identifier" && callee.name === "createClient") {
          state.found = true;
          return;
        }
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          memberMethods.has(callee.property.name)
        ) {
          state.found = true;
          return;
        }
      }

      const keys = visitorKeys[node.type] || [];
      for (const key of keys) {
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value) {
            traverse(child, state);
          }
        } else if (value) {
          traverse(value, state);
        }
      }
    };

    const containsFunctionalPattern = (fnNode) => {
      const state = { found: false };
      traverse(fnNode.body, state);
      return state.found;
    };

    const report = (node) => {
      context.report({
        node,
        messageId: "useClass",
      });
    };

    const checkFunction = (fnNode, reportNode) => {
      if (containsFunctionalPattern(fnNode)) {
        report(reportNode || fnNode);
      }
    };

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;

        if (decl.type === "FunctionDeclaration") {
          checkFunction(decl, decl.id || decl);
          return;
        }

        if (decl.type === "VariableDeclaration") {
          for (const declarator of decl.declarations) {
            const init = declarator.init;
            if (!init) continue;
            if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
              checkFunction(init, declarator.id);
            }
          }
        }
      },
    };
  },
};
