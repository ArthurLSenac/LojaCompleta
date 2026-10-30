// Somente bancos com sufixo _test podem ser recriados automaticamente nos testes.
const name=process.env.TEST_DB_NAME||'ambar_marketplace_test';
if(!/^[a-zA-Z0-9_]+_test$/.test(name))throw new Error('TEST_DB_NAME deve terminar em _test.');
process.env.DB_NAME=name;process.argv.push('--recriar');require('./criar-banco');
