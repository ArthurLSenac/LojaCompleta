// SQL relacional MySQL: as decisões de negócio usam locks InnoDB e transações.
const crypto = require('node:crypto');
const pool = require('../database/conexao');
const { transacao } = require('../database/conexao');
const { erros } = require('../utils/erros');
const v = require('../utils/validacao');
const statusPublico = s => s === 'em_separacao' ? 'preparando' : s;
const statusBanco = s => s === 'preparando' ? 'em_separacao' : s;
const base = `SELECT p.*,c.nome categoria_nome,c.slug categoria_slug,l.id loja_id,l.nome loja_nome,l.slug loja_slug,l.cidade,l.uf,l.cor,l.ativa loja_ativa,u.status vendedor_status,c.ativa categoria_ativa,
 r.id rodada_id,r.numero rodada,r.estado negociacao_status,r.lance_aceito_id,r.pedido_id,
 (SELECT MAX(valor) FROM lances WHERE rodada_id=r.id) maior_oferta,
 (SELECT COUNT(*) FROM lances WHERE rodada_id=r.id) total_ofertas
 FROM produtos p JOIN categorias c ON c.id=p.categoria_id JOIN usuarios u ON u.id=p.vendedor_id JOIN lojas l ON l.usuario_id=p.vendedor_id
 LEFT JOIN rodadas_ofertas r ON r.produto_id=p.id AND r.numero=(SELECT MAX(numero) FROM rodadas_ofertas WHERE produto_id=p.id)`;
function format(p) {
 return {id:p.id,nome:p.nome,descricao:p.descricao,estoque:p.estoque,imagem:p.imagem,destaque:!!p.destaque,ativo:!!p.ativo,vendedor_id:p.vendedor_id,criado_em:p.criado_em,avaliacao_media:Number(p.avaliacao_media),total_avaliacoes:p.total_avaliacoes,modo_preco:'ofertas',rodada:p.rodada||1,negociacao_status:p.negociacao_status||'aberto',maior_oferta:Number(p.maior_oferta||0),total_ofertas:Number(p.total_ofertas||0),categoria:{id:p.categoria_id,nome:p.categoria_nome,slug:p.categoria_slug},loja:{id:p.loja_id,nome:p.loja_nome,slug:p.loja_slug,cidade:p.cidade,uf:p.uf,cor:p.cor}};
}
async function produto(id,conn=pool) {const [ps]=await conn.execute(base+' WHERE p.id=?',[v.id(id,'o produto')]);if(!ps[0])throw erros.naoEncontrado('Produto não encontrado.');return ps[0]}
function proprietario(u,p){if(u.nivel!=='admin'&&u.id!==p.vendedor_id)throw erros.proibido('Este produto pertence a outra loja.')}
function visivel(p){return p.ativo&&p.loja_ativa&&p.categoria_ativa&&p.vendedor_status==='ativo'}
async function bloquear(conn,id) {
 const [[p]]=await conn.execute('SELECT * FROM produtos WHERE id=? FOR UPDATE',[v.id(id,'o produto')]);if(!p)throw erros.naoEncontrado('Produto não encontrado.');
 const [[r]]=await conn.execute('SELECT * FROM rodadas_ofertas WHERE produto_id=? ORDER BY numero DESC LIMIT 1 FOR UPDATE',[p.id]);if(!r)throw erros.conflito('Rodada não inicializada. Execute a migração de ofertas.');return {p,r};
}
async function registrar(conn,u,acao,produtoId,detalhes={}){await conn.execute('INSERT INTO logs_auditoria(usuario_id,acao,entidade,entidade_id,detalhes) VALUES(?,?,?,?,?)',[u.id,acao,'produtos',produtoId,JSON.stringify(detalhes)])}
const bidSelect=`SELECT b.*,r.produto_id,r.numero rodada,r.estado rodada_estado,r.lance_aceito_id,r.pedido_id,p.vendedor_id,u.nome FROM lances b JOIN rodadas_ofertas r ON r.id=b.rodada_id JOIN produtos p ON p.id=r.produto_id JOIN usuarios u ON u.id=b.comprador_id`;
function lance(b,u,gerenciar=false){return {id:b.id,produto_id:b.produto_id,rodada:b.rodada,valor:Number(b.valor),criado_em:b.criado_em,participante:b.nome.split(' ')[0]+' '+b.nome.split(' ').at(-1)[0]+'.',minha:b.comprador_id===u?.id,status:b.id===b.lance_aceito_id?'aceita':b.estado==='superada'?'superada':b.rodada_estado==='encerrado'?'nao_escolhida':'aberta',...((gerenciar||b.comprador_id===u?.id)?{comprador_id:b.comprador_id,pedido_id:b.id===b.lance_aceito_id?b.pedido_id:null}:{})}}
async function fazerLance(u,id,body){
 const valor=v.dinheiro(body.valor,'o valor da oferta',{min:0.01,max:1000000}),chave=v.texto(body.chave,'a chave do lance',{min:16,max:100});
 if(!/^[a-zA-Z0-9-]+$/.test(chave))throw erros.requisicao('Chave de lance inválida.');
 return transacao(async conn=>{
  const {p,r}=await bloquear(conn,id);const [[existing]]=await conn.execute(bidSelect+' WHERE b.id=?',[chave]);
  if(existing){if(existing.comprador_id!==u.id||existing.produto_id!==p.id)throw erros.proibido('Oferta não autorizada.');return {lance:lance(existing,u),repetido:true}}
  const current=await produto(p.id,conn);if(!visivel(current))throw erros.naoEncontrado('Produto indisponível.');if(r.estado!=='aberto'||p.estoque<1)throw erros.conflito('Esta negociação já foi encerrada.');
  const [[mine]]=await conn.execute('SELECT MAX(valor) valor FROM lances WHERE rodada_id=? AND comprador_id=?',[r.id,u.id]);if(Number(mine.valor||0)>=valor)throw erros.requisicao('Para melhorar sua oferta, escolha um valor maior que o seu último lance.');
  await conn.execute("UPDATE lances SET estado='superada' WHERE rodada_id=? AND comprador_id=? AND estado='aberta'",[r.id,u.id]);
  await conn.execute('INSERT INTO lances(id,rodada_id,comprador_id,valor) VALUES(?,?,?,?)',[chave,r.id,u.id,valor]);await registrar(conn,u,'oferta_enviada',p.id,{valor,chave});
  const [[b]]=await conn.execute(bidSelect+' WHERE b.id=?',[chave]);return {lance:lance(b,u),repetido:false};
 });
}
async function aceitar(u,id){
 const [[b0]]=await pool.execute(bidSelect+' WHERE b.id=?',[id]);if(!b0)throw erros.naoEncontrado('Oferta não encontrada.');
 return transacao(async conn=>{
  const {p,r}=await bloquear(conn,b0.produto_id);proprietario(u,p);
  const [[b]]=await conn.execute(bidSelect+' WHERE b.id=?',[id]);if(r.lance_aceito_id===id&&r.pedido_id)return {id:r.pedido_id,repetido:true};
  if(r.estado!=='aberto'||b.rodada_id!==r.id||b.estado!=='aberta')throw erros.conflito('Esta oferta não está mais disponível.');
  const [[buyer]]=await conn.execute('SELECT status FROM usuarios WHERE id=?',[b.comprador_id]);if(!buyer||buyer.status!=='ativo')throw erros.conflito('O comprador não está ativo.');
  if(!visivel(await produto(p.id,conn))||p.estoque<1)throw erros.conflito('Produto sem estoque ou indisponível.');
  const codigo='AMB-'+crypto.randomBytes(4).toString('hex').toUpperCase();
  const [o]=await conn.execute(`INSERT INTO pedidos(codigo,comprador_id,status,forma_pagamento,subtotal,total,frete_modalidade,prazo_dias,oferta_id) VALUES(?,?,'aguardando_pagamento','combinado',?,?,'a_combinar',NULL,?)`,[codigo,b.comprador_id,b.valor,b.valor,b.id]);
  await conn.execute('INSERT INTO pedido_itens(pedido_id,produto_id,vendedor_id,produto_nome,produto_imagem,quantidade,preco_unitario,subtotal) VALUES(?,?,?,?,?,1,?,?)',[o.insertId,p.id,p.vendedor_id,p.nome,p.imagem,b.valor,b.valor]);
  await conn.execute('UPDATE produtos SET estoque=estoque-1 WHERE id=?',[p.id]);await conn.execute("UPDATE rodadas_ofertas SET estado='encerrado',lance_aceito_id=?,pedido_id=? WHERE id=?",[b.id,o.insertId,r.id]);
  await conn.execute("INSERT INTO pedido_historico(pedido_id,status,observacao,usuario_id) VALUES(?,'aguardando_pagamento','Oferta aceita; uma unidade reservada.',?)",[o.insertId,u.id]);await registrar(conn,u,'oferta_aceita',p.id,{valor:Number(b.valor),pedido_id:o.insertId});return {id:o.insertId,repetido:false};
 });
}
async function pedido(id,u,conn=pool){
 const [[p]]=await conn.execute('SELECT * FROM pedidos WHERE id=? AND oferta_id IS NOT NULL',[v.id(id,'o pedido')]);if(!p)throw erros.naoEncontrado('Negociação não encontrada.');const [itens]=await conn.execute('SELECT * FROM pedido_itens WHERE pedido_id=?',[p.id]);
 if(u.nivel!=='admin'&&p.comprador_id!==u.id&&!(u.nivel==='vendedor'&&itens.every(i=>i.vendedor_id===u.id)))throw erros.proibido('Negociação não autorizada.');
 const [historico]=await conn.execute('SELECT status,observacao,criado_em FROM pedido_historico WHERE pedido_id=? ORDER BY id',[p.id]);
 const out={id:p.id,codigo:p.codigo,comprador_id:p.comprador_id,status:statusPublico(p.status),forma_pagamento:p.forma_pagamento,subtotal:Number(p.subtotal),total:Number(p.total),desconto_pix:0,desconto_cupom:0,frete:0,frete_modalidade:'a_combinar',criado_em:p.criado_em,demo:true,itens:itens.map(i=>({...i,subtotal:Number(i.subtotal),preco_unitario:Number(i.preco_unitario)})),historico:historico.map(h=>({...h,status:statusPublico(h.status)}))};return out;
}
async function mudarPedido(u,id,acao,body={}){return transacao(async conn=>{
 // Mesma ordem de locks de aceitar/reabrir: produto, rodada e por último pedido.
 const [[item]]=await conn.execute('SELECT produto_id FROM pedido_itens WHERE pedido_id=? LIMIT 1',[v.id(id,'o pedido')]);if(!item)throw erros.naoEncontrado('Negociação não encontrada.');await bloquear(conn,item.produto_id);
 const [[row]]=await conn.execute('SELECT * FROM pedidos WHERE id=? AND oferta_id IS NOT NULL FOR UPDATE',[id]);if(!row)throw erros.naoEncontrado('Negociação não encontrada.');const p=await pedido(id,u,conn);let next;
 if(acao==='pagar'){if(u.id!==p.comprador_id&&u.nivel!=='admin')throw erros.proibido('Somente o comprador pode simular o pagamento.');if(p.status!=='aguardando_pagamento')throw erros.conflito('Este pedido já foi processado.');next='pago'}
 else if(acao==='cancelar'){if(u.id!==p.comprador_id&&u.nivel!=='admin')throw erros.proibido('Sem permissão para cancelar.');if(!['aguardando_pagamento','pago'].includes(p.status))throw erros.conflito('Este pedido não pode mais ser cancelado.');next='cancelado';await conn.execute('UPDATE produtos SET estoque=estoque+1 WHERE id=?',[item.produto_id])}
 else if(acao==='status'){if(!['vendedor','admin'].includes(u.nivel))throw erros.proibido('Sem permissão.');const stages=['pago','preparando','enviado','entregue'],i=stages.indexOf(p.status);if(i<0||i>=stages.length-1||body.status!==stages[i+1])throw erros.requisicao('Avance uma etapa por vez.');next=body.status;if(next==='entregue')await conn.execute('UPDATE produtos SET total_vendido=total_vendido+1 WHERE id=?',[item.produto_id])}
 else throw erros.naoEncontrado('Ação não encontrada.');
 await conn.execute('UPDATE pedidos SET status=? WHERE id=?',[statusBanco(next),id]);await conn.execute('INSERT INTO pedido_historico(pedido_id,status,observacao,usuario_id) VALUES(?,?,?,?)',[id,statusBanco(next),'Atualização da negociação por oferta.',u.id]);await registrar(conn,u,'pedido_'+next,item.produto_id,{pedido_id:id});return pedido(id,u,conn);
 })}
async function reabrir(u,id){return transacao(async conn=>{const {p,r}=await bloquear(conn,id);proprietario(u,p);if(r.estado!=='encerrado')throw erros.requisicao('Esta rodada já está aberta.');const [[o]]=await conn.execute('SELECT status FROM pedidos WHERE id=?',[r.pedido_id]);if(o&&!['cancelado','entregue'].includes(o.status))throw erros.requisicao('Conclua ou cancele o pedido atual antes de abrir outra rodada.');if(p.estoque<1||!p.ativo)throw erros.requisicao('Reponha o estoque e ative o produto primeiro.');await conn.execute('INSERT INTO rodadas_ofertas(produto_id,numero) VALUES(?,?)',[p.id,r.numero+1]);await registrar(conn,u,'rodada_reaberta',p.id);return {mensagem:'Nova rodada de ofertas aberta.'}})}
module.exports={base,format,produto,proprietario,visivel,bidSelect,lance,fazerLance,aceitar,pedido,mudarPedido,reabrir,registrar};
