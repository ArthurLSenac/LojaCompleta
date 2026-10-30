-- Migração não destrutiva do modelo de preço fixo para ofertas.
-- Execute uma única vez, depois de 01_estrutura.sql e 02_dados_demo.sql.
USE ambar_marketplace;
ALTER TABLE produtos DROP CHECK ck_produto_preco;
ALTER TABLE produtos DROP CHECK ck_produto_preco_original;
ALTER TABLE produtos MODIFY preco DECIMAL(10,2) NULL DEFAULT NULL;
UPDATE produtos SET preco = NULL, preco_original = NULL;
ALTER TABLE produtos ADD CONSTRAINT ck_produto_sem_preco CHECK (preco IS NULL AND preco_original IS NULL);

CREATE TABLE rodadas_ofertas (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 produto_id INT UNSIGNED NOT NULL,
 numero INT UNSIGNED NOT NULL DEFAULT 1,
 estado ENUM('aberto','encerrado') NOT NULL DEFAULT 'aberto',
 lance_aceito_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
 pedido_id INT UNSIGNED NULL,
 criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_rodada_produto FOREIGN KEY(produto_id) REFERENCES produtos(id),
 CONSTRAINT fk_rodada_pedido FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
 CONSTRAINT uk_rodada_numero UNIQUE(produto_id,numero)
) ENGINE=InnoDB;

CREATE TABLE lances (
 id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 rodada_id INT UNSIGNED NOT NULL,
 comprador_id INT UNSIGNED NOT NULL,
 valor DECIMAL(10,2) NOT NULL,
 estado ENUM('aberta','superada') NOT NULL DEFAULT 'aberta',
 criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_lance_rodada FOREIGN KEY(rodada_id) REFERENCES rodadas_ofertas(id),
 CONSTRAINT fk_lance_comprador FOREIGN KEY(comprador_id) REFERENCES usuarios(id),
 CONSTRAINT ck_lance_valor CHECK(valor > 0),
 INDEX idx_lances_rodada_valor(rodada_id,valor),
 INDEX idx_lances_comprador(comprador_id,criado_em)
) ENGINE=InnoDB;
ALTER TABLE rodadas_ofertas ADD CONSTRAINT fk_rodada_lance FOREIGN KEY(lance_aceito_id) REFERENCES lances(id);
ALTER TABLE pedidos ADD oferta_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE pedidos ADD CONSTRAINT fk_pedido_oferta FOREIGN KEY(oferta_id) REFERENCES lances(id);
ALTER TABLE pedidos ADD CONSTRAINT uk_pedido_oferta UNIQUE(oferta_id);
ALTER TABLE pedidos MODIFY forma_pagamento ENUM('pix','cartao','boleto','combinado') NOT NULL;
ALTER TABLE pedidos MODIFY frete_modalidade ENUM('economica','expressa','a_combinar') NOT NULL;
ALTER TABLE pedidos MODIFY prazo_dias TINYINT UNSIGNED NULL;
ALTER TABLE pedidos MODIFY entrega_destinatario VARCHAR(100) NULL;
ALTER TABLE pedidos MODIFY entrega_cep CHAR(8) NULL;
ALTER TABLE pedidos MODIFY entrega_logradouro VARCHAR(120) NULL;
ALTER TABLE pedidos MODIFY entrega_numero VARCHAR(10) NULL;
ALTER TABLE pedidos MODIFY entrega_bairro VARCHAR(80) NULL;
ALTER TABLE pedidos MODIFY entrega_cidade VARCHAR(80) NULL;
ALTER TABLE pedidos MODIFY entrega_uf CHAR(2) NULL;
INSERT INTO rodadas_ofertas(produto_id) SELECT id FROM produtos;
-- Pedidos históricos são preservados. A interface de ofertas usa oferta_id IS NOT NULL.

-- As fotos do catálogo são arquivos locais incluídos neste projeto.
UPDATE produtos SET imagem='/assets/fotos/photo-1505740420928-5e560c06d30e.jpg' WHERE id=1;
UPDATE produtos SET imagem='/assets/fotos/photo-1484704849700-f032a568e944.jpg' WHERE id=2;
UPDATE produtos SET imagem='/assets/fotos/photo-1766338055584-5ffe426a7e57.jpg' WHERE id=3;
UPDATE produtos SET imagem='/assets/fotos/photo-1582978571763-2d039e56f0c3.jpg' WHERE id=4;
UPDATE produtos SET imagem='/assets/fotos/photo-1547052178-7f2c5a20c332.jpg' WHERE id=5;
UPDATE produtos SET imagem='/assets/fotos/photo-1553545204-4f7d339aa06a.jpg' WHERE id=6;
UPDATE produtos SET imagem='/assets/fotos/photo-1516035069371-29a1b244cc32.jpg' WHERE id=7;
UPDATE produtos SET imagem='/assets/fotos/photo-1613040809024-b4ef7ba99bc3.jpg' WHERE id=8;
UPDATE produtos SET imagem='/assets/fotos/photo-1618384887929-16ec33fab9ef.jpg' WHERE id=9;
UPDATE produtos SET imagem='/assets/fotos/photo-1595044426077-d36d9236d54a.jpg' WHERE id=10;
UPDATE produtos SET imagem='/assets/fotos/photo-1612287230202-1ff1d85d1bdf.jpg' WHERE id=11;
UPDATE produtos SET imagem='/assets/fotos/photo-1774105416183-5058512ec5f0.jpg' WHERE id=12;
UPDATE produtos SET imagem='/assets/fotos/photo-1635987391914-cb84b567e68f.jpg' WHERE id=13;
UPDATE produtos SET imagem='/assets/fotos/photo-1552820728-8b83bb6b773f.jpg' WHERE id=14;
UPDATE produtos SET imagem='/assets/fotos/photo-1595950653106-6c9ebd614d3a.jpg' WHERE id=15;
UPDATE produtos SET imagem='/assets/fotos/photo-1600269452121-4f2416e55c28.jpg' WHERE id=16;
UPDATE produtos SET imagem='/assets/fotos/photo-1525966222134-fcfa99b8ae77.jpg' WHERE id=17;
UPDATE produtos SET imagem='/assets/fotos/photo-1611312449408-fcece27cdbb7.jpg' WHERE id=18;
UPDATE produtos SET imagem='/assets/fotos/photo-1691256676359-20e5c6d4bc92.jpg' WHERE id=19;
UPDATE produtos SET imagem='/assets/fotos/photo-1608231387042-66d1773070a5.jpg' WHERE id=20;
UPDATE produtos SET imagem='/assets/fotos/photo-1598532163257-ae3c6b2524b6.jpg' WHERE id=21;
UPDATE produtos SET imagem='/assets/fotos/photo-1600857062241-98e5dba7f214.jpg' WHERE id=22;
UPDATE produtos SET imagem='/assets/fotos/photo-1605733513597-a8f8341084e6.jpg' WHERE id=23;
UPDATE produtos SET imagem='/assets/fotos/photo-1622560480654-d96214fdc887.jpg' WHERE id=24;
UPDATE produtos SET imagem='/assets/fotos/photo-1601592996763-f05c9c80a7f1.jpg' WHERE id=25;
UPDATE produtos SET imagem='/assets/fotos/photo-1758542988969-39a10168b2ce.jpg' WHERE id=26;
UPDATE produtos SET imagem='/assets/fotos/photo-1553062407-98eeb64c6a62.jpg' WHERE id=27;
UPDATE produtos SET imagem='/assets/fotos/photo-1524805444758-089113d48a6d.jpg' WHERE id=28;
UPDATE produtos SET imagem='/assets/fotos/photo-1611107683227-e9060eccd846.jpg' WHERE id=29;
UPDATE produtos SET imagem='/assets/fotos/photo-1773929345739-94db8a4ccd0c.jpg' WHERE id=30;
UPDATE produtos SET imagem='/assets/fotos/photo-1783541507490-edb026e2a961.jpg' WHERE id=31;
UPDATE produtos SET imagem='/assets/fotos/photo-1511499767150-a48a237f0083.jpg' WHERE id=32;
UPDATE produtos SET imagem='/assets/fotos/photo-1537832816519-689ad163238b.jpg' WHERE id=33;
UPDATE produtos SET imagem='/assets/fotos/photo-1507473885765-e6ed057f782c.jpg' WHERE id=34;
UPDATE produtos SET imagem='/assets/fotos/photo-1602874801007-bd458bb1b8b6.jpg' WHERE id=35;
UPDATE produtos SET imagem='/assets/fotos/photo-1669334388727-9a3437e12fa2.jpg' WHERE id=36;
UPDATE produtos SET imagem='/assets/fotos/photo-1609061801093-1b7a8a574c69.jpg' WHERE id=37;
UPDATE produtos SET imagem='/assets/fotos/photo-1592064465579-6796bfdaa5cd.jpg' WHERE id=38;
UPDATE produtos SET imagem='/assets/fotos/photo-1601366533287-5ee4c763ae4e.jpg' WHERE id=39;
UPDATE produtos SET imagem='/assets/fotos/photo-1558897010-6732ac419cd1.jpg' WHERE id=40;
UPDATE produtos SET imagem='/assets/fotos/photo-1605702098590-d552a98dc93d.jpg' WHERE id=41;
UPDATE produtos SET imagem='/assets/fotos/photo-1595670322505-4de61b9cdf47.jpg' WHERE id=42;
UPDATE produtos SET imagem='/assets/fotos/photo-1602143407151-7111542de6e8.jpg' WHERE id=43;
UPDATE produtos SET imagem='/assets/fotos/photo-1610874150308-a1e6f8c905d9.jpg' WHERE id=44;
UPDATE produtos SET imagem='/assets/fotos/photo-1586524068358-77d2196875e7.jpg' WHERE id=45;
UPDATE produtos SET imagem='/assets/fotos/photo-1541161284823-be8c6571a945.jpg' WHERE id=46;
UPDATE produtos SET imagem='/assets/fotos/photo-1553329701-1abe5e1bf403.jpg' WHERE id=47;
UPDATE produtos SET imagem='/assets/fotos/photo-1594035910387-fea47794261f.jpg' WHERE id=48;
UPDATE produtos SET imagem='/assets/fotos/photo-1761659760494-32b921a2449f.jpg' WHERE id=49;
UPDATE produtos SET imagem='/assets/fotos/photo-1608571423902-eed4a5ad8108.jpg' WHERE id=50;
UPDATE produtos SET imagem='/assets/fotos/photo-1596462502278-27bfdc403348.jpg' WHERE id=51;
UPDATE produtos SET imagem='/assets/fotos/photo-1522335789203-aabd1fc54bc9.jpg' WHERE id=52;
UPDATE produtos SET imagem='/assets/fotos/photo-1622618991746-fe6004db3a47.jpg' WHERE id=53;
UPDATE produtos SET imagem='/assets/fotos/photo-1646239646963-b0b9be56d6b5.jpg' WHERE id=54;
UPDATE produtos SET imagem='/assets/fotos/photo-1638536534984-0d98ccdb6af5.jpg' WHERE id=55;
UPDATE produtos SET imagem='/assets/fotos/photo-1560769629-975ec94e6a86.jpg' WHERE id=56;
UPDATE produtos SET imagem='/assets/fotos/photo-1591291621164-2c6367723315.jpg' WHERE id=57;
UPDATE produtos SET imagem='/assets/fotos/photo-1600185365926-3a2ce3cdb9eb.jpg' WHERE id=58;
UPDATE produtos SET imagem='/assets/fotos/photo-1763004871583-4183d64096b1.jpg' WHERE id=59;
UPDATE produtos SET imagem='/assets/fotos/photo-1545249390-6bdfa286032f.jpg' WHERE id=60;
UPDATE produtos SET imagem='/assets/fotos/photo-1768859336207-3c3ba2027cca.jpg' WHERE id=61;
UPDATE produtos SET imagem='/assets/fotos/photo-1738127918918-7589e808444c.jpg' WHERE id=62;
UPDATE produtos SET imagem='/assets/fotos/photo-1675962614159-2b62fc7d0007.jpg' WHERE id=63;
UPDATE produtos SET imagem='/assets/fotos/photo-1789846958535-075e099d3c4d.jpg' WHERE id=64;
UPDATE produtos SET imagem='/assets/fotos/photo-1611079830811-865ff4428d17.jpg' WHERE id=65;
UPDATE produtos SET imagem='/assets/fotos/photo-1647559709298-c0e3dcb47092.jpg' WHERE id=66;
UPDATE produtos SET imagem='/assets/fotos/photo-1512820790803-83ca734da794.jpg' WHERE id=67;
UPDATE produtos SET imagem='/assets/fotos/photo-1531346878377-a5be20888e57.jpg' WHERE id=68;
UPDATE produtos SET imagem='/assets/fotos/photo-1543002588-bfa74002ed7e.jpg' WHERE id=69;
UPDATE categorias SET imagem='/assets/fotos/photo-1505740420928-5e560c06d30e.jpg' WHERE id=1;
UPDATE categorias SET imagem='/assets/fotos/photo-1612287230202-1ff1d85d1bdf.jpg' WHERE id=2;
UPDATE categorias SET imagem='/assets/fotos/photo-1595950653106-6c9ebd614d3a.jpg' WHERE id=3;
UPDATE categorias SET imagem='/assets/fotos/photo-1598532163257-ae3c6b2524b6.jpg' WHERE id=4;
UPDATE categorias SET imagem='/assets/fotos/photo-1611107683227-e9060eccd846.jpg' WHERE id=5;
UPDATE categorias SET imagem='/assets/fotos/photo-1507473885765-e6ed057f782c.jpg' WHERE id=6;
UPDATE categorias SET imagem='/assets/fotos/photo-1595670322505-4de61b9cdf47.jpg' WHERE id=7;
UPDATE categorias SET imagem='/assets/fotos/photo-1608571423902-eed4a5ad8108.jpg' WHERE id=8;
UPDATE categorias SET imagem='/assets/fotos/photo-1646239646963-b0b9be56d6b5.jpg' WHERE id=9;
UPDATE categorias SET imagem='/assets/fotos/photo-1545249390-6bdfa286032f.jpg' WHERE id=10;
UPDATE categorias SET imagem='/assets/fotos/photo-1512820790803-83ca734da794.jpg' WHERE id=11;
