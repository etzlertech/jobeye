const noCompanyIdRule = require("./rules/no-company-id");
const repositoryClassPatternRule = require("./rules/repository-class-pattern");

module.exports = {
  rules: {
    "no-company-id": noCompanyIdRule,
    "repository-class-pattern": repositoryClassPatternRule,
  },
  configs: {
    recommended: {
      plugins: {
        cleanup: {
          rules: {
            "no-company-id": noCompanyIdRule,
            "repository-class-pattern": repositoryClassPatternRule,
          },
        },
      },
      rules: {
        "cleanup/no-company-id": "error",
        "cleanup/repository-class-pattern": "error",
      },
    },
  },
};
