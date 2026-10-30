// Inicialização explícita e protegida: não sobrescreve um banco existente sem --recriar.
const fs=require('node:fs');const path=require('node:path');const mysql=require('mysql2/promise');const config=require('../config/ambiente');
async function main(){
 const name=config.db.database;if(!/^[a-zA-Z0-9_]+$/.test(name))throw new Error('DB_NAME deve conter somente letras, números e sublinhado.');
 const c=await mysql.createConnection({...config.db,database:undefined,multipleStatements:true,charset:'utf8mb4'});
 try{const [rows]=await c.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[name]);
 if(rows.length&&!process.argv.includes('--recriar'))throw new Error('O banco já existe. Use db:migrar para atualizar; use db:criar -- --recriar somente se quiser apagar e recriar os dados.');
 const files=['01_estrutura.sql',...(process.argv.includes('--sem-dados')?[]:['02_dados_demo.sql']),'03_ofertas.sql'];
 for(const file of files){let sql=fs.readFileSync(path.join(__dirname,'../../sql',file),'utf8').replace(/\bambar_marketplace\b/g,name);await c.query(sql);console.log(file+' aplicado.');}
 console.log('Banco '+name+' pronto. Abra o servidor e use as contas de demonstração se importou os dados.');
 }finally{await c.end()}
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
