plano de melhorias
RESPONDA TUDO EM PORTUGUES - BR, relatorios e PERGUNTAS
1. MELHORIAS AO EDITAR PRODUTO: Tirar tudo sobre debugs da tela, como em /produtos/id/editar, temos um:
DEBUG: Dados carregados
Código: 181

Descrição: ABOBRINHA 100G

GTIN: 204

Preço Venda: 8

Status: I

Vender e-commerce (default): true
tire isso.

1.1 na categoria, em editar produtos, informacoes basicas, temos o debug:
Debug Info:
{
  "response": {
    "status": 200,
    "ok": true,
    "url": "http://localhost:3000/api/categorias?tipo=categoria"
  },
  "data": {
    "success": true,
    "data": [
      "ASSADOS",
      "A - TESTE CIELO",
      "CAFE",
      "CATEGORIA TESTE",
      "CHAS",
      "COMIDA",
      "IMPRESSORAS",
      "MARMITAS",
      "PORCOES",
      "PRINCIPAL",
      "REFRIGERANTES",
      "SEM_CATEGORIA",
      "SUCOS",
      "SUPRIMENTOS",
      "teste123"
    ]
  }
}
tire tbm

1.3 temos o campo Data do cadastro e Data da ultima alteracao, elas devem ser preenchidas tbm, vc deve pegar essas infos da tabela produtos_ou, colunas: dt_cadastro / dt_ultima_alteracao

1.4 em OUTROS e Controle adicionais, todos os campos nao estao sendo salvos no banco, eu preencho, mas eles nao vao, vc ja sabe da estrutura da tabela e caso nao souber, me pergunte.


2. PAINEL NUVEMSHOP
painel esta bom, porem temos que mostrar mais informacoes na tabela de divergencias, e vamos mudar o nome de local vs snapshot para Divergencias, e vc pode colocar um icone de ( i ) e ao passar o mouse vc explica de forma breve o que se refere essa tabela, sem palavras muito tecnicas, para clientes usuais entenderem.
Informacoes necessarias na tabela: 
ID Produto nuvemshop, SKU E CODIGO DE BARRAS, NOME, e os campos divergentes.

2.1 campo de divergencias vamos botar ele para baixo de produtos e eventos, agora ele esta em cima de todos, vamos botar ele no final da pagina, no bottom das tabelas produtos e eventos.


3. LOGICA DE ATUALIZACAO DE VARIANTE:
Atualmente, quando vc exporta um produto com variante, vai certo.
Porem, se vc atualiza e exporta uma variante, direto na edicao da propria variante, o que esta acontecendo:
Ela atualiza o produto pai, coloca o nome da variante no produto pai, e nao atualiza sesu campos como dimensoes, peso, qtde
e na tabela produtos_nuvemshop, eh criado um produto novo, como se a variante fosse do tipo NORMAL.
na nuvemshop ela sobreescreve o produto pai com o nome, mas nao atualiza seus campos.
na nossa tabela, ela auto cria um produto dela mesmo, como se fosse do tipo NORMAL.

quando o nosso tipo for variante, devemos ir na API da nuvemshop no endpoint de put, como vc pode ver aqui: https://tiendanube.github.io/api-documentation/resources/product-variant
exemplo: 
PUT /products/{product_id}/variants/{id}
Modify an existing Product Variant

PUT /products/1234/variants/144
{
  "id": 144,
  "image_id": null,
  "promotional_price": "19.00",
  "created_at": "2013-01-03T09:11:51-03:00",
  "depth": null,
  "height": null,
  "values": [
    {
      "en": "X-Large"
    }
  ],
  "price": "25.00",
  "product_id": 1234,
  "stock_management": true,
  "stock": 5,
  "sku": "BSG1234D",
  "mpn": null,
  "age_group": null,
  "gender": null,
  "updated_at": "2013-06-01T09:15:11-03:00",
  "weight": "2.75",
  "width": null,
  "cost": "10.99"
}

HTTP/1.1 200 OK

{
  "id": 144,
  "image_id": null,
  "promotional_price": "19.00",
  "created_at": "2013-01-03T09:11:51-03:00",
  "depth": null,
  "height": null,
  "values": [
    {
      "en": "X-Large"
    }
  ],
  "price": "25.00",
  "product_id": 1234,
  "stock_management": true,
  "stock": 5,
  "sku": "BSG1234D",
  "mpn": null,
  "age_group": null,
  "gender": null,
  "updated_at": "2013-06-01T12:15:11-03:00",
  "weight": "2.75",
  "width": null,
  "cost": "10.99"
}

4.  DELETAR PRODUTOS NA NUVEMSHOP.
devemos ter um botao de excluir o produto na nuvemshop, no caso, o cliente clica no botao de excluir, aparece uma confirmacao em toast, se ele confirma, damos um delete no produto.
ao remover ele, devemos ir na tabela produtos, e remover as tags que identificam que ele eh um produto e-commerce, no caso, na coluna NS.
tem que suportar tanto variantes, quando produtos pai/normais
ex:
DELETE /products/{product_id}/variants/{id}
Remove a Product Variant

DELETE /products/1234/variants/112
HTTP/1.1 200 OK

{}
-----------
DELETE /products/{id}
Remove a Product

DELETE /products/1234
HTTP/1.1 200 OK

{}
