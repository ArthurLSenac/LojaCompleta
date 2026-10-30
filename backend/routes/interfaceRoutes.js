// Contratos usados pelo frontend: todos os registros vêm das tabelas MySQL.
const express = require('express');
const pool = require('../database/conexao');
const { transacao } = require('../database/conexao');
const { autenticarOpcional } = require('../middlewares/autenticacao');
const { erros, ErroHttp } = require('../utils/erros');
const v = require('../utils/validacao');
const s = require('../services/ofertas');
const router = express.Router();
router.use(autenticarOpcional);
const normalize = x => String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
router.use(async(req,res,next)=>{
 const path=req.path.replace(/^\//,'').replace(/\/$/,''),method=req.method,b=req.body||{},q=req.query,u=req.usuario;
 const auth=(...roles)=>{if(!u)throw erros.naoAutenticado();if(roles.length&&!roles.includes(u.nivel))throw erros.proibido();return u};
 if(path==='auth/me'){auth();return require('../controllers/authController').eu(req,res)}
 if(['auth/logout','auth/logout-todos'].includes(path)&&method==='POST'){auth();await pool.execute('UPDATE usuarios SET token_versao=token_versao+1 WHERE id=?',[u.id]);res.clearCookie('ambar_session',{path:'/',httpOnly:true,sameSite:'strict'});return res.json({mensagem:'Sessões encerradas.'})}
 if(path==='auth/perfil'&&method==='PUT'){auth();const nome=v.texto(b.nome,'o nome',{min:2,max:100});await pool.execute('UPDATE usuarios SET nome=? WHERE id=?',[nome,u.id]);return res.json({usuario:{id:u.id,nome,email:u.email,nivel:u.nivel}})}
 if(path==='status')return res.json({modo:'demonstracao',banco:'mysql',persistencia:'servidor',pagamentos_reais:false});
 if(path==='sons')return res.json({sons:[],sintetizados:true});
 if(path==='produtos'||path==='produtos/gerenciar'){
  if(method==='GET'){
   const manage=path.endsWith('gerenciar');if(manage)auth('admin','vendedor');const [rows]=await pool.query(s.base);let ps=rows.filter(p=>manage?(u.nivel==='admin'||u.id===p.vendedor_id):s.visivel(p)).map(s.format);
   if(q.q)ps=ps.filter(p=>normalize(p.nome+' '+p.descricao+' '+p.categoria.nome+' '+p.loja.nome).includes(normalize(q.q)));
   for(const k of ['categoria','loja'])if(q[k])ps=ps.filter(p=>p[k].slug===q[k]);if(q.ids)ps=ps.filter(p=>String(q.ids).split(',').includes(String(p.id)));
   if(q.com_ofertas==='1')ps=ps.filter(p=>p.total_ofertas>0);if(q.sem_ofertas==='1')ps=ps.filter(p=>!p.total_ofertas);if(q.abertos==='1')ps=ps.filter(p=>p.negociacao_status==='aberto'&&p.estoque>0);
   ps.sort((a,b)=>q.ordem==='mais_ofertas'?b.total_ofertas-a.total_ofertas:q.ordem==='maior_oferta'?b.maior_oferta-a.maior_oferta:q.ordem==='novidades'?b.id-a.id:Number(b.destaque)-Number(a.destaque)||b.id-a.id);
   const {pagina,limite,deslocamento}=v.paginacao(q,{limitePadrao:24,limiteMaximo:100});return res.json({itens:ps.slice(deslocamento,deslocamento+limite),total:ps.length,pagina,paginas:Math.max(1,Math.ceil(ps.length/limite))});
  }
 }
 if(path==='produtos'&&method==='POST'||/^produtos\/\d+$/.test(path)&&['PUT','DELETE'].includes(method)){
  auth('admin','vendedor');const id=path==='produtos'?null:v.id(path.split('/')[1]);if(id)s.proprietario(u,await s.produto(id));
  if(method==='DELETE'){await pool.execute('UPDATE produtos SET ativo=0 WHERE id=?',[id]);await s.registrar(pool,u,'produto_desativado',id);return res.json({mensagem:'Produto retirado da vitrine.'})}
  const nome=v.texto(b.nome,'o nome',{min:3,max:120}),descricao=v.texto(b.descricao,'a descrição',{min:10,max:3000}),estoque=v.inteiro(b.estoque,'o estoque',{min:0,max:100000}),categoria=v.id(b.categoria_id,'a categoria'),imagem=v.texto(b.imagem||'/assets/fotos/produto.svg','a imagem',{max:600});
  if(!/^(https:\/\/[^\s]+|\/assets\/[\w./-]+)$/.test(imagem))throw erros.requisicao('Use uma URL https de imagem.');const [[cat]]=await pool.execute('SELECT id FROM categorias WHERE id=? AND ativa=1',[categoria]);if(!cat)throw erros.requisicao('Categoria inválida.');
  const result=await transacao(async conn=>{let target=id;if(id){await conn.execute('SELECT id FROM produtos WHERE id=? FOR UPDATE',[id]);await conn.execute('UPDATE produtos SET nome=?,descricao=?,estoque=?,categoria_id=?,imagem=?,destaque=?,ativo=? WHERE id=?',[nome,descricao,estoque,categoria,imagem,!!b.destaque,b.ativo===false?0:1,id])}
   else{const seller=u.nivel==='admin'?v.id(b.vendedor_id||3):u.id;const [[store]]=await conn.execute("SELECT l.id FROM lojas l JOIN usuarios us ON us.id=l.usuario_id WHERE l.usuario_id=? AND l.ativa=1 AND us.status='ativo' AND us.nivel='vendedor'",[seller]);if(!store)throw erros.requisicao('Vendedor sem loja ativa.');const [r]=await conn.execute('INSERT INTO produtos(vendedor_id,categoria_id,nome,descricao,estoque,imagem,destaque,ativo) VALUES(?,?,?,?,?,?,?,?)',[seller,categoria,nome,descricao,estoque,imagem,!!b.destaque,b.ativo===false?0:1]);target=r.insertId;await conn.execute('INSERT INTO rodadas_ofertas(produto_id) VALUES(?)',[target])}await s.registrar(conn,u,id?'produto_atualizado':'produto_criado',target);return target});return res.status(id?200:201).json({produto:s.format(await s.produto(result))});
 }
 if(/^produtos\/\d+$/.test(path)&&method==='GET'){const p=await s.produto(path.split('/')[1]);if(!s.visivel(p)&&u?.nivel!=='admin'&&u?.id!==p.vendedor_id)throw erros.naoEncontrado('Produto indisponível.');const product=s.format(p);if(u){const [[mine]]=await pool.execute('SELECT MAX(valor) valor FROM lances WHERE rodada_id=? AND comprador_id=?',[p.rodada_id,u.id]);product.minha_oferta=Number(mine.valor||0)}return res.json({produto:product})}
 if(/^produtos\/\d+\/lances$/.test(path)){
  const p=await s.produto(path.split('/')[1]),manage=u&&(u.nivel==='admin'||u.nivel==='vendedor'&&u.id===p.vendedor_id);if(!s.visivel(p)&&!manage)throw erros.naoEncontrado('Produto indisponível.');
  if(method==='GET'){const [bs]=await pool.execute(s.bidSelect+' WHERE b.rodada_id=? ORDER BY b.valor DESC,b.criado_em DESC',[p.rodada_id]);return res.json({gerenciar:!!manage,leilao:{status:p.negociacao_status,rodada:p.rodada,maior_oferta:Number(p.maior_oferta||0),total_ofertas:Number(p.total_ofertas||0)},lances:bs.map(b=>s.lance(b,u,manage))})}
  if(method==='POST'){auth('comprador');const r=await s.fazerLance(u,p.id,b);return res.status(r.repetido?200:201).json({lance:r.lance})}
 }
 if(path==='lances/meus'||path==='lances/vendedor'){
  if(path.endsWith('meus'))auth('comprador');else auth('admin','vendedor');const args=[],where=[];if(path.endsWith('meus')){where.push('b.comprador_id=?');args.push(u.id)}else if(u.nivel!=='admin'){where.push('p.vendedor_id=?');args.push(u.id)}
  const [bs]=await pool.execute(s.bidSelect+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY b.criado_em DESC',args),itens=[];for(const row of bs)itens.push({...s.lance(row,u,path.endsWith('vendedor')),produto:s.format(await s.produto(row.produto_id))});return res.json({itens});
 }
 if(/^lances\/[^/]+\/aceitar$/.test(path)&&method==='POST'){auth('vendedor','admin');const r=await s.aceitar(u,path.split('/')[1]);return res.status(r.repetido?200:201).json({pedido:await s.pedido(r.id,u)})}
 if(/^produtos\/\d+\/reabrir$/.test(path)&&method==='POST'){auth('vendedor','admin');return res.json(await s.reabrir(u,path.split('/')[1]))}
 if(['pedidos','pedidos/simular','cupons/validar'].includes(path)&&method==='POST')throw new ErroHttp(410,'A compra começa com uma oferta aceita pela loja.');
 if(['pedidos/meus','pedidos/vendedor','pedidos/admin'].includes(path)){
  auth();let where='p.oferta_id IS NOT NULL',args=[];if(path.endsWith('meus')){where+=' AND p.comprador_id=?';args.push(u.id)}else{auth('vendedor','admin');if(path.endsWith('admin'))auth('admin');if(u.nivel!=='admin'){where+=' AND EXISTS(SELECT 1 FROM pedido_itens i WHERE i.pedido_id=p.id AND i.vendedor_id=?)';args.push(u.id)}}
  const [rows]=await pool.execute('SELECT p.id FROM pedidos p WHERE '+where+' ORDER BY p.criado_em DESC',args),pedidos=[];for(const p of rows)pedidos.push(await s.pedido(p.id,u));return res.json({pedidos});
 }
 if(/^pedidos\/\d+(\/\w+)?$/.test(path)){auth();const [,id,action]=path.split('/');return res.json({pedido:method==='GET'?await s.pedido(id,u):await s.mudarPedido(u,id,action,b)})}
 if(/^produtos\/\d+\/(avaliacoes|perguntas)$/.test(path)){
  const [,id,kind]=path.split('/');await s.produto(id);if(method==='GET'){const [itens]=await pool.execute(`SELECT * FROM ${kind} WHERE produto_id=?${kind==='avaliacoes'?' AND visivel=1':''} ORDER BY criado_em DESC`,[id]);return res.json({itens})}
  auth('comprador');if(kind==='perguntas'){const pergunta=v.texto(b.pergunta,'a pergunta',{min:10,max:500});const [r]=await pool.execute('INSERT INTO perguntas(produto_id,usuario_id,pergunta) VALUES(?,?,?)',[id,u.id,pergunta]);return res.status(201).json({item:{id:r.insertId,pergunta}})}
  const [[received]]=await pool.execute("SELECT i.id FROM pedido_itens i JOIN pedidos p ON p.id=i.pedido_id WHERE p.comprador_id=? AND p.status='entregue' AND i.produto_id=? LIMIT 1",[u.id,id]);if(!received)throw erros.proibido('Só pode avaliar quem comprou e recebeu.');
  const nota=v.inteiro(b.nota,'a nota',{min:1,max:5}),titulo=v.texto(b.titulo,'o título',{min:2,max:80}),comentario=v.texto(b.comentario,'o comentário',{min:3,max:1000});const [r]=await pool.execute('INSERT INTO avaliacoes(produto_id,usuario_id,nota,titulo,comentario) VALUES(?,?,?,?,?)',[id,u.id,nota,titulo,comentario]);await pool.execute('UPDATE produtos SET avaliacao_media=(SELECT AVG(nota) FROM avaliacoes WHERE produto_id=? AND visivel=1),total_avaliacoes=(SELECT COUNT(*) FROM avaliacoes WHERE produto_id=? AND visivel=1) WHERE id=?',[id,id,id]);return res.status(201).json({item:{id:r.insertId}});
 }
 if(path==='favoritos'){
  auth();if(method==='GET'){const [rows]=await pool.execute('SELECT produto_id FROM favoritos WHERE usuario_id=?',[u.id]),itens=[];for(const f of rows){const p=await s.produto(f.produto_id);if(s.visivel(p))itens.push(s.format(p))}return res.json({itens})}
  const id=v.id(b.produto_id);await s.produto(id);if(method==='DELETE')await pool.execute('DELETE FROM favoritos WHERE usuario_id=? AND produto_id=?',[u.id,id]);else await pool.execute('INSERT IGNORE INTO favoritos(usuario_id,produto_id) VALUES(?,?)',[u.id,id]);return res.json({mensagem:'Favoritos atualizados.'});
 }
 if(path==='enderecos'){
  auth();if(method==='GET'){const [enderecos]=await pool.execute('SELECT * FROM enderecos WHERE usuario_id=?',[u.id]);return res.json({enderecos})}
  const cep=String(b.cep||'').replace(/\D/g,'');if(!/^\d{8}$/.test(cep))throw erros.requisicao('CEP inválido.');const data=[u.id,b.apelido||'Entrega',v.texto(b.destinatario,'o destinatário',{min:3,max:100}),cep,v.texto(b.logradouro,'a rua',{min:3,max:120}),v.texto(String(b.numero||''),'o número',{max:10}),String(b.complemento||'').slice(0,60),v.texto(b.bairro,'o bairro',{max:80}),v.texto(b.cidade,'a cidade',{max:80}),v.texto(b.uf,'o estado',{min:2,max:2}).toUpperCase()];
  const [r]=await pool.execute('INSERT INTO enderecos(usuario_id,apelido,destinatario,cep,logradouro,numero,complemento,bairro,cidade,uf) VALUES(?,?,?,?,?,?,?,?,?,?)',data);return res.status(201).json({endereco:{id:r.insertId,...b}});
 }
 if(/^enderecos\/\d+$/.test(path)&&method==='DELETE'){auth();const [r]=await pool.execute('DELETE FROM enderecos WHERE id=? AND usuario_id=?',[path.split('/')[1],u.id]);if(!r.affectedRows)throw erros.naoEncontrado('Endereço não encontrado.');return res.json({mensagem:'Endereço removido.'})}
 if(path==='dashboard/vendedor'||path==='dashboard/admin'){
  auth(path.endsWith('admin')?'admin':'vendedor','admin');const seller=u.nivel==='admin'?null:u.id;
  const [[p]]=await pool.execute('SELECT COUNT(*) produtos,SUM(estoque<=5) estoque_baixo FROM produtos WHERE ativo=1'+(seller?' AND vendedor_id=?':''),seller?[seller]:[]);
  const [[o]]=await pool.execute(`SELECT COUNT(DISTINCT p.id) pedidos,COALESCE(SUM(CASE WHEN p.status NOT IN('aguardando_pagamento','cancelado') THEN i.subtotal ELSE 0 END),0) receita FROM pedidos p JOIN pedido_itens i ON i.pedido_id=p.id WHERE p.oferta_id IS NOT NULL`+(seller?' AND i.vendedor_id=?':''),seller?[seller]:[]);
  const [[bids]]=await pool.execute('SELECT COUNT(*) ofertas FROM lances b JOIN rodadas_ofertas r ON r.id=b.rodada_id JOIN produtos p ON p.id=r.produto_id'+(seller?' WHERE p.vendedor_id=?':''),seller?[seller]:[]);
  const [[counts]]=await pool.query('SELECT (SELECT COUNT(*) FROM usuarios) usuarios,(SELECT COUNT(*) FROM lojas) lojas');const [[loja]]=await pool.execute('SELECT * FROM lojas WHERE usuario_id=?',[u.id]);return res.json({...p,estoque_baixo:Number(p.estoque_baixo||0),...o,receita:Number(o.receita),...bids,...counts,loja:loja||null});
 }
 if(path==='usuarios'&&method==='GET'){auth('admin');const [usuarios]=await pool.query('SELECT id,nome,email,nivel,status FROM usuarios ORDER BY id');return res.json({usuarios})}
 if(/^usuarios\/\d+$/.test(path)&&method==='PUT'){auth('admin');const id=v.id(path.split('/')[1]);if(id===u.id)throw erros.requisicao('Você não pode bloquear sua própria conta.');if(!['ativo','bloqueado'].includes(b.status))throw erros.requisicao('Status inválido.');await pool.execute('UPDATE usuarios SET status=?,token_versao=token_versao+1 WHERE id=?',[b.status,id]);await s.registrar(pool,u,'usuario_atualizado',null,{usuario_id:id});return res.json({mensagem:'Conta atualizada.'})}
 if(path==='lojas/gerenciar'){auth('admin');const [lojas]=await pool.query('SELECT * FROM lojas ORDER BY id');return res.json({lojas})}
 if(path==='auditoria'){auth('admin');const [itens]=await pool.query('SELECT a.*,u.nome usuario FROM logs_auditoria a LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.id DESC LIMIT 500');return res.json({itens})}
 if(path==='solicitacoes'){
  auth();if(method==='GET'){auth('admin');const [itens]=await pool.query('SELECT * FROM solicitacoes_vendedor ORDER BY criado_em DESC');return res.json({itens})}
  const [r]=await pool.execute('INSERT INTO solicitacoes_vendedor(usuario_id,nome_loja,descricao,cidade,uf,telefone) VALUES(?,?,?,?,?,?)',[u.id,v.texto(b.nome_loja,'a loja',{min:3,max:60}),v.texto(b.descricao,'a descrição',{min:10,max:500}),v.texto(b.cidade,'a cidade',{max:80}),v.texto(b.uf,'o estado',{min:2,max:2}).toUpperCase(),String(b.telefone||'')]);return res.status(201).json({solicitacao:{id:r.insertId,status:'pendente'}});
 }
 return next();
});
module.exports=router;
