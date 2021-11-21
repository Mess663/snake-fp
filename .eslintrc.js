module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: [
        'airbnb-base',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 13,
        sourceType: 'module',
    },
    plugins: [
        '@typescript-eslint',
    ],
    rules: {
        indent: 'off',
        '@typescript-eslint/indent': ['error'],
        'max-len': ['error', 200],
        'no-underscore-dangle': 'off',
        'no-param-reassign': 'off',
        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': ['error'],
    },
};
