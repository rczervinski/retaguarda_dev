quero refazer o sistema todo do /retaguarda do zero.

o sistema antigo eh ruim, desorganizado e usa muitas tecnologias antigas como materialize, etc.
quero ajuda pra fazer um novo sistema, organizado, e com as teclonlogias atuais.

primeiro, quero que vc organize um plano de implementacao, eu tava pensando em algo tipo:

1. dashboard inteligente com estatistica de produtos, acoes rapidas e sidebar com links para as funcionalidades do sistema.
2. comecaremos pela parte de produtos, que sera a mais importante do sistema.
3. voce pode fazer um componente de tabela, que sera usado no sistema inteiro, no caso, manter um padrao entre tabelas.
4. quero que vc crie algo novo e funcional, entao, o index da pagina eh o dashboard, e vc pode escolher se quer ter rotas, ou single page only, depende do qual sera mais funcional.
5. banco de dados NAO PODE MUDAR. tem q ser adaptado ao banco de dados. vc pode usar o prisma para poder mapear as tabelas do banco de dados, porem nao pode mudar nada no banco atual.
vc encontra a conexao no banco em conexao.php no sistema antigo.

vou te passar as principais funcionalidades para vc mapear, e depois comecar a fazer o dashboard, as funcionalidades que nao iremos mexer agora, voce pode deixar como "em desenvolvimento"
e comecaremos por produtos, onde teremos a tabela que lista os produtos, e as fucnionalidades. vou mapear o site todo pra vc:


sidebar tera:

opcao CADASTROS
- clientes
- produtos
- fornecedores 
- transportadoras
- vendedores
- usuarios
- promocoes

opcao FINANCEIRO
- contas a receber
- contas a pagar

relatorios
- listagen de produtos
- produtos no e-commerce

NFE opcao unica

ORCAMENTO opcao unica

VENDAS ONLINE opcao unica

Integracoes
- nuvemshop
- mercadolivre


COMECAREMOS EM CADASTROS>PRODUTOS

conexao com o banco é :

<?php

// Desabilitar exibição de erros para evitar interferir no JSON
error_reporting(0);
ini_set('display_errors', 0);

$host = "postgresql-198445-0.cloudclusters.net";
$port = "19627";
$database = "01414955000158";
$user = "u01414955000158";
$password = "014158@@";

// String de conexão
$conn_string = "host={$host} port={$port} dbname={$database} user={$user} password={$password}";

// Tenta conectar
$conexao = pg_connect($conn_string);

// Verificar se a conexão foi bem-sucedida
if (!$conexao) {
    // Log do erro para depuração
    error_log("Erro de conexão PostgreSQL: " . pg_last_error());
}

?>

vc nao precisa usar isso, apenas as credenciais para conectar e mapear as tabelas do banco de dados