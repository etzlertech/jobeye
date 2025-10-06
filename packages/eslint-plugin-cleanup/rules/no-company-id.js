/**
 * @file ESLint rule preventing company_id usage in favor of tenant_id
 */

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow company_id usage and require tenant_id",
      recommended: false,
    },
    messages: {
      replace: "Use tenant_id instead of company_id.",
    },
    schema: [],
  },
  create(context) {
    const report = (node) => {
      context.report({
        node,
        messageId: "replace",
      });
    };

    return {
      Identifier(node) {
        if (node.name === "company_id") {
          report(node);
        }
      },
      MemberExpression(node) {
        if (
          !node.computed &&
          node.property.type === "Identifier" &&
          node.property.name === "company_id"
        ) {
          report(node.property);
        }
      },
      Literal(node) {
        if (typeof node.value === "string" && node.value === "company_id") {
          report(node);
        }
      },
      TemplateElement(node) {
        if (node.value.raw === "company_id") {
          report(node);
        }
      },
    };
  },
};
