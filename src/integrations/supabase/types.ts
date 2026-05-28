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
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          company_id: string
          created_at: string
          currency_code: string | null
          id: string
          is_active: boolean
          is_group: boolean
          is_reconcilable: boolean
          name_ar: string
          name_en: string
          notes: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          company_id: string
          created_at?: string
          currency_code?: string | null
          id?: string
          is_active?: boolean
          is_group?: boolean
          is_reconcilable?: boolean
          name_ar: string
          name_en: string
          notes?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          company_id?: string
          created_at?: string
          currency_code?: string | null
          id?: string
          is_active?: boolean
          is_group?: boolean
          is_reconcilable?: boolean
          name_ar?: string
          name_en?: string
          notes?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          bank_name: string
          branch_id: string | null
          code: string
          company_id: string
          created_at: string
          currency_code: string
          gl_account_id: string | null
          iban: string | null
          id: string
          is_active: boolean
          journal_id: string | null
          name_ar: string
          name_en: string
          swift_code: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name: string
          branch_id?: string | null
          code: string
          company_id: string
          created_at?: string
          currency_code?: string
          gl_account_id?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean
          journal_id?: string | null
          name_ar: string
          name_en: string
          swift_code?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string
          branch_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          currency_code?: string
          gl_account_id?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean
          journal_id?: string | null
          name_ar?: string
          name_en?: string
          swift_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address_ar: string | null
          address_en: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_main: boolean
          name_ar: string
          name_en: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_main?: boolean
          name_ar: string
          name_en: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_main?: boolean
          name_ar?: string
          name_en?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_ar: string | null
          address_en: string | null
          code: string
          cr_number: string | null
          created_at: string
          default_currency: string
          email: string | null
          fiscal_year_start_month: number
          id: string
          is_active: boolean
          logo_url: string | null
          name_ar: string
          name_en: string
          phone: string | null
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          code: string
          cr_number?: string | null
          created_at?: string
          default_currency?: string
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar: string
          name_en: string
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          code?: string
          cr_number?: string | null
          created_at?: string
          default_currency?: string
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name_ar?: string
          name_en?: string
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_group: boolean
          name_ar: string
          name_en: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_group?: boolean
          name_ar: string
          name_en: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_group?: boolean
          name_ar?: string
          name_en?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number
          is_active: boolean
          name_ar: string
          name_en: string
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number
          is_active?: boolean
          name_ar: string
          name_en: string
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number
          is_active?: boolean
          name_ar?: string
          name_en?: string
          symbol?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          company_id: string
          created_at: string
          currency_code: string
          id: string
          rate: number
          rate_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency_code: string
          id?: string
          rate: number
          rate_date: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency_code?: string
          id?: string
          rate?: number
          rate_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rates_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      fiscal_periods: {
        Row: {
          company_id: string
          created_at: string
          date_from: string
          date_to: string
          id: string
          name: string
          status: Database["public"]["Enums"]["fiscal_period_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date_from: string
          date_to: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["fiscal_period_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date_from?: string
          date_to?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["fiscal_period_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          branch_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency_code: string
          description: string | null
          entry_date: string
          entry_number: string
          id: string
          journal_id: string
          period_id: string | null
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["je_status"]
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          description?: string | null
          entry_date: string
          entry_number: string
          id?: string
          journal_id: string
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["je_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          description?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          journal_id?: string
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["je_status"]
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journal_entries_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          cost_center_id: string | null
          created_at: string
          credit: number
          currency_code: string | null
          debit: number
          description: string | null
          entry_id: string
          fx_rate: number | null
          id: string
          line_number: number
          partner_id: string | null
          reconciled: boolean
          tax_id: string | null
        }
        Insert: {
          account_id: string
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          currency_code?: string | null
          debit?: number
          description?: string | null
          entry_id: string
          fx_rate?: number | null
          id?: string
          line_number: number
          partner_id?: string | null
          reconciled?: boolean
          tax_id?: string | null
        }
        Update: {
          account_id?: string
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          currency_code?: string | null
          debit?: number
          description?: string | null
          entry_id?: string
          fx_rate?: number | null
          id?: string
          line_number?: number
          partner_id?: string | null
          reconciled?: boolean
          tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journal_entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          code: string
          company_id: string
          created_at: string
          currency_code: string | null
          default_credit_account_id: string | null
          default_debit_account_id: string | null
          id: string
          is_active: boolean
          journal_type: Database["public"]["Enums"]["journal_type"]
          name_ar: string
          name_en: string
          sequence_next: number
          sequence_prefix: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          currency_code?: string | null
          default_credit_account_id?: string | null
          default_debit_account_id?: string | null
          id?: string
          is_active?: boolean
          journal_type: Database["public"]["Enums"]["journal_type"]
          name_ar: string
          name_en: string
          sequence_next?: number
          sequence_prefix?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          currency_code?: string | null
          default_credit_account_id?: string | null
          default_debit_account_id?: string | null
          id?: string
          is_active?: boolean
          journal_type?: Database["public"]["Enums"]["journal_type"]
          name_ar?: string
          name_en?: string
          sequence_next?: number
          sequence_prefix?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journals_default_credit_account_id_fkey"
            columns: ["default_credit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_default_debit_account_id_fkey"
            columns: ["default_debit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address_ar: string | null
          address_en: string | null
          city: string | null
          code: string
          company_id: string
          country: string | null
          cr_number: string | null
          created_at: string
          credit_limit: number | null
          currency_code: string | null
          default_purchase_tax_id: string | null
          default_sale_tax_id: string | null
          email: string | null
          id: string
          is_active: boolean
          is_customer: boolean
          is_vendor: boolean
          name_ar: string
          name_en: string
          notes: string | null
          payable_account_id: string | null
          payment_term_id: string | null
          phone: string | null
          receivable_account_id: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string | null
          cr_number?: string | null
          created_at?: string
          credit_limit?: number | null
          currency_code?: string | null
          default_purchase_tax_id?: string | null
          default_sale_tax_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_customer?: boolean
          is_vendor?: boolean
          name_ar: string
          name_en: string
          notes?: string | null
          payable_account_id?: string | null
          payment_term_id?: string | null
          phone?: string | null
          receivable_account_id?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string | null
          cr_number?: string | null
          created_at?: string
          credit_limit?: number | null
          currency_code?: string | null
          default_purchase_tax_id?: string | null
          default_sale_tax_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_customer?: boolean
          is_vendor?: boolean
          name_ar?: string
          name_en?: string
          notes?: string | null
          payable_account_id?: string | null
          payment_term_id?: string | null
          phone?: string | null
          receivable_account_id?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "partners_default_purchase_tax_id_fkey"
            columns: ["default_purchase_tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_default_sale_tax_id_fkey"
            columns: ["default_sale_tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_payable_account_id_fkey"
            columns: ["payable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_receivable_account_id_fkey"
            columns: ["receivable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          bank_account_id: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_inbound: boolean
          is_outbound: boolean
          method_type: Database["public"]["Enums"]["payment_method_type"]
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_inbound?: boolean
          is_outbound?: boolean
          method_type: Database["public"]["Enums"]["payment_method_type"]
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_inbound?: boolean
          is_outbound?: boolean
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          company_id: string
          created_at: string
          days: number
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_branch_id: string | null
          default_company_id: string | null
          display_name_ar: string | null
          display_name_en: string | null
          email: string
          id: string
          is_active: boolean
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_branch_id?: string | null
          default_company_id?: string | null
          display_name_ar?: string | null
          display_name_en?: string | null
          email: string
          id: string
          is_active?: boolean
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_branch_id?: string | null
          default_company_id?: string | null
          display_name_ar?: string | null
          display_name_en?: string | null
          email?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      taxes: {
        Row: {
          account_id: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          rate: number
          tax_type: Database["public"]["Enums"]["tax_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          rate?: number
          tax_type: Database["public"]["Enums"]["tax_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          rate?: number
          tax_type?: Database["public"]["Enums"]["tax_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branch_access: {
        Row: {
          branch_id: string
          granted_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          granted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          granted_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_branch_access: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      app_role:
        | "admin"
        | "finance_manager"
        | "accounting_manager"
        | "chief_accountant"
        | "accountant"
        | "internal_auditor"
      fiscal_period_status: "open" | "closed" | "locked"
      je_status: "draft" | "posted" | "cancelled"
      journal_type: "sales" | "purchase" | "bank" | "cash" | "misc"
      payment_method_type: "cash" | "bank_transfer" | "check" | "card" | "other"
      tax_type: "sale" | "purchase"
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      app_role: [
        "admin",
        "finance_manager",
        "accounting_manager",
        "chief_accountant",
        "accountant",
        "internal_auditor",
      ],
      fiscal_period_status: ["open", "closed", "locked"],
      je_status: ["draft", "posted", "cancelled"],
      journal_type: ["sales", "purchase", "bank", "cash", "misc"],
      payment_method_type: ["cash", "bank_transfer", "check", "card", "other"],
      tax_type: ["sale", "purchase"],
    },
  },
} as const
