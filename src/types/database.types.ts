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
      asset_residual_history: {
        Row: {
          amortization_pct: number
          asset_id: string
          created_at: string
          event_date: string
          id: string
          new_factor: number
          notes: string | null
          payment_per_vn: number
          previous_factor: number
          settlement_currency: Database["public"]["Enums"]["currency"]
          source: string
        }
        Insert: {
          amortization_pct: number
          asset_id: string
          created_at?: string
          event_date: string
          id?: string
          new_factor: number
          notes?: string | null
          payment_per_vn: number
          previous_factor: number
          settlement_currency: Database["public"]["Enums"]["currency"]
          source?: string
        }
        Update: {
          amortization_pct?: number
          asset_id?: string
          created_at?: string
          event_date?: string
          id?: string
          new_factor?: number
          notes?: string | null
          payment_per_vn?: number
          previous_factor?: number
          settlement_currency?: Database["public"]["Enums"]["currency"]
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_residual_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_residual_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["asset_id"]
          },
        ]
      }
      assets: {
        Row: {
          amortization_schedule: Json
          asset_type: Database["public"]["Enums"]["asset_type"]
          blockchain_network: string | null
          cedear_ratio: number | null
          coingecko_id: string | null
          coupon_frequency: number | null
          coupon_rate: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          current_residual_factor: number
          data_source: string
          day_count_convention: string | null
          face_value: number | null
          fci_benchmark: string | null
          fci_cafci_id: number | null
          fci_management_company: string | null
          id: string
          is_active: boolean
          is_stablecoin: boolean
          isin: string | null
          maturity_date: string | null
          name: string
          residual_factor_updated_at: string | null
          settlement_currency: Database["public"]["Enums"]["currency"] | null
          ticker: string
          token_contract_address: string | null
          underlying_asset_id: string | null
          underlying_ticker: string | null
          updated_at: string
        }
        Insert: {
          amortization_schedule?: Json
          asset_type: Database["public"]["Enums"]["asset_type"]
          blockchain_network?: string | null
          cedear_ratio?: number | null
          coingecko_id?: string | null
          coupon_frequency?: number | null
          coupon_rate?: number | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          current_residual_factor?: number
          data_source?: string
          day_count_convention?: string | null
          face_value?: number | null
          fci_benchmark?: string | null
          fci_cafci_id?: number | null
          fci_management_company?: string | null
          id?: string
          is_active?: boolean
          is_stablecoin?: boolean
          isin?: string | null
          maturity_date?: string | null
          name: string
          residual_factor_updated_at?: string | null
          settlement_currency?: Database["public"]["Enums"]["currency"] | null
          ticker: string
          token_contract_address?: string | null
          underlying_asset_id?: string | null
          underlying_ticker?: string | null
          updated_at?: string
        }
        Update: {
          amortization_schedule?: Json
          asset_type?: Database["public"]["Enums"]["asset_type"]
          blockchain_network?: string | null
          cedear_ratio?: number | null
          coingecko_id?: string | null
          coupon_frequency?: number | null
          coupon_rate?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          current_residual_factor?: number
          data_source?: string
          day_count_convention?: string | null
          face_value?: number | null
          fci_benchmark?: string | null
          fci_cafci_id?: number | null
          fci_management_company?: string | null
          id?: string
          is_active?: boolean
          is_stablecoin?: boolean
          isin?: string | null
          maturity_date?: string | null
          name?: string
          residual_factor_updated_at?: string | null
          settlement_currency?: Database["public"]["Enums"]["currency"] | null
          ticker?: string
          token_contract_address?: string | null
          underlying_asset_id?: string | null
          underlying_ticker?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_underlying_asset_id_fkey"
            columns: ["underlying_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_underlying_asset_id_fkey"
            columns: ["underlying_asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["asset_id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          cuit: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          onboarding_date: string
          phone: string | null
          risk_profile: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cuit?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          onboarding_date?: string
          phone?: string | null
          risk_profile?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cuit?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          onboarding_date?: string
          phone?: string | null
          risk_profile?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      commission_agreements: {
        Row: {
          client_id: string
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          effective_from: string
          effective_to: string | null
          fixed_amount: number | null
          fixed_currency: Database["public"]["Enums"]["currency"] | null
          high_water_mark: number
          hwm_currency: Database["public"]["Enums"]["currency"]
          id: string
          notes: string | null
          rate: number | null
        }
        Insert: {
          client_id: string
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          effective_from: string
          effective_to?: string | null
          fixed_amount?: number | null
          fixed_currency?: Database["public"]["Enums"]["currency"] | null
          high_water_mark?: number
          hwm_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          notes?: string | null
          rate?: number | null
        }
        Update: {
          client_id?: string
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          effective_from?: string
          effective_to?: string | null
          fixed_amount?: number | null
          fixed_currency?: Database["public"]["Enums"]["currency"] | null
          high_water_mark?: number
          hwm_currency?: Database["public"]["Enums"]["currency"]
          id?: string
          notes?: string | null
          rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_aum_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commission_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["client_id"]
          },
        ]
      }
      commission_records: {
        Row: {
          agreement_id: string
          aum_at_calculation: number | null
          client_id: string
          collected_at: string | null
          collection_notes: string | null
          commission_amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          fx_rate_used: number | null
          gain_in_period: number | null
          id: string
          invoiced_at: string | null
          period_from: string
          period_to: string
          portfolio_id: string | null
          status: Database["public"]["Enums"]["commission_status"]
        }
        Insert: {
          agreement_id: string
          aum_at_calculation?: number | null
          client_id: string
          collected_at?: string | null
          collection_notes?: string | null
          commission_amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          fx_rate_used?: number | null
          gain_in_period?: number | null
          id?: string
          invoiced_at?: string | null
          period_from: string
          period_to: string
          portfolio_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
        }
        Update: {
          agreement_id?: string
          aum_at_calculation?: number | null
          client_id?: string
          collected_at?: string | null
          collection_notes?: string | null
          commission_amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          fx_rate_used?: number | null
          gain_in_period?: number | null
          id?: string
          invoiced_at?: string | null
          period_from?: string
          period_to?: string
          portfolio_id?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "commission_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_aum_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commission_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commission_records_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "commission_records_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          ccl_ticker_ars: string
          ccl_ticker_usd: string
          created_at: string
          id: string
          mep_ticker_ars: string
          mep_ticker_usd: string
          rate_blue: number | null
          rate_ccl: number | null
          rate_date: string
          rate_mep: number | null
          rate_oficial: number | null
          rate_time: string | null
          source: string
        }
        Insert: {
          ccl_ticker_ars?: string
          ccl_ticker_usd?: string
          created_at?: string
          id?: string
          mep_ticker_ars?: string
          mep_ticker_usd?: string
          rate_blue?: number | null
          rate_ccl?: number | null
          rate_date: string
          rate_mep?: number | null
          rate_oficial?: number | null
          rate_time?: string | null
          source: string
        }
        Update: {
          ccl_ticker_ars?: string
          ccl_ticker_usd?: string
          created_at?: string
          id?: string
          mep_ticker_ars?: string
          mep_ticker_usd?: string
          rate_blue?: number | null
          rate_ccl?: number | null
          rate_date?: string
          rate_mep?: number | null
          rate_oficial?: number | null
          rate_time?: string | null
          source?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          account_identifier: string | null
          base_currency: Database["public"]["Enums"]["currency"]
          blockchain_network: string | null
          client_id: string
          created_at: string
          custodian_name: string
          custodian_type: string
          description: string | null
          id: string
          inception_date: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          account_identifier?: string | null
          base_currency?: Database["public"]["Enums"]["currency"]
          blockchain_network?: string | null
          client_id: string
          created_at?: string
          custodian_name: string
          custodian_type: string
          description?: string | null
          id?: string
          inception_date?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          account_identifier?: string | null
          base_currency?: Database["public"]["Enums"]["currency"]
          blockchain_network?: string | null
          client_id?: string
          created_at?: string
          custodian_name?: string
          custodian_type?: string
          description?: string | null
          id?: string
          inception_date?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_aum_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "portfolios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["client_id"]
          },
        ]
      }
      positions: {
        Row: {
          asset_id: string
          average_cost_price_ars: number
          average_cost_price_usd: number
          avg_fx_mep_at_cost: number | null
          first_purchase_date: string | null
          id: string
          last_transaction_date: string | null
          last_updated: string
          portfolio_id: string
          quantity_held: number
          realized_gain_loss_ars: number
          realized_gain_loss_usd: number
          total_cost_basis_ars: number
          total_cost_basis_usd: number
          total_income_received_ars: number
          total_income_received_usd: number
        }
        Insert: {
          asset_id: string
          average_cost_price_ars?: number
          average_cost_price_usd?: number
          avg_fx_mep_at_cost?: number | null
          first_purchase_date?: string | null
          id?: string
          last_transaction_date?: string | null
          last_updated?: string
          portfolio_id: string
          quantity_held?: number
          realized_gain_loss_ars?: number
          realized_gain_loss_usd?: number
          total_cost_basis_ars?: number
          total_cost_basis_usd?: number
          total_income_received_ars?: number
          total_income_received_usd?: number
        }
        Update: {
          asset_id?: string
          average_cost_price_ars?: number
          average_cost_price_usd?: number
          avg_fx_mep_at_cost?: number | null
          first_purchase_date?: string | null
          id?: string
          last_transaction_date?: string | null
          last_updated?: string
          portfolio_id?: string
          quantity_held?: number
          realized_gain_loss_ars?: number
          realized_gain_loss_usd?: number
          total_cost_basis_ars?: number
          total_cost_basis_usd?: number
          total_income_received_ars?: number
          total_income_received_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "positions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "positions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "positions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      price_quotes: {
        Row: {
          asset_id: string
          created_at: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          is_closing: boolean
          market_cap: number | null
          price: number
          price_ask: number | null
          price_bid: number | null
          price_high: number | null
          price_low: number | null
          price_open: number | null
          quote_date: string
          quote_time: string | null
          source: string
          volume_24h: number | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          is_closing?: boolean
          market_cap?: number | null
          price: number
          price_ask?: number | null
          price_bid?: number | null
          price_high?: number | null
          price_low?: number | null
          price_open?: number | null
          quote_date: string
          quote_time?: string | null
          source: string
          volume_24h?: number | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          is_closing?: boolean
          market_cap?: number | null
          price?: number
          price_ask?: number | null
          price_bid?: number | null
          price_high?: number | null
          price_low?: number | null
          price_open?: number | null
          quote_date?: string
          quote_time?: string | null
          source?: string
          volume_24h?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_quotes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_quotes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["asset_id"]
          },
        ]
      }
      transactions: {
        Row: {
          alyce_commission: number
          asset_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancels_transaction_id: string | null
          created_at: string
          crypto_price_usd: number | null
          currency: Database["public"]["Enums"]["currency"]
          fx_rate_ccl: number | null
          fx_rate_mep: number | null
          fx_rate_oficial: number | null
          gas_fee_amount: number
          gas_fee_currency: Database["public"]["Enums"]["currency"] | null
          gross_amount: number
          id: string
          is_cancelled: boolean
          net_amount: number
          notes: string | null
          other_fees: number
          pool_address: string | null
          portfolio_id: string
          price_per_unit: number
          protocol_name: string | null
          quantity: number
          residual_factor_at_trade: number
          settlement_date: string | null
          swap_to_asset_id: string | null
          swap_to_price_usd: number | null
          swap_to_quantity: number | null
          trade_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          tx_hash: string | null
        }
        Insert: {
          alyce_commission?: number
          asset_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancels_transaction_id?: string | null
          created_at?: string
          crypto_price_usd?: number | null
          currency: Database["public"]["Enums"]["currency"]
          fx_rate_ccl?: number | null
          fx_rate_mep?: number | null
          fx_rate_oficial?: number | null
          gas_fee_amount?: number
          gas_fee_currency?: Database["public"]["Enums"]["currency"] | null
          gross_amount: number
          id?: string
          is_cancelled?: boolean
          net_amount: number
          notes?: string | null
          other_fees?: number
          pool_address?: string | null
          portfolio_id: string
          price_per_unit: number
          protocol_name?: string | null
          quantity: number
          residual_factor_at_trade?: number
          settlement_date?: string | null
          swap_to_asset_id?: string | null
          swap_to_price_usd?: number | null
          swap_to_quantity?: number | null
          trade_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          tx_hash?: string | null
        }
        Update: {
          alyce_commission?: number
          asset_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancels_transaction_id?: string | null
          created_at?: string
          crypto_price_usd?: number | null
          currency?: Database["public"]["Enums"]["currency"]
          fx_rate_ccl?: number | null
          fx_rate_mep?: number | null
          fx_rate_oficial?: number | null
          gas_fee_amount?: number
          gas_fee_currency?: Database["public"]["Enums"]["currency"] | null
          gross_amount?: number
          id?: string
          is_cancelled?: boolean
          net_amount?: number
          notes?: string | null
          other_fees?: number
          pool_address?: string | null
          portfolio_id?: string
          price_per_unit?: number
          protocol_name?: string | null
          quantity?: number
          residual_factor_at_trade?: number
          settlement_date?: string | null
          swap_to_asset_id?: string | null
          swap_to_price_usd?: number | null
          swap_to_quantity?: number | null
          trade_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "transactions_cancels_transaction_id_fkey"
            columns: ["cancels_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["portfolio_id"]
          },
          {
            foreignKeyName: "transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_swap_to_asset_id_fkey"
            columns: ["swap_to_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_swap_to_asset_id_fkey"
            columns: ["swap_to_asset_id"]
            isOneToOne: false
            referencedRelation: "portfolio_valuation_unified"
            referencedColumns: ["asset_id"]
          },
        ]
      }
    }
    Views: {
      client_aum_summary: {
        Row: {
          client_id: string | null
          client_name: string | null
          portfolio_count: number | null
          total_aum_ars: number | null
          total_aum_usd: number | null
          total_return_ars: number | null
          total_return_usd: number | null
          total_unrealized_pnl_ars: number | null
          total_unrealized_pnl_usd: number | null
        }
        Relationships: []
      }
      portfolio_valuation_unified: {
        Row: {
          asset_currency: Database["public"]["Enums"]["currency"] | null
          asset_id: string | null
          asset_name: string | null
          asset_type: Database["public"]["Enums"]["asset_type"] | null
          avg_fx_mep_at_cost: number | null
          blockchain_network: string | null
          client_id: string | null
          client_name: string | null
          current_price: number | null
          current_residual_factor: number | null
          custodian_name: string | null
          custodian_type: string | null
          first_purchase_date: string | null
          fx_ccl_today: number | null
          fx_date: string | null
          fx_gain_loss_ars: number | null
          fx_mep_today: number | null
          is_stablecoin: boolean | null
          last_transaction_date: string | null
          market_value_ars: number | null
          market_value_usd: number | null
          portfolio_id: string | null
          portfolio_name: string | null
          ppp_ars: number | null
          ppp_usd: number | null
          price_date: string | null
          price_gain_loss_ars: number | null
          price_source: string | null
          quantity_effective: number | null
          quantity_held: number | null
          realized_gain_loss_ars: number | null
          realized_gain_loss_usd: number | null
          settlement_currency: Database["public"]["Enums"]["currency"] | null
          ticker: string | null
          total_cost_basis_ars: number | null
          total_cost_basis_usd: number | null
          total_income_received_ars: number | null
          total_income_received_usd: number | null
          total_return_ars: number | null
          total_return_usd: number | null
          unrealized_pnl_ars: number | null
          unrealized_pnl_ars_pct: number | null
          unrealized_pnl_usd: number | null
          break_even_price_ars: number | null
          break_even_price_usd: number | null
          spread_vs_breakeven_ars: number | null
          spread_vs_breakeven_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      recalculate_position: {
        Args: { p_asset_id: string; p_portfolio_id: string }
        Returns: undefined
      }
    }
    Enums: {
      asset_type:
        | "ACCION_LOCAL"
        | "CEDEAR"
        | "BONO_SOBERANO"
        | "BONO_SUBSOBERANO"
        | "ON"
        | "LETES"
        | "LECAP"
        | "FCI_MONEY_MARKET"
        | "FCI_RENTA_FIJA"
        | "FCI_RENTA_VARIABLE"
        | "FCI_RENTA_MIXTA"
        | "CRYPTO_SPOT"
        | "CRYPTO_STABLECOIN"
        | "CRYPTO_EARN"
        | "CRYPTO_DEFI_LP"
        | "CRYPTO_DEFI_STAKE"
        | "CRYPTO_DEFI_LENDING"
        | "CASH_ARS"
        | "CASH_USD_MEP"
        | "CASH_USD_CCL"
        | "CASH_CRYPTO_STABLE"
        | "CASH_CRYPTO_NATIVE"
      commission_status: "DEVENGADA" | "COBRADA" | "ANULADA"
      commission_type:
        | "PORCENTAJE_AUM"
        | "PORCENTAJE_GANANCIA"
        | "FEE_FIJO_MENSUAL"
        | "FEE_POR_OPERACION"
      currency:
        | "ARS"
        | "USD_MEP"
        | "USD_CCL"
        | "USD_CABLE"
        | "USD_OFICIAL"
        | "USD_BLUE"
        | "BTC"
        | "ETH"
        | "SOL"
        | "USDT"
        | "USDC"
        | "DAI"
        | "MATIC"
        | "BNB"
        | "ADA"
        | "CRYPTO_OTHER"
      transaction_type:
        | "COMPRA"
        | "VENTA"
        | "SUSCRIPCION_FCI"
        | "RESCATE_FCI"
        | "DIVIDENDO"
        | "RENTA"
        | "AMORTIZACION"
        | "CANJE"
        | "SPLIT_ACCION"
        | "INTERES_EARN"
        | "SWAP_CRYPTO"
        | "DEPOSITO"
        | "RETIRO"
        | "BRIDGE_IN"
        | "BRIDGE_OUT"
        | "REWARD_DEFI"
        | "TRANSFERENCIA_IN"
        | "TRANSFERENCIA_OUT"
        | "FEE_CADENA"
        | "FEE_EXCHANGE"
        | "COMISION_ALYCE"
        | "AJUSTE_PRECIO"
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
      asset_type: [
        "ACCION_LOCAL",
        "CEDEAR",
        "BONO_SOBERANO",
        "BONO_SUBSOBERANO",
        "ON",
        "LETES",
        "LECAP",
        "FCI_MONEY_MARKET",
        "FCI_RENTA_FIJA",
        "FCI_RENTA_VARIABLE",
        "FCI_RENTA_MIXTA",
        "CRYPTO_SPOT",
        "CRYPTO_STABLECOIN",
        "CRYPTO_EARN",
        "CRYPTO_DEFI_LP",
        "CRYPTO_DEFI_STAKE",
        "CRYPTO_DEFI_LENDING",
        "CASH_ARS",
        "CASH_USD_MEP",
        "CASH_USD_CCL",
        "CASH_CRYPTO_STABLE",
        "CASH_CRYPTO_NATIVE",
      ],
      commission_status: ["DEVENGADA", "COBRADA", "ANULADA"],
      commission_type: [
        "PORCENTAJE_AUM",
        "PORCENTAJE_GANANCIA",
        "FEE_FIJO_MENSUAL",
        "FEE_POR_OPERACION",
      ],
      currency: [
        "ARS",
        "USD_MEP",
        "USD_CCL",
        "USD_CABLE",
        "USD_OFICIAL",
        "USD_BLUE",
        "BTC",
        "ETH",
        "SOL",
        "USDT",
        "USDC",
        "DAI",
        "MATIC",
        "BNB",
        "ADA",
        "CRYPTO_OTHER",
      ],
      transaction_type: [
        "COMPRA",
        "VENTA",
        "SUSCRIPCION_FCI",
        "RESCATE_FCI",
        "DIVIDENDO",
        "RENTA",
        "AMORTIZACION",
        "CANJE",
        "SPLIT_ACCION",
        "INTERES_EARN",
        "SWAP_CRYPTO",
        "DEPOSITO",
        "RETIRO",
        "BRIDGE_IN",
        "BRIDGE_OUT",
        "REWARD_DEFI",
        "TRANSFERENCIA_IN",
        "TRANSFERENCIA_OUT",
        "FEE_CADENA",
        "FEE_EXCHANGE",
        "COMISION_ALYCE",
        "AJUSTE_PRECIO",
      ],
    },
  },
} as const
