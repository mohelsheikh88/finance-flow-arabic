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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_types: {
        Row: {
          classification: string
          classification_id: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_group: boolean
          name_ar: string
          name_en: string
          notes: string | null
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          classification: string
          classification_id?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_group?: boolean
          name_ar: string
          name_en: string
          notes?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          classification?: string
          classification_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_group?: boolean
          name_ar?: string
          name_en?: string
          notes?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_types_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "classifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_types_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "account_types"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_buckets: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          normal_balance: string
          notes: string | null
          sort_order: number
          statement: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          normal_balance?: string
          notes?: string | null
          sort_order?: number
          statement?: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          normal_balance?: string
          notes?: string | null
          sort_order?: number
          statement?: string
          updated_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_type: string
          account_type_id: string | null
          classification_id: string | null
          code: string
          company_id: string
          created_at: string
          currency_code: string | null
          id: string
          is_active: boolean
          is_group: boolean
          is_payable: boolean
          is_receivable: boolean
          is_reconcilable: boolean
          name_ar: string
          name_en: string
          notes: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: string
          account_type_id?: string | null
          classification_id?: string | null
          code: string
          company_id: string
          created_at?: string
          currency_code?: string | null
          id?: string
          is_active?: boolean
          is_group?: boolean
          is_payable?: boolean
          is_receivable?: boolean
          is_reconcilable?: boolean
          name_ar: string
          name_en: string
          notes?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          account_type_id?: string | null
          classification_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          currency_code?: string | null
          id?: string
          is_active?: boolean
          is_group?: boolean
          is_payable?: boolean
          is_receivable?: boolean
          is_reconcilable?: boolean
          name_ar?: string
          name_en?: string
          notes?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_account_type_id_fkey"
            columns: ["account_type_id"]
            isOneToOne: false
            referencedRelation: "account_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "classifications"
            referencedColumns: ["id"]
          },
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
      approval_actions: {
        Row: {
          acted_at: string
          acted_by: string
          action: Database["public"]["Enums"]["approval_status"]
          comments: string | null
          id: string
          request_id: string
          step_order: number
        }
        Insert: {
          acted_at?: string
          acted_by: string
          action: Database["public"]["Enums"]["approval_status"]
          comments?: string | null
          id?: string
          request_id: string
          step_order: number
        }
        Update: {
          acted_at?: string
          acted_by?: string
          action?: Database["public"]["Enums"]["approval_status"]
          comments?: string | null
          id?: string
          request_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          amount: number
          branch_id: string
          company_id: string
          completed_at: string | null
          created_at: string
          currency_code: string
          current_step: number
          document_id: string
          document_reference: string | null
          document_type: Database["public"]["Enums"]["approval_doc_type"]
          id: string
          notes: string | null
          requested_by: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          workflow_id: string
        }
        Insert: {
          amount?: number
          branch_id: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          current_step?: number
          document_id: string
          document_reference?: string | null
          document_type: Database["public"]["Enums"]["approval_doc_type"]
          id?: string
          notes?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          workflow_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          current_step?: number
          document_id?: string
          document_reference?: string | null
          document_type?: Database["public"]["Enums"]["approval_doc_type"]
          id?: string
          notes?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps_def: {
        Row: {
          created_at: string
          id: string
          required_role: string
          step_name_ar: string
          step_name_en: string
          step_order: number
          workflow_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          required_role: string
          step_name_ar: string
          step_name_en: string
          step_order: number
          workflow_id: string
        }
        Update: {
          created_at?: string
          id?: string
          required_role?: string
          step_name_ar?: string
          step_name_en?: string
          step_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_def_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          company_id: string
          created_at: string
          currency_code: string
          document_type: Database["public"]["Enums"]["approval_doc_type"] | null
          id: string
          is_active: boolean
          journal_type: string | null
          max_amount: number | null
          min_amount: number
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency_code?: string
          document_type?:
            | Database["public"]["Enums"]["approval_doc_type"]
            | null
          id?: string
          is_active?: boolean
          journal_type?: string | null
          max_amount?: number | null
          min_amount?: number
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency_code?: string
          document_type?:
            | Database["public"]["Enums"]["approval_doc_type"]
            | null
          id?: string
          is_active?: boolean
          journal_type?: string | null
          max_amount?: number | null
          min_amount?: number
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_categories: {
        Row: {
          accumulated_depreciation_account_id: string | null
          asset_account_id: string | null
          code: string
          company_id: string
          created_at: string
          default_depreciation_method: Database["public"]["Enums"]["depreciation_method"]
          default_useful_life_months: number
          depreciation_account_id: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          accumulated_depreciation_account_id?: string | null
          asset_account_id?: string | null
          code: string
          company_id: string
          created_at?: string
          default_depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          default_useful_life_months?: number
          depreciation_account_id?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          accumulated_depreciation_account_id?: string | null
          asset_account_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          default_depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          default_useful_life_months?: number
          depreciation_account_id?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_disposals: {
        Row: {
          asset_id: string
          book_value_at_disposal: number
          created_at: string
          created_by: string | null
          disposal_date: string
          disposal_type: string
          gain_loss: number
          id: string
          journal_entry_id: string | null
          notes: string | null
          proceeds: number
        }
        Insert: {
          asset_id: string
          book_value_at_disposal: number
          created_at?: string
          created_by?: string | null
          disposal_date: string
          disposal_type: string
          gain_loss: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          proceeds?: number
        }
        Update: {
          asset_id?: string
          book_value_at_disposal?: number
          created_at?: string
          created_by?: string | null
          disposal_date?: string
          disposal_type?: string
          gain_loss?: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          proceeds?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_disposals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
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
      branch_module_access: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_enabled: boolean
          module_key: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_module_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      approver_scopes: {
        Row: {
          created_at: string
          id: string
          role: string
          scope_id: string
          scope_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          scope_id: string
          scope_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          scope_id?: string
          scope_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_groups: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          hue: number
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          hue?: number
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          hue?: number
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_modules: {
        Row: {
          created_at: string
          group_id: string
          id: string
          module_key: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          module_key: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_modules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      module_sort_order: {
        Row: {
          id: string
          module_key: string
          parent_key: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          id?: string
          module_key: string
          parent_key?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          id?: string
          module_key?: string
          parent_key?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          branch_id: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          notes: string | null
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          notes?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          notes?: string | null
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
          cr_number: string | null
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
          cr_number?: string | null
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
          cr_number?: string | null
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
      classifications: {
        Row: {
          bucket: string
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          normal_balance: string
          notes: string | null
          sort_order: number
          statement: string
          updated_at: string
        }
        Insert: {
          bucket: string
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          normal_balance: string
          notes?: string | null
          sort_order?: number
          statement: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          normal_balance?: string
          notes?: string | null
          sort_order?: number
          statement?: string
          updated_at?: string
        }
        Relationships: []
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
      customer_types: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          notes: string | null
          receivable_account_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          notes?: string | null
          receivable_account_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          notes?: string | null
          receivable_account_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      depreciation_schedule: {
        Row: {
          accumulated_depreciation: number
          asset_id: string
          book_value: number
          created_at: string
          depreciation_amount: number
          id: string
          is_posted: boolean
          journal_entry_id: string | null
          period_date: string
          posted_at: string | null
          posted_by: string | null
        }
        Insert: {
          accumulated_depreciation: number
          asset_id: string
          book_value: number
          created_at?: string
          depreciation_amount: number
          id?: string
          is_posted?: boolean
          journal_entry_id?: string | null
          period_date: string
          posted_at?: string | null
          posted_by?: string | null
        }
        Update: {
          accumulated_depreciation?: number
          asset_id?: string
          book_value?: number
          created_at?: string
          depreciation_amount?: number
          id?: string
          is_posted?: boolean
          journal_entry_id?: string | null
          period_date?: string
          posted_at?: string | null
          posted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_schedule_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
        ]
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
      fiscal_positions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          income_tax_applicable: boolean
          is_active: boolean
          is_saudi: boolean
          name_ar: string
          name_en: string
          updated_at: string
          vat_applicable: boolean
          zakat_applicable: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          income_tax_applicable?: boolean
          is_active?: boolean
          is_saudi?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
          vat_applicable?: boolean
          zakat_applicable?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          income_tax_applicable?: boolean
          is_active?: boolean
          is_saudi?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
          vat_applicable?: boolean
          zakat_applicable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          accumulated_depreciation_account_id: string | null
          acquisition_cost: number
          acquisition_date: string
          asset_account_id: string | null
          branch_id: string
          category_id: string | null
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          current_book_value: number
          depreciation_account_id: string | null
          depreciation_method: Database["public"]["Enums"]["depreciation_method"]
          depreciation_start_date: string
          description: string | null
          id: string
          invoice_id: string | null
          name_ar: string
          name_en: string
          notes: string | null
          partner_id: string | null
          salvage_value: number
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string | null
          acquisition_cost: number
          acquisition_date: string
          asset_account_id?: string | null
          branch_id: string
          category_id?: string | null
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          current_book_value?: number
          depreciation_account_id?: string | null
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          depreciation_start_date: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          name_ar: string
          name_en: string
          notes?: string | null
          partner_id?: string | null
          salvage_value?: number
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          useful_life_months: number
        }
        Update: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string | null
          acquisition_cost?: number
          acquisition_date?: string
          asset_account_id?: string | null
          branch_id?: string
          category_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_book_value?: number
          depreciation_account_id?: string | null
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          depreciation_start_date?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          name_ar?: string
          name_en?: string
          notes?: string | null
          partner_id?: string | null
          salvage_value?: number
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          account_id: string
          cost_center_id: string | null
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          line_number: number
          quantity: number
          subtotal: number
          tax_amount: number
          tax_id: string | null
          tax_rate: number
          total: number
          unit_price: number
        }
        Insert: {
          account_id: string
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          line_number: number
          quantity?: number
          subtotal?: number
          tax_amount?: number
          tax_id?: string | null
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Update: {
          account_id?: string
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          line_number?: number
          quantity?: number
          subtotal?: number
          tax_amount?: number
          tax_id?: string | null
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          branch_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency_code: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          journal_entry_id: string | null
          journal_id: string | null
          notes: string | null
          partner_id: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          branch_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          journal_entry_id?: string | null
          journal_id?: string | null
          notes?: string | null
          partner_id: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          branch_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          journal_entry_id?: string | null
          journal_id?: string | null
          notes?: string | null
          partner_id?: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
          allow_manual_entries: boolean
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
          allow_manual_entries?: boolean
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
          allow_manual_entries?: boolean
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
      lock_dates: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          lock_date: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          lock_date: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lock_date?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lock_dates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lock_dates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_attachments: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          partner_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          partner_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          partner_id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      partner_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          mobile: string | null
          name: string
          notes: string | null
          partner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name: string
          notes?: string | null
          partner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name?: string
          notes?: string | null
          partner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
          customer_type_id: string | null
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
          customer_type_id?: string | null
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
          customer_type_id?: string | null
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
            foreignKeyName: "partners_customer_type_id_fkey"
            columns: ["customer_type_id"]
            isOneToOne: false
            referencedRelation: "customer_types"
            referencedColumns: ["id"]
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
      payment_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
        }
        Relationships: []
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
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          branch_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency_code: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id: string
          journal_entry_id: string | null
          journal_id: string | null
          notes: string | null
          partner_id: string
          payment_date: string
          payment_method_id: string | null
          payment_number: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          branch_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id?: string
          journal_entry_id?: string | null
          journal_id?: string | null
          notes?: string | null
          partner_id: string
          payment_date: string
          payment_method_id?: string | null
          payment_number: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          branch_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          id?: string
          journal_entry_id?: string | null
          journal_id?: string | null
          notes?: string | null
          partner_id?: string
          payment_date?: string
          payment_method_id?: string | null
          payment_number?: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: []
      }
      purchase_categories: {
        Row: {
          id: string
          company_id: string
          parent_id: string | null
          code: string
          name_ar: string
          name_en: string
          is_group: boolean
          sort_order: number
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          parent_id?: string | null
          code: string
          name_ar: string
          name_en: string
          is_group?: boolean
          sort_order?: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          parent_id?: string | null
          code?: string
          name_ar?: string
          name_en?: string
          is_group?: boolean
          sort_order?: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      uom_categories: {
        Row: {
          id: string
          company_id: string
          name_ar: string
          name_en: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name_ar: string
          name_en: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name_ar?: string
          name_en?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      units_of_measure: {
        Row: {
          id: string
          company_id: string
          uom_category_id: string
          code: string
          name_ar: string
          name_en: string
          factor: number
          is_reference: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          uom_category_id: string
          code: string
          name_ar: string
          name_en: string
          factor?: number
          is_reference?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          uom_category_id?: string
          code?: string
          name_ar?: string
          name_en?: string
          factor?: number
          is_reference?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          company_id: string
          code: string
          name_ar: string
          name_en: string
          category_id: string | null
          product_type: string
          purchase_uom_id: string | null
          cost_price: number
          currency_code: string
          expense_account_id: string | null
          requires_batch_tracking: boolean
          requires_expiry_tracking: boolean
          requires_cold_chain: boolean
          is_controlled_substance: boolean
          requires_prescription: boolean
          regulatory_number: string | null
          reorder_point: number | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          code: string
          name_ar: string
          name_en: string
          category_id?: string | null
          product_type?: string
          purchase_uom_id?: string | null
          cost_price?: number
          currency_code?: string
          expense_account_id?: string | null
          requires_batch_tracking?: boolean
          requires_expiry_tracking?: boolean
          requires_cold_chain?: boolean
          is_controlled_substance?: boolean
          requires_prescription?: boolean
          regulatory_number?: string | null
          reorder_point?: number | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          code?: string
          name_ar?: string
          name_en?: string
          category_id?: string | null
          product_type?: string
          purchase_uom_id?: string | null
          cost_price?: number
          currency_code?: string
          expense_account_id?: string | null
          requires_batch_tracking?: boolean
          requires_expiry_tracking?: boolean
          requires_cold_chain?: boolean
          is_controlled_substance?: boolean
          requires_prescription?: boolean
          regulatory_number?: string | null
          reorder_point?: number | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
          employee_id: string | null
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
          employee_id?: string | null
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
          employee_id?: string | null
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
      roles_registry: {
        Row: {
          code: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean
          is_system: boolean
          module_key: string
          name_ar: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          module_key: string
          name_ar: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          module_key?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      transaction_attachments: {
        Row: {
          branch_id: string
          company_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          transaction_id: string
          transaction_type: string
          uploaded_by: string | null
        }
        Insert: {
          branch_id: string
          company_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          transaction_id: string
          transaction_type: string
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          transaction_id?: string
          transaction_type?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      user_branch_access: {
        Row: {
          branch_id: string
          can_delete: boolean
          can_edit: boolean
          can_write: boolean
          granted_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          can_delete?: boolean
          can_edit?: boolean
          can_write?: boolean
          granted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          can_delete?: boolean
          can_edit?: boolean
          can_write?: boolean
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
      user_module_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          module_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      is_date_locked: {
        Args: { _branch_id: string; _company_id: string; _txn_date: string }
        Returns: boolean
      }
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
        | "internal_audit_manager"
        | "direct_manager"
        | "his_admin"
        | "accounting_admin"
      approval_doc_type:
        | "journal_entry"
        | "invoice"
        | "payment"
        | "asset_disposal"
      approval_status: "pending" | "approved" | "rejected" | "cancelled"
      asset_status: "draft" | "active" | "fully_depreciated" | "disposed"
      depreciation_method: "straight_line" | "declining_balance"
      fiscal_period_status: "open" | "closed" | "locked"
      invoice_status:
        | "draft"
        | "posted"
        | "paid"
        | "partially_paid"
        | "cancelled"
      invoice_type: "customer" | "vendor"
      je_status: "draft" | "posted" | "cancelled"
      journal_type: "sales" | "purchase" | "bank" | "cash" | "misc"
      payment_direction: "inbound" | "outbound"
      payment_method_type: "cash" | "bank_transfer" | "check" | "card" | "other"
      payment_status: "draft" | "posted" | "cancelled"
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
        "internal_audit_manager",
        "direct_manager",
        "his_admin",
        "accounting_admin",
      ],
      approval_doc_type: [
        "journal_entry",
        "invoice",
        "payment",
        "asset_disposal",
      ],
      approval_status: ["pending", "approved", "rejected", "cancelled"],
      asset_status: ["draft", "active", "fully_depreciated", "disposed"],
      depreciation_method: ["straight_line", "declining_balance"],
      fiscal_period_status: ["open", "closed", "locked"],
      invoice_status: [
        "draft",
        "posted",
        "paid",
        "partially_paid",
        "cancelled",
      ],
      invoice_type: ["customer", "vendor"],
      je_status: ["draft", "posted", "cancelled"],
      journal_type: ["sales", "purchase", "bank", "cash", "misc"],
      payment_direction: ["inbound", "outbound"],
      payment_method_type: ["cash", "bank_transfer", "check", "card", "other"],
      payment_status: ["draft", "posted", "cancelled"],
      tax_type: ["sale", "purchase"],
    },
  },
} as const
