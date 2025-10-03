// ESLint config for cleanup pattern checking
module.exports = {
  extends: ['./.eslintrc.js'],
  plugins: ['cleanup'],
  rules: {
    // Enable cleanup rules
    'cleanup/no-company-id': 'error',
    'cleanup/repository-class-pattern': 'error',
    
    // Disable other rules to focus on cleanup patterns
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off'
  }
};