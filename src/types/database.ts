
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "expense_splits": {
                  Row: {
                    "amount": number,"created_at": string,"expense_id": string,"group_id": string,"id": string,"user_id": string,"weight": number | null
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"expense_id": string,"group_id": string,"id"?: string,"user_id": string,"weight"?: number | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"expense_id"?: string,"group_id"?: string,"id"?: string,"user_id"?: string,"weight"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_splits_expense_id_fkey"
      columns: ["expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_splits_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_splits_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"created_by": string | null,"currency": string,"description": string | null,"expense_date": string,"group_id": string,"id": string,"paid_by": string,"split_type": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"currency": string,"description"?: string | null,"expense_date"?: string,"group_id": string,"id"?: string,"paid_by": string,"split_type"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"expense_date"?: string,"group_id"?: string,"id"?: string,"paid_by"?: string,"split_type"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "group_id": string,"id": string,"joined_at": string,"removed_at": string | null,"role": string,"user_id": string
                  }
                  Insert: {
                    "group_id": string,"id"?: string,"joined_at"?: string,"removed_at"?: string | null,"role"?: string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"joined_at"?: string,"removed_at"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"description": string | null,"id": string,"invite_code": string,"invite_token": string,"last_activity_at": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"invite_code"?: string,"invite_token"?: string,"last_activity_at"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"id"?: string,"invite_code"?: string,"invite_token"?: string,"last_activity_at"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string | null,"id": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"id": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"settlements": {
                  Row: {
                    "amount": number,"cancelled_at": string | null,"created_at": string,"created_by": string | null,"from_user": string,"group_id": string,"id": string,"note": string | null,"paid_at": string | null,"status": string,"to_user": string,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"from_user": string,"group_id": string,"id"?: string,"note"?: string | null,"paid_at"?: string | null,"status"?: string,"to_user": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"from_user"?: string,"group_id"?: string,"id"?: string,"note"?: string | null,"paid_at"?: string | null,"status"?: string,"to_user"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_from_user_fkey"
      columns: ["from_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_to_user_fkey"
      columns: ["to_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assert_expense_split_total":
{ Args: { "p_expense_id": string }; Returns: undefined
                           },
"can_edit_expense":
{ Args: { "p_expense_id": string }; Returns: boolean
                           },
"create_expense":
{ Args: { "p_amount": number,"p_category"?: string,"p_description"?: string,"p_expense_date"?: string,"p_group_id": string,"p_paid_by": string,"p_split_type"?: string,"p_splits": Json,"p_title": string }; Returns: string
                           },
"create_group":
{ Args: { "p_currency"?: string,"p_description"?: string,"p_name": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"currency": string,
"description": string | null,
"id": string,
"invite_code": string,
"invite_token": string,
"last_activity_at": string,
"name": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "groups"
        isOneToOne: true
        isSetofReturn: false
      } },
"ensure_profile":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"expense_involves_former_member":
{ Args: { "p_expense_id": string }; Returns: boolean
                           },
"find_invite_by_code":
{ Args: { "p_code": string }; Returns: string
                           },
"generate_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"generate_invite_token":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_invite_preview":
{ Args: { "p_token": string }; Returns: {
              "creator_name": string,"currency": string,"description": string,"group_id": string,"is_member": boolean,"member_count": number,"name": string
            }[]
                           },
"get_my_groups":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"currency": string,"description": string,"id": string,"last_activity_at": string,"member_count": number,"my_balance": number,"name": string,"role": string,"total_spent": number
            }[]
                           },
"group_balances":
{ Args: { "p_group_id": string }; Returns: {
              "net": number,"paid": number,"received": number,"sent": number,"share": number,"user_id": string
            }[]
                           },
"is_active_member":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: boolean
                           },
"is_group_admin":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"is_group_member":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"is_group_owner":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"join_group":
{ Args: { "p_token": string }; Returns: {
              "group_id": string,"status": string
            }[]
                           },
"member_net_balance":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: number
                           },
"regenerate_invite":
{ Args: { "p_group_id": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"currency": string,
"description": string | null,
"id": string,
"invite_code": string,
"invite_token": string,
"last_activity_at": string,
"name": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "groups"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_member":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: string
                           },
"set_member_role":
{ Args: { "p_group_id": string,"p_role": string,"p_user_id": string }; Returns: undefined
                           },
"shares_group_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"update_expense":
{ Args: { "p_amount": number,"p_category"?: string,"p_description"?: string,"p_expense_date"?: string,"p_expense_id": string,"p_paid_by": string,"p_split_type"?: string,"p_splits": Json,"p_title": string }; Returns: undefined
                           },
"validate_splits":
{ Args: { "p_amount": number,"p_splits": Json }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
