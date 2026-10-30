// Monta a aplicação Express: segurança, leitura de JSON, rotas da API e o front-end.
// A lógica de negócio fica em controllers e services, não aqui.
const path = require('node:path');
const express = require('express');
const pool = require('./database/conexao');
const config = require('./config/ambiente');
const seguranca = require('./middlewares/seguranca');
const cors = require('./middlewares/cors');
const { criarLimitador } = require('./middlewares/limitador');
const { corpoJson, rotaApiNaoEncontrada, paginaNaoEncontrada, tratarErros } = require('./middlewares/erros');

const rotas = {
    auth: require('./routes/authRoutes'),
    produtos: require('./routes/produtosRoutes'),
    categorias: require('./routes/categoriasRoutes'),
    lojas: require('./routes/lojasRoutes'),
    solicitacoes: require('./routes/solicitacoesRoutes'),
    usuarios: require('./routes/usuariosRoutes'),
    enderecos: require('./routes/enderecosRoutes'),
    favoritos: require('./routes/favoritosRoutes'),
    cupons: require('./routes/cuponsRoutes'),
    frete: require('./routes/freteRoutes'),
    pedidos: require('./routes/pedidosRoutes'),
    avaliacoes: require('./routes/avaliacoesRoutes'),
    perguntas: require('./routes/perguntasRoutes'),
    banners: require('./routes/bannersRoutes'),
    configuracoes: require('./routes/configuracoesRoutes'),
    dashboard: require('./routes/dashboardRoutes'),
    auditoria: require('./routes/auditoriaRoutes'),
    newsletter: require('./routes/newsletterRoutes')
};

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);

app.use(seguranca);
app.use('/api', cors);
app.use('/api', criarLimitador({
    janelaMs: 5 * 60 * 1000,
    maximo: config.limites.apiPorJanela,
    mensagem: 'Muitas requisições em pouco tempo. Aguarde um instante.'
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', corpoJson);

app.get('/api/saude', async function saude(req, res) {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', banco: 'conectado' });
    } catch (erro) {
        res.status(503).json({ status: 'degradado', banco: 'indisponível' });
    }
});

// JWT também pode chegar no cookie HttpOnly, usado pelo frontend da mesma origem.
app.use('/api', function sessaoCookie(req,res,next){
 const cookie=(req.headers.cookie||'').match(/(?:^|; )ambar_session=([^;]+)/);
 if(!req.headers.authorization&&cookie)req.headers.authorization='Bearer '+cookie[1];
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')){
  const expected=req.protocol+'://'+req.get('host');
  if(req.get('origin')!==expected&&!config.origensPermitidas.includes(req.get('origin')))return res.status(403).json({mensagem:'Origem não autorizada.'});
 }
 if(req.path==='/auth/senha')req.body={...req.body,senhaAtual:req.body.senha_atual??req.body.senhaAtual,novaSenha:req.body.nova_senha??req.body.novaSenha};
 const json=res.json.bind(res);
 res.json=function(payload){
  if(payload&&payload.token){const decoded=require('jsonwebtoken').decode(payload.token);res.cookie('ambar_session',payload.token,{httpOnly:true,sameSite:'strict',secure:config.ambiente==='production',path:'/',maxAge:Math.max(0,decoded.exp*1000-Date.now())});}
  return json(payload);
 };
 next();
});
app.use('/api',require('./routes/interfaceRoutes'));

// Cada recurso tem seu arquivo de rotas: /api/produtos, /api/pedidos, ...
for (const [recurso, router] of Object.entries(rotas)) app.use('/api/' + recurso, router);
app.use('/api', rotaApiNaoEncontrada);

// O próprio Express entrega o front-end: não é preciso outro servidor.
app.use(express.static(path.join(__dirname, '..', 'frontend'), { dotfiles: 'deny', index: 'index.html', extensions: ['html'] }));
app.use(paginaNaoEncontrada);
app.use(tratarErros);

module.exports = app;
