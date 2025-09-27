const { config } = require('dotenv');
const { expand } = require('dotenv-expand');

// Load .env.local for tests
const myEnv = config({ path: '.env.local' });
expand(myEnv);