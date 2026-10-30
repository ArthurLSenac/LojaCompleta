-- =====================================================================
--  ÂMBAR MARKETPLACE — estrutura do banco de dados (MySQL 8.0.16+)
-- ---------------------------------------------------------------------
--  ATENÇÃO: este script RECRIA o banco de demonstração do zero.
--  Ele apaga o banco "ambar_marketplace" se já existir.
--  Datas usam TIMESTAMP: o MySQL guarda em UTC e converte pelo fuso
--  da sessão, então NOW() no Workbench e na API representam o mesmo instante.
-- =====================================================================
SET NAMES utf8mb4;
DROP DATABASE IF EXISTS ambar_marketplace;
CREATE DATABASE ambar_marketplace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ambar_marketplace;

-- ---------------------------------------------------------------------
-- Pessoas e lojas
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome             VARCHAR(100) NOT NULL,
    email            VARCHAR(180) NOT NULL,
    senha_hash       VARCHAR(255) NOT NULL,              -- bcrypt; a senha original nunca é gravada
    nivel            ENUM('admin', 'vendedor', 'comprador') NOT NULL DEFAULT 'comprador',
    status           ENUM('ativo', 'bloqueado') NOT NULL DEFAULT 'ativo',
    telefone         VARCHAR(20) NULL,
    tentativas_login TINYINT UNSIGNED NOT NULL DEFAULT 0, -- erros seguidos de senha
    bloqueado_ate    TIMESTAMP NULL,                      -- bloqueio temporário após muitas tentativas
    token_versao     INT UNSIGNED NOT NULL DEFAULT 0,     -- aumentar invalida todos os JWT emitidos
    ultimo_login     TIMESTAMP NULL,
    criado_em        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_usuarios_email UNIQUE (email),
    INDEX idx_usuarios_nivel_status (nivel, status)
) ENGINE = InnoDB;

-- Cada vendedor tem exatamente uma loja (relação 1:1 garantida pelo UNIQUE).
CREATE TABLE lojas (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario_id    INT UNSIGNED NOT NULL,
    nome          VARCHAR(60) NOT NULL,
    slug          VARCHAR(70) NOT NULL,
    descricao     VARCHAR(500) NOT NULL,
    cidade        VARCHAR(80) NOT NULL,
    uf            CHAR(2) NOT NULL,
    cor           CHAR(7) NOT NULL DEFAULT '#F5A524',
    ativa         BOOLEAN NOT NULL DEFAULT TRUE,           -- loja suspensa some do catálogo
    criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_lojas_usuario UNIQUE (usuario_id),
    CONSTRAINT uk_lojas_slug UNIQUE (slug),
    CONSTRAINT uk_lojas_nome UNIQUE (nome),
    CONSTRAINT fk_lojas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    CONSTRAINT ck_lojas_cor CHECK (cor REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE = InnoDB;

-- Um comprador pede para virar vendedor; a administração aprova ou recusa.
CREATE TABLE solicitacoes_vendedor (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario_id    INT UNSIGNED NOT NULL,
    nome_loja     VARCHAR(60) NOT NULL,
    descricao     VARCHAR(500) NOT NULL,
    cidade        VARCHAR(80) NOT NULL,
    uf            CHAR(2) NOT NULL,
    telefone      VARCHAR(20) NOT NULL,
    status        ENUM('pendente', 'aprovada', 'recusada') NOT NULL DEFAULT 'pendente',
    motivo        VARCHAR(300) NULL,
    avaliado_por  INT UNSIGNED NULL,
    avaliado_em   TIMESTAMP NULL,
    criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_solicitacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    CONSTRAINT fk_solicitacao_avaliador FOREIGN KEY (avaliado_por) REFERENCES usuarios (id),
    INDEX idx_solicitacoes_status (status, criado_em)
) ENGINE = InnoDB;

CREATE TABLE enderecos (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario_id   INT UNSIGNED NOT NULL,
    apelido      VARCHAR(40) NOT NULL,
    destinatario VARCHAR(100) NOT NULL,
    cep          CHAR(8) NOT NULL,
    logradouro   VARCHAR(120) NOT NULL,
    numero       VARCHAR(10) NOT NULL,
    complemento  VARCHAR(60) NULL,
    bairro       VARCHAR(80) NOT NULL,
    cidade       VARCHAR(80) NOT NULL,
    uf           CHAR(2) NOT NULL,
    principal    BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_endereco_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT ck_endereco_cep CHECK (cep REGEXP '^[0-9]{8}$'),
    INDEX idx_enderecos_usuario (usuario_id, principal)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
    id        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome      VARCHAR(60) NOT NULL,
    slug      VARCHAR(70) NOT NULL,
    descricao VARCHAR(300) NOT NULL,
    icone     VARCHAR(30) NOT NULL DEFAULT 'caixa',
    imagem    VARCHAR(600) NULL,
    ordem     SMALLINT NOT NULL DEFAULT 0,
    ativa     BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_categorias_nome UNIQUE (nome),
    CONSTRAINT uk_categorias_slug UNIQUE (slug)
) ENGINE = InnoDB;

CREATE TABLE produtos (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    vendedor_id      INT UNSIGNED NOT NULL,
    categoria_id     INT UNSIGNED NOT NULL,
    nome             VARCHAR(120) NOT NULL,
    descricao        TEXT NOT NULL,
    preco            DECIMAL(10, 2) NOT NULL,
    preco_original   DECIMAL(10, 2) NULL,                 -- "de R$ X por R$ Y"
    estoque          INT UNSIGNED NOT NULL DEFAULT 0,
    imagem           VARCHAR(600) NOT NULL,
    destaque         BOOLEAN NOT NULL DEFAULT FALSE,      -- escolhido pela curadoria
    frete_gratis     BOOLEAN NOT NULL DEFAULT FALSE,
    ativo            BOOLEAN NOT NULL DEFAULT TRUE,       -- exclusão lógica preserva o histórico
    avaliacao_media  DECIMAL(3, 2) NOT NULL DEFAULT 0,    -- recalculada a cada avaliação
    total_avaliacoes INT UNSIGNED NOT NULL DEFAULT 0,
    total_vendido    INT UNSIGNED NOT NULL DEFAULT 0,     -- atualizado na mesma transação da venda
    criado_em        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_produto_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios (id),
    CONSTRAINT fk_produto_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id),
    CONSTRAINT ck_produto_preco CHECK (preco > 0),
    CONSTRAINT ck_produto_preco_original CHECK (preco_original IS NULL OR preco_original > preco),
    CONSTRAINT ck_produto_avaliacao CHECK (avaliacao_media BETWEEN 0 AND 5),
    INDEX idx_produtos_categoria (categoria_id, ativo),
    INDEX idx_produtos_vendedor (vendedor_id, ativo),
    INDEX idx_produtos_vendidos (total_vendido)
) ENGINE = InnoDB;

CREATE TABLE produto_imagens (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    produto_id INT UNSIGNED NOT NULL,
    url        VARCHAR(600) NOT NULL,
    ordem      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    CONSTRAINT fk_imagem_produto FOREIGN KEY (produto_id) REFERENCES produtos (id) ON DELETE CASCADE,
    INDEX idx_imagens_produto (produto_id, ordem)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------
CREATE TABLE cupons (
    id                    INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    codigo                VARCHAR(30) NOT NULL,
    descricao             VARCHAR(160) NOT NULL,
    tipo                  ENUM('percentual', 'valor') NOT NULL,
    valor                 DECIMAL(10, 2) NOT NULL,
    valor_minimo          DECIMAL(10, 2) NOT NULL DEFAULT 0,
    desconto_maximo       DECIMAL(10, 2) NULL,           -- teto para cupons percentuais
    limite_uso            INT UNSIGNED NULL,             -- NULL = sem limite total
    usos                  INT UNSIGNED NOT NULL DEFAULT 0,
    uso_unico_por_cliente BOOLEAN NOT NULL DEFAULT TRUE,
    primeira_compra       BOOLEAN NOT NULL DEFAULT FALSE,
    inicio                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim                   TIMESTAMP NOT NULL,
    ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por            INT UNSIGNED NULL,
    criado_em             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_cupons_codigo UNIQUE (codigo),
    CONSTRAINT fk_cupom_criador FOREIGN KEY (criado_por) REFERENCES usuarios (id),
    CONSTRAINT ck_cupom_valor CHECK (valor > 0),
    CONSTRAINT ck_cupom_percentual CHECK (tipo <> 'percentual' OR valor <= 90),
    CONSTRAINT ck_cupom_periodo CHECK (fim > inicio)
) ENGINE = InnoDB;

CREATE TABLE pedidos (
    id                   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    codigo               VARCHAR(12) NOT NULL,            -- código amigável, ex.: AMB-7K2Q9X
    comprador_id         INT UNSIGNED NOT NULL,
    status               ENUM('aguardando_pagamento', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado') NOT NULL,
    forma_pagamento      ENUM('pix', 'cartao', 'boleto') NOT NULL,
    parcelas             TINYINT UNSIGNED NOT NULL DEFAULT 1,
    subtotal             DECIMAL(12, 2) NOT NULL,
    desconto_cupom       DECIMAL(12, 2) NOT NULL DEFAULT 0,
    desconto_pix         DECIMAL(12, 2) NOT NULL DEFAULT 0,
    frete                DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total                DECIMAL(12, 2) NOT NULL,
    cupom_id             INT UNSIGNED NULL,
    frete_modalidade     ENUM('economica', 'expressa') NOT NULL,
    prazo_dias           TINYINT UNSIGNED NOT NULL,
    -- O endereço é copiado para o pedido: editar o cadastro depois não muda a entrega.
    entrega_destinatario VARCHAR(100) NOT NULL,
    entrega_cep          CHAR(8) NOT NULL,
    entrega_logradouro   VARCHAR(120) NOT NULL,
    entrega_numero       VARCHAR(10) NOT NULL,
    entrega_complemento  VARCHAR(60) NULL,
    entrega_bairro       VARCHAR(80) NOT NULL,
    entrega_cidade       VARCHAR(80) NOT NULL,
    entrega_uf           CHAR(2) NOT NULL,
    codigo_rastreio      VARCHAR(13) NULL,
    criado_em            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_pedidos_codigo UNIQUE (codigo),
    CONSTRAINT fk_pedido_comprador FOREIGN KEY (comprador_id) REFERENCES usuarios (id),
    CONSTRAINT fk_pedido_cupom FOREIGN KEY (cupom_id) REFERENCES cupons (id),
    CONSTRAINT ck_pedido_total CHECK (total > 0),
    CONSTRAINT ck_pedido_parcelas CHECK (parcelas BETWEEN 1 AND 12),
    INDEX idx_pedidos_comprador (comprador_id, criado_em),
    INDEX idx_pedidos_status (status, criado_em)
) ENGINE = InnoDB;

-- Nome, imagem e preço são uma "fotografia" do momento da compra.
CREATE TABLE pedido_itens (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    pedido_id      INT UNSIGNED NOT NULL,
    produto_id     INT UNSIGNED NOT NULL,
    vendedor_id    INT UNSIGNED NOT NULL,
    produto_nome   VARCHAR(120) NOT NULL,
    produto_imagem VARCHAR(600) NOT NULL,
    quantidade     INT UNSIGNED NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal       DECIMAL(12, 2) NOT NULL,
    CONSTRAINT fk_item_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
    CONSTRAINT fk_item_produto FOREIGN KEY (produto_id) REFERENCES produtos (id),
    CONSTRAINT fk_item_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios (id),
    CONSTRAINT uk_item_pedido_produto UNIQUE (pedido_id, produto_id),
    CONSTRAINT ck_item_quantidade CHECK (quantidade > 0),
    CONSTRAINT ck_item_preco CHECK (preco_unitario > 0),
    INDEX idx_itens_vendedor (vendedor_id)
) ENGINE = InnoDB;

-- Linha do tempo do pedido: cada mudança de status vira um registro.
CREATE TABLE pedido_historico (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    pedido_id  INT UNSIGNED NOT NULL,
    status     ENUM('aguardando_pagamento', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado') NOT NULL,
    observacao VARCHAR(200) NULL,
    usuario_id INT UNSIGNED NULL,
    criado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historico_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
    CONSTRAINT fk_historico_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    INDEX idx_historico_pedido (pedido_id, criado_em)
) ENGINE = InnoDB;

CREATE TABLE cupom_usos (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cupom_id   INT UNSIGNED NOT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    pedido_id  INT UNSIGNED NOT NULL,
    criado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_cupom_uso_pedido UNIQUE (pedido_id),
    CONSTRAINT fk_uso_cupom FOREIGN KEY (cupom_id) REFERENCES cupons (id),
    CONSTRAINT fk_uso_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    CONSTRAINT fk_uso_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
    INDEX idx_usos_cupom_usuario (cupom_id, usuario_id)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Interação dos clientes
-- ---------------------------------------------------------------------
CREATE TABLE avaliacoes (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    produto_id    INT UNSIGNED NOT NULL,
    usuario_id    INT UNSIGNED NOT NULL,
    nota          TINYINT UNSIGNED NOT NULL,
    titulo        VARCHAR(80) NOT NULL,
    comentario    VARCHAR(1000) NOT NULL,
    visivel       BOOLEAN NOT NULL DEFAULT TRUE,          -- moderação da administração
    criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_avaliacao_produto_usuario UNIQUE (produto_id, usuario_id),
    CONSTRAINT fk_avaliacao_produto FOREIGN KEY (produto_id) REFERENCES produtos (id),
    CONSTRAINT fk_avaliacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    CONSTRAINT ck_avaliacao_nota CHECK (nota BETWEEN 1 AND 5)
) ENGINE = InnoDB;

CREATE TABLE perguntas (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    produto_id    INT UNSIGNED NOT NULL,
    usuario_id    INT UNSIGNED NOT NULL,
    pergunta      VARCHAR(500) NOT NULL,
    resposta      VARCHAR(1000) NULL,
    respondido_por INT UNSIGNED NULL,
    respondido_em TIMESTAMP NULL,
    criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pergunta_produto FOREIGN KEY (produto_id) REFERENCES produtos (id),
    CONSTRAINT fk_pergunta_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    CONSTRAINT fk_pergunta_respondente FOREIGN KEY (respondido_por) REFERENCES usuarios (id),
    INDEX idx_perguntas_produto (produto_id, criado_em)
) ENGINE = InnoDB;

-- Relação N:N entre usuários e produtos.
CREATE TABLE favoritos (
    usuario_id INT UNSIGNED NOT NULL,
    produto_id INT UNSIGNED NOT NULL,
    criado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, produto_id),
    CONSTRAINT fk_favorito_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_favorito_produto FOREIGN KEY (produto_id) REFERENCES produtos (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE newsletter (
    id        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email     VARCHAR(180) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_newsletter_email UNIQUE (email)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Operação da plataforma
-- ---------------------------------------------------------------------
CREATE TABLE banners (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    titulo      VARCHAR(80) NOT NULL,
    subtitulo   VARCHAR(180) NOT NULL,
    texto_botao VARCHAR(30) NOT NULL,
    link        VARCHAR(300) NOT NULL,
    imagem      VARCHAR(600) NOT NULL,
    video       VARCHAR(600) NULL,
    ordem       SMALLINT NOT NULL DEFAULT 0,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE configuracoes (
    chave         VARCHAR(50) NOT NULL PRIMARY KEY,
    valor         VARCHAR(255) NOT NULL,
    tipo          ENUM('numero', 'texto', 'booleano') NOT NULL,
    descricao     VARCHAR(200) NOT NULL,
    publica       BOOLEAN NOT NULL DEFAULT FALSE,         -- pode ser lida pelo front-end sem login
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE logs_auditoria (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NULL,
    acao       VARCHAR(60) NOT NULL,
    entidade   VARCHAR(40) NULL,
    entidade_id INT UNSIGNED NULL,
    detalhes   JSON NULL,
    ip         VARCHAR(45) NULL,
    criado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    INDEX idx_logs_acao (acao, criado_em),
    INDEX idx_logs_data (criado_em)
) ENGINE = InnoDB;
