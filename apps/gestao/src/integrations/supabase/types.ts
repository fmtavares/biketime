export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bike_estoque_observations: {
        Row: {
          bike_estoque_id: string
          created_at: string
          id: string
          texto: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bike_estoque_id: string
          created_at?: string
          id?: string
          texto: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bike_estoque_id?: string
          created_at?: string
          id?: string
          texto?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_estoque_observations_bike_estoque_id_fkey"
            columns: ["bike_estoque_id"]
            isOneToOne: false
            referencedRelation: "bikes_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_fotos: {
        Row: {
          bike_id: string
          created_at: string
          id: string
          storage_path: string
          tipo: string
        }
        Insert: {
          bike_id: string
          created_at?: string
          id?: string
          storage_path: string
          tipo: string
        }
        Update: {
          bike_id?: string
          created_at?: string
          id?: string
          storage_path?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_fotos_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      bikes: {
        Row: {
          ano: number | null
          bike_atual: boolean
          cliente_id: string
          cor: string | null
          created_at: string
          data_compra: string | null
          grupo: string | null
          id: string
          marca: string
          modelo: string
          numero_serie: string | null
          observacoes: string | null
          onde_comprou: string | null
          rodas: string | null
          status: string
          tamanho: string | null
          tipo: string | null
          updated_at: string
          valor_pago: number | null
        }
        Insert: {
          ano?: number | null
          bike_atual?: boolean
          cliente_id: string
          cor?: string | null
          created_at?: string
          data_compra?: string | null
          grupo?: string | null
          id?: string
          marca: string
          modelo: string
          numero_serie?: string | null
          observacoes?: string | null
          onde_comprou?: string | null
          rodas?: string | null
          status?: string
          tamanho?: string | null
          tipo?: string | null
          updated_at?: string
          valor_pago?: number | null
        }
        Update: {
          ano?: number | null
          bike_atual?: boolean
          cliente_id?: string
          cor?: string | null
          created_at?: string
          data_compra?: string | null
          grupo?: string | null
          id?: string
          marca?: string
          modelo?: string
          numero_serie?: string | null
          observacoes?: string | null
          onde_comprou?: string | null
          rodas?: string | null
          status?: string
          tamanho?: string | null
          tipo?: string | null
          updated_at?: string
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bikes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      bikes_estoque: {
        Row: {
          acessorios: string | null
          ano: number | null
          canote: string | null
          categoria: string | null
          condicao: string | null
          cor: string | null
          created_at: string
          created_by: string | null
          custo_bike: number
          custos_adicionais: number
          data_entrada: string
          fornecedor: string | null
          foto_cambio_frente: string | null
          foto_cambio_traseiro: string | null
          foto_completa: string | null
          foto_freio: string | null
          foto_numero_serie: string | null
          fotos: string[] | null
          freios: string | null
          frete: number
          garantia: string | null
          grupo: string | null
          guidao: string | null
          historico_manutencao: string | null
          id: string
          marca: string
          material_quadro: string | null
          medidor_potencia: string | null
          modelo: string
          modelo_grupo: string | null
          montagem: number
          numero_serie: string | null
          observacoes_tecnicas: string | null
          override_comissao_pct: number | null
          override_icms_pct: number | null
          override_imposto_venda_pct: number | null
          override_markup_pct: number | null
          override_taxa_financeira_pct: number | null
          pedivela: string | null
          peso: number | null
          pneus: string | null
          quilometragem: number | null
          relacao: string | null
          revisao_inicial: number
          rodas: string | null
          seguro: number
          sku: string | null
          status: Database["public"]["Enums"]["bike_estoque_status"]
          suspensao: string | null
          tamanho: string | null
          updated_at: string
          valor_mercado: number | null
          valor_minimo: number | null
          valor_proposto: number | null
          visivel_ecommerce: boolean
        }
        Insert: {
          acessorios?: string | null
          ano?: number | null
          canote?: string | null
          categoria?: string | null
          condicao?: string | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          custo_bike?: number
          custos_adicionais?: number
          data_entrada?: string
          fornecedor?: string | null
          foto_cambio_frente?: string | null
          foto_cambio_traseiro?: string | null
          foto_completa?: string | null
          foto_freio?: string | null
          foto_numero_serie?: string | null
          fotos?: string[] | null
          freios?: string | null
          frete?: number
          garantia?: string | null
          grupo?: string | null
          guidao?: string | null
          historico_manutencao?: string | null
          id?: string
          marca: string
          material_quadro?: string | null
          medidor_potencia?: string | null
          modelo: string
          modelo_grupo?: string | null
          montagem?: number
          numero_serie?: string | null
          observacoes_tecnicas?: string | null
          override_comissao_pct?: number | null
          override_icms_pct?: number | null
          override_imposto_venda_pct?: number | null
          override_markup_pct?: number | null
          override_taxa_financeira_pct?: number | null
          pedivela?: string | null
          peso?: number | null
          pneus?: string | null
          quilometragem?: number | null
          relacao?: string | null
          revisao_inicial?: number
          rodas?: string | null
          seguro?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["bike_estoque_status"]
          suspensao?: string | null
          tamanho?: string | null
          updated_at?: string
          valor_mercado?: number | null
          valor_minimo?: number | null
          valor_proposto?: number | null
          visivel_ecommerce?: boolean
        }
        Update: {
          acessorios?: string | null
          ano?: number | null
          canote?: string | null
          categoria?: string | null
          condicao?: string | null
          cor?: string | null
          created_at?: string
          created_by?: string | null
          custo_bike?: number
          custos_adicionais?: number
          data_entrada?: string
          fornecedor?: string | null
          foto_cambio_frente?: string | null
          foto_cambio_traseiro?: string | null
          foto_completa?: string | null
          foto_freio?: string | null
          foto_numero_serie?: string | null
          fotos?: string[] | null
          freios?: string | null
          frete?: number
          garantia?: string | null
          grupo?: string | null
          guidao?: string | null
          historico_manutencao?: string | null
          id?: string
          marca?: string
          material_quadro?: string | null
          medidor_potencia?: string | null
          modelo?: string
          modelo_grupo?: string | null
          montagem?: number
          numero_serie?: string | null
          observacoes_tecnicas?: string | null
          override_comissao_pct?: number | null
          override_icms_pct?: number | null
          override_imposto_venda_pct?: number | null
          override_markup_pct?: number | null
          override_taxa_financeira_pct?: number | null
          pedivela?: string | null
          peso?: number | null
          pneus?: string | null
          quilometragem?: number | null
          relacao?: string | null
          revisao_inicial?: number
          rodas?: string | null
          seguro?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["bike_estoque_status"]
          suspensao?: string | null
          tamanho?: string | null
          updated_at?: string
          valor_mercado?: number | null
          valor_minimo?: number | null
          valor_proposto?: number | null
          visivel_ecommerce?: boolean
        }
        Relationships: []
      }
      clientes: {
        Row: {
          altura: string | null
          apto: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          equipe: string | null
          estado: string | null
          frequencia: string | null
          id: string
          instagram: string | null
          marca_preferida: string | null
          modalidades: string[] | null
          nivel: string | null
          nome: string
          numero: string | null
          objetivo: string | null
          observacoes: string | null
          origem_lead: string | null
          participa_provas: boolean | null
          sonho_consumo: string | null
          tamanho_bike: string | null
          telefone_secundario: string | null
          updated_at: string
          user_id: string | null
          vendedor_responsavel: string | null
          vip: boolean
          whatsapp: string | null
        }
        Insert: {
          altura?: string | null
          apto?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          equipe?: string | null
          estado?: string | null
          frequencia?: string | null
          id?: string
          instagram?: string | null
          marca_preferida?: string | null
          modalidades?: string[] | null
          nivel?: string | null
          nome: string
          numero?: string | null
          objetivo?: string | null
          observacoes?: string | null
          origem_lead?: string | null
          participa_provas?: boolean | null
          sonho_consumo?: string | null
          tamanho_bike?: string | null
          telefone_secundario?: string | null
          updated_at?: string
          user_id?: string | null
          vendedor_responsavel?: string | null
          vip?: boolean
          whatsapp?: string | null
        }
        Update: {
          altura?: string | null
          apto?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          equipe?: string | null
          estado?: string | null
          frequencia?: string | null
          id?: string
          instagram?: string | null
          marca_preferida?: string | null
          modalidades?: string[] | null
          nivel?: string | null
          nome?: string
          numero?: string | null
          objetivo?: string | null
          observacoes?: string | null
          origem_lead?: string | null
          participa_provas?: boolean | null
          sonho_consumo?: string | null
          tamanho_bike?: string | null
          telefone_secundario?: string | null
          updated_at?: string
          user_id?: string | null
          vendedor_responsavel?: string | null
          vip?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      financial_settings: {
        Row: {
          comissao_pct: number
          icms_pct: number
          id: string
          imposto_venda_pct: number
          markup_pct: number
          taxa_financeira_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          comissao_pct?: number
          icms_pct?: number
          id?: string
          imposto_venda_pct?: number
          markup_pct?: number
          taxa_financeira_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          comissao_pct?: number
          icms_pct?: number
          id?: string
          imposto_venda_pct?: number
          markup_pct?: number
          taxa_financeira_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      historicos: {
        Row: {
          bike_id: string
          created_at: string
          data: string
          descricao: string
          id: string
          km_horimetro: string | null
          numero_os: string | null
          observacoes: string | null
          tipo: string
          valor: number | null
        }
        Insert: {
          bike_id: string
          created_at?: string
          data?: string
          descricao: string
          id?: string
          km_horimetro?: string | null
          numero_os?: string | null
          observacoes?: string | null
          tipo: string
          valor?: number | null
        }
        Update: {
          bike_id?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          km_horimetro?: string | null
          numero_os?: string | null
          observacoes?: string | null
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historicos_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas_bikes: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      marketing_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          image: string | null
          openai_response_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          image?: string | null
          openai_response_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          image?: string | null
          openai_response_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mecanicos: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      ordens_servico: {
        Row: {
          aprovado: boolean | null
          aprovado_por: string | null
          bike_id: string
          checklist_entrada: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          data_aprovacao: string | null
          data_avaliacao: string | null
          data_conclusao: string | null
          data_entrada: string
          data_entrega: string | null
          data_pagamento: string | null
          data_prevista: string | null
          forma_pagamento: string | null
          fotos_servico: string[] | null
          id: string
          mecanico: string | null
          numero: string
          observacao_conclusao: string | null
          observacoes_execucao: string | null
          observacoes_tecnicas: string | null
          pago_por: string | null
          pecas_utilizadas: string | null
          problema_relatado: string | null
          proxima_revisao: string | null
          quem_puxou: string | null
          responsavel_avaliacao: string | null
          responsavel_entrega: string | null
          responsavel_execucao: string | null
          responsavel_recebimento: string | null
          servicos_executados: string | null
          status: string
          updated_at: string
          valor_aprovado: number | null
          valor_mao_obra: number | null
          valor_pecas: number | null
        }
        Insert: {
          aprovado?: boolean | null
          aprovado_por?: string | null
          bike_id: string
          checklist_entrada?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_avaliacao?: string | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          forma_pagamento?: string | null
          fotos_servico?: string[] | null
          id?: string
          mecanico?: string | null
          numero?: string
          observacao_conclusao?: string | null
          observacoes_execucao?: string | null
          observacoes_tecnicas?: string | null
          pago_por?: string | null
          pecas_utilizadas?: string | null
          problema_relatado?: string | null
          proxima_revisao?: string | null
          quem_puxou?: string | null
          responsavel_avaliacao?: string | null
          responsavel_entrega?: string | null
          responsavel_execucao?: string | null
          responsavel_recebimento?: string | null
          servicos_executados?: string | null
          status?: string
          updated_at?: string
          valor_aprovado?: number | null
          valor_mao_obra?: number | null
          valor_pecas?: number | null
        }
        Update: {
          aprovado?: boolean | null
          aprovado_por?: string | null
          bike_id?: string
          checklist_entrada?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_avaliacao?: string | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          forma_pagamento?: string | null
          fotos_servico?: string[] | null
          id?: string
          mecanico?: string | null
          numero?: string
          observacao_conclusao?: string | null
          observacoes_execucao?: string | null
          observacoes_tecnicas?: string | null
          pago_por?: string | null
          pecas_utilizadas?: string | null
          problema_relatado?: string | null
          proxima_revisao?: string | null
          quem_puxou?: string | null
          responsavel_avaliacao?: string | null
          responsavel_entrega?: string | null
          responsavel_execucao?: string | null
          responsavel_recebimento?: string | null
          servicos_executados?: string | null
          status?: string
          updated_at?: string
          valor_aprovado?: number | null
          valor_mao_obra?: number | null
          valor_pecas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencia_votos: {
        Row: {
          coins: number
          created_at: string
          pendencia_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coins: number
          created_at?: string
          pendencia_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          pendencia_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pendencia_votos_pendencia_id_fkey"
            columns: ["pendencia_id"]
            isOneToOne: false
            referencedRelation: "pendencias"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencias: {
        Row: {
          atividade: string
          concluida: boolean
          created_at: string
          created_by: string
          data_prevista: string | null
          id: string
          privado: boolean
          responsavel_id: string | null
          tipo_atividade: string | null
          updated_at: string
        }
        Insert: {
          atividade: string
          concluida?: boolean
          created_at?: string
          created_by: string
          data_prevista?: string | null
          id?: string
          privado?: boolean
          responsavel_id?: string | null
          tipo_atividade?: string | null
          updated_at?: string
        }
        Update: {
          atividade?: string
          concluida?: boolean
          created_at?: string
          created_by?: string
          data_prevista?: string | null
          id?: string
          privado?: boolean
          responsavel_id?: string | null
          tipo_atividade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pendencias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_categorias: {
        Row: {
          id: string
          nome: string
          slug: string
          ativo: boolean
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          slug: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          slug?: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          id: string
          nome: string
          nome_fantasia: string | null
          cnpj: string | null
          contato: string | null
          telefone: string | null
          email: string | null
          cidade: string | null
          estado: string | null
          observacoes: string | null
          ativo: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          nome_fantasia?: string | null
          cnpj?: string | null
          contato?: string | null
          telefone?: string | null
          email?: string | null
          cidade?: string | null
          estado?: string | null
          observacoes?: string | null
          ativo?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          nome_fantasia?: string | null
          cnpj?: string | null
          contato?: string | null
          telefone?: string | null
          email?: string | null
          cidade?: string | null
          estado?: string | null
          observacoes?: string | null
          ativo?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          id: string
          fornecedor_id: string
          data_compra: string
          forma_pagamento: string
          valor_total: number
          numero_nf: string | null
          observacoes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fornecedor_id: string
          data_compra?: string
          forma_pagamento: string
          valor_total?: number
          numero_nf?: string | null
          observacoes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          fornecedor_id?: string
          data_compra?: string
          forma_pagamento?: string
          valor_total?: number
          numero_nf?: string | null
          observacoes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_itens: {
        Row: {
          id: string
          compra_id: string
          descricao: string
          quantidade: number
          valor: number
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          compra_id: string
          descricao: string
          quantidade?: number
          valor?: number
          ordem?: number
          created_at?: string
        }
        Update: {
          id?: string
          compra_id?: string
          descricao?: string
          quantidade?: number
          valor?: number
          ordem?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compra_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_parcelas: {
        Row: {
          id: string
          compra_id: string
          numero: number
          valor: number
          data_vencimento: string
          status: string
          data_pagamento: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          compra_id: string
          numero: number
          valor: number
          data_vencimento: string
          status?: string
          data_pagamento?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          compra_id?: string
          numero?: number
          valor?: number
          data_vencimento?: string
          status?: string
          data_pagamento?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compra_parcelas_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
        ]
      }
      despesa_categorias: {
        Row: {
          id: string
          nome: string
          slug: string
          ativo: boolean
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          slug: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          slug?: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Relationships: []
      }
      despesa_recorrentes: {
        Row: {
          id: string
          descricao: string
          categoria_id: string | null
          dia_vencimento: number
          valor_estimado: number | null
          forma_pagamento: string | null
          ativo: boolean
          observacoes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          descricao: string
          categoria_id?: string | null
          dia_vencimento: number
          valor_estimado?: number | null
          forma_pagamento?: string | null
          ativo?: boolean
          observacoes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          descricao?: string
          categoria_id?: string | null
          dia_vencimento?: number
          valor_estimado?: number | null
          forma_pagamento?: string | null
          ativo?: boolean
          observacoes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesa_recorrentes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "despesa_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          id: string
          descricao: string
          categoria_id: string | null
          recorrente_id: string | null
          data_vencimento: string
          competencia: string
          valor: number
          forma_pagamento: string | null
          status: string
          data_pagamento: string | null
          observacoes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          descricao: string
          categoria_id?: string | null
          recorrente_id?: string | null
          data_vencimento: string
          competencia: string
          valor?: number
          forma_pagamento?: string | null
          status?: string
          data_pagamento?: string | null
          observacoes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          descricao?: string
          categoria_id?: string | null
          recorrente_id?: string | null
          data_vencimento?: string
          competencia?: string
          valor?: number
          forma_pagamento?: string | null
          status?: string
          data_pagamento?: string | null
          observacoes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "despesa_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_recorrente_id_fkey"
            columns: ["recorrente_id"]
            isOneToOne: false
            referencedRelation: "despesa_recorrentes"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_categorias: {
        Row: {
          id: string
          nome: string
          slug: string
          ativo: boolean
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          slug: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          slug?: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Relationships: []
      }
      produto_marcas: {
        Row: {
          id: string
          nome: string
          slug: string
          ativo: boolean
          ordem: number
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          slug: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          slug?: string
          ativo?: boolean
          ordem?: number
          created_at?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          categoria_id: string | null
          codigo_barras: string | null
          created_at: string
          created_by: string | null
          custo: number
          descricao: string | null
          estoque_atual: number
          estoque_minimo: number
          fornecedor: string | null
          fotos: string[] | null
          id: string
          marca: string | null
          marca_id: string | null
          modelo: string | null
          nome: string
          observacoes: string | null
          preco_venda: number
          sku: string | null
          unidade: string | null
          updated_at: string
          valor_minimo: number | null
          visivel_ecommerce: boolean
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string
          created_by?: string | null
          custo?: number
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          fornecedor?: string | null
          fotos?: string[] | null
          id?: string
          marca?: string | null
          marca_id?: string | null
          modelo?: string | null
          nome: string
          observacoes?: string | null
          preco_venda?: number
          sku?: string | null
          unidade?: string | null
          updated_at?: string
          valor_minimo?: number | null
          visivel_ecommerce?: boolean
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string
          created_by?: string | null
          custo?: number
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          fornecedor?: string | null
          fotos?: string[] | null
          id?: string
          marca?: string | null
          marca_id?: string | null
          modelo?: string | null
          nome?: string
          observacoes?: string | null
          preco_venda?: number
          sku?: string | null
          unidade?: string | null
          updated_at?: string
          valor_minimo?: number | null
          visivel_ecommerce?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "produto_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "produto_marcas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      servicos_precos: {
        Row: {
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          valor: number
        }
        Insert: {
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          valor?: number
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      sync_clientes_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: number
          operation: string
          payload: Json | null
          record_id: string | null
          request_id: number | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: number
          operation: string
          payload?: Json | null
          record_id?: string | null
          request_id?: number | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: number
          operation?: string
          payload?: Json | null
          record_id?: string | null
          request_id?: number | null
          status_code?: number | null
        }
        Relationships: []
      }
      tipo_atividade: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_novo_cliente_log: {
        Row: {
          cliente_id: string | null
          created_at: string
          error_message: string | null
          id: number
          payload: Json | null
          request_id: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          payload?: Json | null
          request_id?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          payload?: Json | null
          request_id?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: {
        Args: {
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "vendedor" | "tecnico" | "cliente"
      bike_estoque_status:
        | "em_estoque"
        | "reservada"
        | "vendida"
        | "em_montagem"
        | "em_transito"
        | "consignada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendedor", "tecnico"],
      bike_estoque_status: [
        "em_estoque",
        "reservada",
        "vendida",
        "em_montagem",
        "em_transito",
        "consignada",
      ],
    },
  },
} as const
