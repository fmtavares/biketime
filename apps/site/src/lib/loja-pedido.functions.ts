import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const itemSchema = z.object({
  tipo: z.enum(["bike", "produto"]),
  bikeEstoqueId: z.string().uuid().optional(),
  produtoId: z.string().uuid().optional(),
  varianteId: z.string().uuid().nullable().optional(),
  quantidade: z.number().int().min(1).max(99),
});

const fichaSchema = z.object({
  whatsapp: z.string().trim().min(8, "Informe o WhatsApp"),
  telefone_secundario: z.string().trim().max(20).optional().or(z.literal("")),
  data_nascimento: z.string().trim().optional().or(z.literal("")),
  cep: z.string().trim().refine((v) => v.replace(/\D/g, "").length === 8, "Informe o CEP"),
  endereco: z.string().trim().min(1, "Informe o endereço"),
  numero: z.string().trim().min(1, "Informe o número"),
  apto: z.string().trim().max(40).optional().or(z.literal("")),
  bairro: z.string().trim().min(1, "Informe o bairro"),
  cidade: z.string().trim().min(1, "Informe a cidade"),
  estado: z.string().trim().length(2, "Informe o estado"),
  instagram: z.string().trim().max(40).optional().or(z.literal("")),
});

const cadastroSchema = fichaSchema.extend({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type FichaCadastro = z.infer<typeof fichaSchema>;

/** Texto vazio vira nulo para coluna opcional. */
function textoOuNulo(v?: string | null) {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * Campos de contato e endereço gravados na ficha.
 * CEP fica só com dígitos. Estado em duas letras.
 */
function gravarFicha(data: FichaCadastro) {
  return {
    whatsapp: data.whatsapp.trim(),
    telefone_secundario: textoOuNulo(data.telefone_secundario),
    data_nascimento: textoOuNulo(data.data_nascimento),
    cep: data.cep.replace(/\D/g, ""),
    endereco: data.endereco.trim(),
    numero: data.numero.trim(),
    apto: textoOuNulo(data.apto),
    bairro: data.bairro.trim(),
    cidade: data.cidade.trim(),
    estado: data.estado.trim().toUpperCase(),
    instagram: textoOuNulo(data.instagram),
  };
}

/**
 * WhatsApp e endereço completos. Sem isso o pedido não fecha.
 */
function fichaCompleta(c: {
  whatsapp?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}) {
  const ok = (v?: string | null) => Boolean(v && String(v).trim());
  return (
    ok(c.whatsapp) &&
    String(c.cep ?? "").replace(/\D/g, "").length === 8 &&
    ok(c.endereco) &&
    ok(c.numero) &&
    ok(c.bairro) &&
    ok(c.cidade) &&
    ok(c.estado)
  );
}

type ItemEntrada = z.infer<typeof itemSchema>;

type ItemCotado = {
  tipo: "bike" | "produto";
  bike_estoque_id: string | null;
  produto_id: string | null;
  produto_variante_id: string | null;
  nome: string;
  tamanho: string | null;
  quantidade: number;
  preco_unitario: number;
};

/** Arredonda dinheiro para centavos. */
function dinheiro(n: number) {
  return Math.round(n * 100) / 100;
}

/** Data de hoje em São Paulo, no formato do banco (YYYY-MM-DD). */
function hojeSp() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Recalcula preços na vitrine e o desconto do cupom.
 * O navegador não define o total. Não altera estoque.
 */
async function cotar(itens: ItemEntrada[], codigo?: string) {
  const db = supabaseAdmin as any;
  if (!itens.length) return { ok: false as const, error: "O carrinho está vazio." };

  const precificados: ItemCotado[] = [];
  for (const item of itens) {
    if (item.tipo === "bike") {
      if (!item.bikeEstoqueId) return { ok: false as const, error: "Bike inválida no carrinho." };
      const { data } = await db
        .from("loja_bikes")
        .select("id, marca, modelo, valor_proposto, tamanho")
        .eq("id", item.bikeEstoqueId)
        .maybeSingle();
      if (!data) return { ok: false as const, error: "Uma bike do carrinho saiu do showroom." };
      precificados.push({
        tipo: "bike",
        bike_estoque_id: data.id,
        produto_id: null,
        produto_variante_id: null,
        nome: `${data.marca} ${data.modelo}`.trim(),
        tamanho: data.tamanho ?? null,
        quantidade: 1,
        preco_unitario: Number(data.valor_proposto) || 0,
      });
      continue;
    }

    if (!item.produtoId) return { ok: false as const, error: "Produto inválido no carrinho." };
    const { data } = await db
      .from("loja_produtos")
      .select("id, nome, preco_venda")
      .eq("id", item.produtoId)
      .maybeSingle();
    if (!data) return { ok: false as const, error: "Um produto do carrinho saiu do showroom." };

    let tamanho: string | null = null;
    let varianteId: string | null = null;
    if (item.varianteId) {
      const { data: variante } = await db
        .from("produto_variantes")
        .select("id, tamanho, produto_id, ativo")
        .eq("id", item.varianteId)
        .maybeSingle();
      if (!variante || variante.produto_id !== data.id || !variante.ativo) {
        return { ok: false as const, error: "Escolha um tamanho válido." };
      }
      tamanho = variante.tamanho;
      varianteId = variante.id;
    } else {
      const { count } = await db
        .from("produto_variantes")
        .select("id", { count: "exact", head: true })
        .eq("produto_id", data.id)
        .eq("ativo", true);
      if ((count ?? 0) > 0) return { ok: false as const, error: "Escolha o tamanho do produto." };
    }

    precificados.push({
      tipo: "produto",
      bike_estoque_id: null,
      produto_id: data.id,
      produto_variante_id: varianteId,
      nome: data.nome,
      tamanho,
      quantidade: item.quantidade,
      preco_unitario: Number(data.preco_venda) || 0,
    });
  }

  const subtotal = dinheiro(
    precificados.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0),
  );

  let desconto = 0;
  let cupom: {
    id: string;
    codigo: string;
    parceiro_id: string;
  } | null = null;

  const codigoLimpo = codigo?.trim();
  if (codigoLimpo) {
    const { data: row } = await db
      .from("cupons")
      .select("id, codigo, tipo, valor, ativo, valido_ate, limite_usos, parceiro_id")
      .ilike("codigo", codigoLimpo)
      .maybeSingle();
    if (!row || !row.ativo) return { ok: false as const, error: "Cupom inválido." };
    if (row.valido_ate && String(row.valido_ate) < hojeSp()) {
      return { ok: false as const, error: "Cupom vencido." };
    }
    if (row.limite_usos) {
      const { count } = await db
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .eq("cupom_id", row.id)
        .neq("status", "cancelado");
      if ((count ?? 0) >= row.limite_usos) {
        return { ok: false as const, error: "Este cupom já atingiu o limite de usos." };
      }
    }
    const valor = Number(row.valor) || 0;
    desconto =
      row.tipo === "percentual"
        ? dinheiro((subtotal * valor) / 100)
        : dinheiro(Math.min(valor, subtotal));
    cupom = { id: row.id, codigo: row.codigo, parceiro_id: row.parceiro_id };
  }

  return {
    ok: true as const,
    itens: precificados,
    subtotal,
    desconto,
    total: dinheiro(Math.max(0, subtotal - desconto)),
    cupom,
  };
}

/**
 * Cria a conta do showroom: usuário Auth e linha em clientes.
 * Se o e-mail já for um cliente da loja sem acesso, só vincula.
 */
export const cadastrarClienteShowroom = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cadastroSchema.parse(data))
  .handler(async ({ data }) => {
    const db = supabaseAdmin as any;
    const email = data.email.trim().toLowerCase();
    const nome = data.nome.trim();

    const { data: existente } = await db
      .from("clientes")
      .select("id, user_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existente?.user_id) {
      return {
        ok: false as const,
        error: "Já existe uma conta com este e-mail. Entre para continuar.",
      };
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: nome, tipo: "cliente" },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "";
      if (/already|registered|exists/i.test(msg)) {
        return {
          ok: false as const,
          error: "Já existe uma conta com este e-mail. Entre para continuar.",
        };
      }
      return { ok: false as const, error: msg || "Não foi possível criar a conta." };
    }

    const userId = created.user.id;
    const ficha = { ...gravarFicha(data), nome, email };
    if (existente?.id) {
      const { error } = await db
        .from("clientes")
        .update({ ...ficha, user_id: userId })
        .eq("id", existente.id);
      if (error) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return { ok: false as const, error: error.message };
      }
    } else {
      const { error } = await db.from("clientes").insert({
        ...ficha,
        user_id: userId,
      });
      if (error) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return { ok: false as const, error: error.message };
      }
    }

    return { ok: true as const };
  });

/**
 * Valida o cupom e devolve subtotal, desconto e total.
 * O parceiro fica no cadastro do cupom; a compra só manda o código.
 */
export const aplicarCupom = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        itens: z.array(itemSchema).min(1),
        codigo: z.string().trim().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const cotacao = await cotar(data.itens, data.codigo);
    if (!cotacao.ok) return cotacao;
    if (!cotacao.cupom) return { ok: false as const, error: "Cupom inválido." };
    return {
      ok: true as const,
      codigo: cotacao.cupom.codigo,
      subtotal: cotacao.subtotal,
      desconto: cotacao.desconto,
      total: cotacao.total,
    };
  });

/**
 * Grava o pedido como aguardando a loja.
 * Copia o parceiro do cupom. Não mexe em estoque nem no status da bike.
 */
export const confirmarPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        itens: z.array(itemSchema).min(1),
        codigo: z.string().trim().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = supabaseAdmin as any;
    const cotacao = await cotar(data.itens, data.codigo);
    if (!cotacao.ok) return cotacao;

    const { data: cliente } = await db
      .from("clientes")
      .select("id, whatsapp, cep, endereco, numero, bairro, cidade, estado")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cliente) {
      return { ok: false as const, error: "Cadastre-se para fechar o pedido." };
    }
    if (!fichaCompleta(cliente)) {
      return { ok: false as const, error: "Complete o WhatsApp e o endereço para fechar o pedido." };
    }

    const { data: pedido, error } = await db
      .from("pedidos")
      .insert({
        cliente_id: cliente.id,
        status: "aguardando_loja",
        subtotal: cotacao.subtotal,
        desconto: cotacao.desconto,
        total: cotacao.total,
        cupom_id: cotacao.cupom?.id ?? null,
        parceiro_id: cotacao.cupom?.parceiro_id ?? null,
        codigo_cupom: cotacao.cupom?.codigo ?? null,
      })
      .select("id, numero, subtotal, desconto, total, codigo_cupom")
      .single();
    if (error || !pedido) {
      return { ok: false as const, error: error?.message || "Não foi possível gravar o pedido." };
    }

    const { error: itensErr } = await db.from("pedido_itens").insert(
      cotacao.itens.map((i) => ({ ...i, pedido_id: pedido.id })),
    );
    if (itensErr) {
      await db.from("pedidos").delete().eq("id", pedido.id);
      return { ok: false as const, error: itensErr.message };
    }

    return { ok: true as const, pedido };
  });

/**
 * Lê um pedido do cliente logado para a tela de confirmação.
 */
export const lerPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = supabaseAdmin as any;
    const { data: cliente } = await db
      .from("clientes")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cliente) return { ok: false as const, error: "Pedido não encontrado." };

    const { data: pedido } = await db
      .from("pedidos")
      .select("id, numero, status, subtotal, desconto, total, codigo_cupom, created_at")
      .eq("id", data.id)
      .eq("cliente_id", cliente.id)
      .maybeSingle();
    if (!pedido) return { ok: false as const, error: "Pedido não encontrado." };

    const { data: itens } = await db
      .from("pedido_itens")
      .select("id, nome, tamanho, quantidade, preco_unitario, tipo")
      .eq("pedido_id", pedido.id);
    return { ok: true as const, pedido, itens: itens ?? [] };
  });
