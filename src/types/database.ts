
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
            "bookings": {
                  Row: {
                    "cancelled_at": string | null,"cancelled_by": string | null,"checked_in_at": string | null,"created_at": string,"created_by": string | null,"credit_refunded": boolean,"dance_role": Database["public"]['Enums']["dance_role"] | null,"id": string,"session_id": string,"status": Database["public"]['Enums']["booking_status"],"student_id": string,"student_pack_id": string | null,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "cancelled_at"?: string | null,"cancelled_by"?: string | null,"checked_in_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"credit_refunded"?: boolean,"dance_role"?: Database["public"]['Enums']["dance_role"] | null,"id"?: string,"session_id": string,"status"?: Database["public"]['Enums']["booking_status"],"student_id": string,"student_pack_id"?: string | null,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"cancelled_by"?: string | null,"checked_in_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"credit_refunded"?: boolean,"dance_role"?: Database["public"]['Enums']["dance_role"] | null,"id"?: string,"session_id"?: string,"status"?: Database["public"]['Enums']["booking_status"],"student_id"?: string,"student_pack_id"?: string | null,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_studio_id_session_id_fkey"
      columns: ["studio_id","session_id"]
isOneToOne: false
      referencedRelation: "session_occupancy"
      referencedColumns: ["studio_id","session_id"]
    },{
      foreignKeyName: "bookings_studio_id_session_id_fkey"
      columns: ["studio_id","session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "bookings_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "bookings_studio_id_student_pack_id_fkey"
      columns: ["studio_id","student_pack_id"]
isOneToOne: false
      referencedRelation: "student_balances"
      referencedColumns: ["studio_id","student_pack_id"]
    },{
      foreignKeyName: "bookings_studio_id_student_pack_id_fkey"
      columns: ["studio_id","student_pack_id"]
isOneToOne: false
      referencedRelation: "student_packs"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"class_schedules": {
                  Row: {
                    "created_at": string,"duration_minutes": number,"id": string,"is_active": boolean,"offering_id": string,"start_time": string,"studio_id": string,"valid_from": string | null,"valid_until": string | null,"weekday": number
                  }
                  Insert: {
                    "created_at"?: string,"duration_minutes": number,"id"?: string,"is_active"?: boolean,"offering_id": string,"start_time": string,"studio_id": string,"valid_from"?: string | null,"valid_until"?: string | null,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"duration_minutes"?: number,"id"?: string,"is_active"?: boolean,"offering_id"?: string,"start_time"?: string,"studio_id"?: string,"valid_from"?: string | null,"valid_until"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_schedules_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_schedules_studio_id_offering_id_fkey"
      columns: ["studio_id","offering_id"]
isOneToOne: false
      referencedRelation: "offerings"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"disciplines": {
                  Row: {
                    "features": NonNullable<Json>,"is_active": boolean,"key": string,"name": string,"sort": number
                  }
                  Insert: {
                    "features"?: NonNullable<Json>,"is_active"?: boolean,"key": string,"name": string,"sort"?: number
                  }
                  Update: {
                    "features"?: NonNullable<Json>,"is_active"?: boolean,"key"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"mp_connections": {
                  Row: {
                    "access_token_enc": string,"connected_by": string | null,"created_at": string,"expires_at": string,"live_mode": boolean,"mp_user_id": string,"public_key": string | null,"refresh_token_enc": string,"scope": string | null,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "access_token_enc": string,"connected_by"?: string | null,"created_at"?: string,"expires_at": string,"live_mode"?: boolean,"mp_user_id": string,"public_key"?: string | null,"refresh_token_enc": string,"scope"?: string | null,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "access_token_enc"?: string,"connected_by"?: string | null,"created_at"?: string,"expires_at"?: string,"live_mode"?: boolean,"mp_user_id"?: string,"public_key"?: string | null,"refresh_token_enc"?: string,"scope"?: string | null,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mp_connections_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: true
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"mp_webhook_events": {
                  Row: {
                    "error": string | null,"id": number,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string,"request_id": string | null,"resource_id": string,"studio_id": string | null,"topic": string
                  }
                  Insert: {
                    "error"?: string | null,"id"?: never,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"request_id"?: string | null,"resource_id": string,"studio_id"?: string | null,"topic": string
                  }
                  Update: {
                    "error"?: string | null,"id"?: never,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"request_id"?: string | null,"resource_id"?: string,"studio_id"?: string | null,"topic"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mp_webhook_events_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "attempts": number,"channel": string,"created_at": string,"dedupe_key": string | null,"id": number,"last_error": string | null,"payload": NonNullable<Json>,"send_after": string,"sent_at": string | null,"status": string,"student_id": string | null,"studio_id": string,"template": string,"to_address": string | null
                  }
                  Insert: {
                    "attempts"?: number,"channel"?: string,"created_at"?: string,"dedupe_key"?: string | null,"id"?: never,"last_error"?: string | null,"payload"?: NonNullable<Json>,"send_after"?: string,"sent_at"?: string | null,"status"?: string,"student_id"?: string | null,"studio_id": string,"template": string,"to_address"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"channel"?: string,"created_at"?: string,"dedupe_key"?: string | null,"id"?: never,"last_error"?: string | null,"payload"?: NonNullable<Json>,"send_after"?: string,"sent_at"?: string | null,"status"?: string,"student_id"?: string | null,"studio_id"?: string,"template"?: string,"to_address"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"offerings": {
                  Row: {
                    "capacity": number,"created_at": string,"description": string | null,"discipline_key": string,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["offering_kind"],"level": string | null,"price_cents": number | null,"role_balance_max_diff": number | null,"studio_id": string,"teacher_member_id": string | null,"teacher_name": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "capacity": number,"created_at"?: string,"description"?: string | null,"discipline_key": string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["offering_kind"],"level"?: string | null,"price_cents"?: number | null,"role_balance_max_diff"?: number | null,"studio_id": string,"teacher_member_id"?: string | null,"teacher_name"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "capacity"?: number,"created_at"?: string,"description"?: string | null,"discipline_key"?: string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["offering_kind"],"level"?: string | null,"price_cents"?: number | null,"role_balance_max_diff"?: number | null,"studio_id"?: string,"teacher_member_id"?: string | null,"teacher_name"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offerings_discipline_key_fkey"
      columns: ["discipline_key"]
isOneToOne: false
      referencedRelation: "disciplines"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "offerings_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offerings_studio_id_teacher_member_id_fkey"
      columns: ["studio_id","teacher_member_id"]
isOneToOne: false
      referencedRelation: "studio_members"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"pack_credit_events": {
                  Row: {
                    "booking_id": string | null,"created_at": string,"created_by": string | null,"delta": number,"id": number,"kind": Database["public"]['Enums']["credit_event_kind"],"note": string | null,"student_pack_id": string,"studio_id": string
                  }
                  Insert: {
                    "booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"delta": number,"id"?: never,"kind": Database["public"]['Enums']["credit_event_kind"],"note"?: string | null,"student_pack_id": string,"studio_id": string
                  }
                  Update: {
                    "booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"delta"?: number,"id"?: never,"kind"?: Database["public"]['Enums']["credit_event_kind"],"note"?: string | null,"student_pack_id"?: string,"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pack_credit_events_booking_fk"
      columns: ["studio_id","booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "pack_credit_events_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pack_credit_events_studio_id_student_pack_id_fkey"
      columns: ["studio_id","student_pack_id"]
isOneToOne: false
      referencedRelation: "student_balances"
      referencedColumns: ["studio_id","student_pack_id"]
    },{
      foreignKeyName: "pack_credit_events_studio_id_student_pack_id_fkey"
      columns: ["studio_id","student_pack_id"]
isOneToOne: false
      referencedRelation: "student_packs"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"pack_products": {
                  Row: {
                    "created_at": string,"credits": number | null,"description": string | null,"id": string,"is_active": boolean,"is_couple": boolean,"name": string,"price_cents": number,"sort": number,"studio_id": string,"updated_at": string,"validity_days": number
                  }
                  Insert: {
                    "created_at"?: string,"credits"?: number | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_couple"?: boolean,"name": string,"price_cents": number,"sort"?: number,"studio_id": string,"updated_at"?: string,"validity_days": number
                  }
                  Update: {
                    "created_at"?: string,"credits"?: number | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_couple"?: boolean,"name"?: string,"price_cents"?: number,"sort"?: number,"studio_id"?: string,"updated_at"?: string,"validity_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pack_products_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string | null,"currency": string,"external_reference": string,"id": string,"marketplace_fee_cents": number,"method": Database["public"]['Enums']["payment_method"],"mp_payment_id": string | null,"mp_preference_id": string | null,"notes": string | null,"pack_product_id": string | null,"paid_at": string | null,"partner_student_id": string | null,"purpose": Database["public"]['Enums']["payment_purpose"],"status": Database["public"]['Enums']["payment_status"],"student_id": string,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"external_reference"?: string,"id"?: string,"marketplace_fee_cents"?: number,"method": Database["public"]['Enums']["payment_method"],"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"pack_product_id"?: string | null,"paid_at"?: string | null,"partner_student_id"?: string | null,"purpose"?: Database["public"]['Enums']["payment_purpose"],"status"?: Database["public"]['Enums']["payment_status"],"student_id": string,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"external_reference"?: string,"id"?: string,"marketplace_fee_cents"?: number,"method"?: Database["public"]['Enums']["payment_method"],"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"pack_product_id"?: string | null,"paid_at"?: string | null,"partner_student_id"?: string | null,"purpose"?: Database["public"]['Enums']["payment_purpose"],"status"?: Database["public"]['Enums']["payment_status"],"student_id"?: string,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_studio_id_pack_product_id_fkey"
      columns: ["studio_id","pack_product_id"]
isOneToOne: false
      referencedRelation: "pack_products"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "payments_studio_id_partner_student_id_fkey"
      columns: ["studio_id","partner_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "payments_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"plan_features": {
                  Row: {
                    "feature": string,"plan": Database["public"]['Enums']["studio_plan"]
                  }
                  Insert: {
                    "feature": string,"plan": Database["public"]['Enums']["studio_plan"]
                  }
                  Update: {
                    "feature"?: string,"plan"?: Database["public"]['Enums']["studio_plan"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_features_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["key"]
    }
                  ]
                },"plans": {
                  Row: {
                    "key": Database["public"]['Enums']["studio_plan"],"max_active_formations": number | null,"max_active_students": number | null,"monthly_price_cents": number,"name": string,"sort": number
                  }
                  Insert: {
                    "key": Database["public"]['Enums']["studio_plan"],"max_active_formations"?: number | null,"max_active_students"?: number | null,"monthly_price_cents": number,"name": string,"sort": number
                  }
                  Update: {
                    "key"?: Database["public"]['Enums']["studio_plan"],"max_active_formations"?: number | null,"max_active_students"?: number | null,"monthly_price_cents"?: number,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"sessions": {
                  Row: {
                    "capacity_override": number | null,"created_at": string,"ends_at": string,"id": string,"notes": string | null,"offering_id": string,"schedule_id": string | null,"starts_at": string,"status": Database["public"]['Enums']["session_status"],"studio_id": string
                  }
                  Insert: {
                    "capacity_override"?: number | null,"created_at"?: string,"ends_at": string,"id"?: string,"notes"?: string | null,"offering_id": string,"schedule_id"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["session_status"],"studio_id": string
                  }
                  Update: {
                    "capacity_override"?: number | null,"created_at"?: string,"ends_at"?: string,"id"?: string,"notes"?: string | null,"offering_id"?: string,"schedule_id"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["session_status"],"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_studio_id_offering_id_fkey"
      columns: ["studio_id","offering_id"]
isOneToOne: false
      referencedRelation: "offerings"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "sessions_studio_id_schedule_id_fkey"
      columns: ["studio_id","schedule_id"]
isOneToOne: false
      referencedRelation: "class_schedules"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"student_packs": {
                  Row: {
                    "created_at": string,"credits_total": number | null,"credits_used": number,"expires_at": string,"frozen_at": string | null,"id": string,"name": string,"pack_product_id": string | null,"partner_student_id": string | null,"payment_id": string | null,"starts_at": string,"status": Database["public"]['Enums']["pack_status"],"student_id": string,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"credits_total"?: number | null,"credits_used"?: number,"expires_at": string,"frozen_at"?: string | null,"id"?: string,"name": string,"pack_product_id"?: string | null,"partner_student_id"?: string | null,"payment_id"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["pack_status"],"student_id": string,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"credits_total"?: number | null,"credits_used"?: number,"expires_at"?: string,"frozen_at"?: string | null,"id"?: string,"name"?: string,"pack_product_id"?: string | null,"partner_student_id"?: string | null,"payment_id"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["pack_status"],"student_id"?: string,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_packs_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_packs_studio_id_pack_product_id_fkey"
      columns: ["studio_id","pack_product_id"]
isOneToOne: false
      referencedRelation: "pack_products"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "student_packs_studio_id_partner_student_id_fkey"
      columns: ["studio_id","partner_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "student_packs_studio_id_payment_id_fkey"
      columns: ["studio_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "student_packs_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"students": {
                  Row: {
                    "created_at": string,"default_role": Database["public"]['Enums']["dance_role"] | null,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"phone": string | null,"qr_token": string,"studio_id": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"default_role"?: Database["public"]['Enums']["dance_role"] | null,"email"?: string | null,"full_name": string,"id"?: string,"is_active"?: boolean,"phone"?: string | null,"qr_token"?: string,"studio_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"default_role"?: Database["public"]['Enums']["dance_role"] | null,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"phone"?: string | null,"qr_token"?: string,"studio_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"studio_members": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"role": Database["public"]['Enums']["member_role"],"studio_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"role": Database["public"]['Enums']["member_role"],"studio_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"studio_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studio_members_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"studio_subscriptions": {
                  Row: {
                    "billing_cycle": Database["public"]['Enums']["billing_cycle"],"created_at": string,"current_period_end": string | null,"founder_discount_pct": number,"mp_preapproval_id": string | null,"notes": string | null,"payment_method": string,"status": Database["public"]['Enums']["subscription_status"],"studio_id": string,"trial_ends_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"created_at"?: string,"current_period_end"?: string | null,"founder_discount_pct"?: number,"mp_preapproval_id"?: string | null,"notes"?: string | null,"payment_method"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"studio_id": string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"created_at"?: string,"current_period_end"?: string | null,"founder_discount_pct"?: number,"mp_preapproval_id"?: string | null,"notes"?: string | null,"payment_method"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"studio_id"?: string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studio_subscriptions_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: true
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"studios": {
                  Row: {
                    "brand_color": string,"cancel_window_hours": number,"created_at": string,"id": string,"is_active": boolean,"logo_path": string | null,"name": string,"plan": Database["public"]['Enums']["studio_plan"],"slug": string,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "brand_color"?: string,"cancel_window_hours"?: number,"created_at"?: string,"id"?: string,"is_active"?: boolean,"logo_path"?: string | null,"name": string,"plan"?: Database["public"]['Enums']["studio_plan"],"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "brand_color"?: string,"cancel_window_hours"?: number,"created_at"?: string,"id"?: string,"is_active"?: boolean,"logo_path"?: string | null,"name"?: string,"plan"?: Database["public"]['Enums']["studio_plan"],"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studios_plan_fkey"
      columns: ["plan"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["key"]
    }
                  ]
                }
          }
          Views: {
            "session_occupancy": {
                  Row: {
                    "attended_count": number | null,"booked_count": number | null,"capacity": number | null,"ends_at": string | null,"follower_count": number | null,"leader_count": number | null,"offering_id": string | null,"session_id": string | null,"starts_at": string | null,"status": Database["public"]['Enums']["session_status"] | null,"studio_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_studio_id_offering_id_fkey"
      columns: ["studio_id","offering_id"]
isOneToOne: false
      referencedRelation: "offerings"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"student_balances": {
                  Row: {
                    "credits_remaining": number | null,"credits_total": number | null,"credits_used": number | null,"expires_at": string | null,"expires_on": string | null,"is_usable": boolean | null,"name": string | null,"partner_student_id": string | null,"starts_at": string | null,"status": Database["public"]['Enums']["pack_status"] | null,"student_id": string | null,"student_pack_id": string | null,"studio_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_packs_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_packs_studio_id_partner_student_id_fkey"
      columns: ["studio_id","partner_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "student_packs_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "active_students_count":
{ Args: { "p_studio_id": string }; Returns: number
                           },
"book_session":
{ Args: { "p_role"?: Database["public"]['Enums']["dance_role"],"p_session_id": string,"p_student_id"?: string }; Returns: {
              "cancelled_at": string | null,
"cancelled_by": string | null,
"checked_in_at": string | null,
"created_at": string,
"created_by": string | null,
"credit_refunded": boolean,
"dance_role": Database["public"]['Enums']["dance_role"] | null,
"id": string,
"session_id": string,
"status": Database["public"]['Enums']["booking_status"],
"student_id": string,
"student_pack_id": string | null,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_booking":
{ Args: { "p_booking_id": string,"p_refund"?: boolean }; Returns: {
              "cancelled_at": string | null,
"cancelled_by": string | null,
"checked_in_at": string | null,
"created_at": string,
"created_by": string | null,
"credit_refunded": boolean,
"dance_role": Database["public"]['Enums']["dance_role"] | null,
"id": string,
"session_id": string,
"status": Database["public"]['Enums']["booking_status"],
"student_id": string,
"student_pack_id": string | null,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_session":
{ Args: { "p_reason"?: string,"p_session_id": string }; Returns: number
                           },
"check_in":
{ Args: { "p_session_id": string,"p_student_id": string }; Returns: {
              "cancelled_at": string | null,
"cancelled_by": string | null,
"checked_in_at": string | null,
"created_at": string,
"created_by": string | null,
"credit_refunded": boolean,
"dance_role": Database["public"]['Enums']["dance_role"] | null,
"id": string,
"session_id": string,
"status": Database["public"]['Enums']["booking_status"],
"student_id": string,
"student_pack_id": string | null,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"check_in_by_qr":
{ Args: { "p_qr_token": string,"p_session_id": string }; Returns: Json
                           },
"check_slug":
{ Args: { "p_slug": string }; Returns: string
                           },
"create_pack_payment":
{ Args: { "p_pack_product_id": string }; Returns: {
              "amount_cents": number,
"created_at": string,
"created_by": string | null,
"currency": string,
"external_reference": string,
"id": string,
"marketplace_fee_cents": number,
"method": Database["public"]['Enums']["payment_method"],
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"notes": string | null,
"pack_product_id": string | null,
"paid_at": string | null,
"partner_student_id": string | null,
"purpose": Database["public"]['Enums']["payment_purpose"],
"status": Database["public"]['Enums']["payment_status"],
"student_id": string,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "payments"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_studio":
{ Args: { "p_name": string,"p_slug": string }; Returns: {
              "brand_color": string,
"cancel_window_hours": number,
"created_at": string,
"id": string,
"is_active": boolean,
"logo_path": string | null,
"name": string,
"plan": Database["public"]['Enums']["studio_plan"],
"slug": string,
"timezone": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "studios"
        isOneToOne: true
        isSetofReturn: false
      } },
"expire_packs":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"generate_sessions":
{ Args: { "p_from"?: string,"p_studio_id": string,"p_weeks"?: number }; Returns: number
                           },
"grant_pack":
{ Args: { "p_payment_id": string }; Returns: {
              "created_at": string,
"credits_total": number | null,
"credits_used": number,
"expires_at": string,
"frozen_at": string | null,
"id": string,
"name": string,
"pack_product_id": string | null,
"partner_student_id": string | null,
"payment_id": string | null,
"starts_at": string,
"status": Database["public"]['Enums']["pack_status"],
"student_id": string,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "student_packs"
        isOneToOne: true
        isSetofReturn: false
      } },
"import_students":
{ Args: { "p_rows": Json,"p_studio_id": string }; Returns: Json
                           },
"join_studio":
{ Args: { "p_full_name": string,"p_phone"?: string,"p_role"?: Database["public"]['Enums']["dance_role"],"p_slug": string }; Returns: {
              "created_at": string,
"default_role": Database["public"]['Enums']["dance_role"] | null,
"email": string | null,
"full_name": string,
"id": string,
"is_active": boolean,
"phone": string | null,
"qr_token": string,
"studio_id": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "students"
        isOneToOne: true
        isSetofReturn: false
      } },
"list_public_sessions":
{ Args: { "p_from": string,"p_slug": string,"p_to": string }; Returns: {
              "booked_count": number,"capacity": number,"description": string,"discipline_key": string,"discipline_name": string,"ends_at": string,"follower_count": number,"leader_count": number,"level": string,"offering_id": string,"role_balance": boolean,"role_balance_max_diff": number,"session_id": string,"spots_left": number,"starts_at": string,"status": Database["public"]['Enums']["session_status"],"teacher_name": string,"title": string
            }[]
                           },
"mp_apply_payment":
{ Args: { "p_amount_cents": number,"p_external_reference": string,"p_mp_payment_id": string,"p_mp_status": string,"p_paid_at"?: string }; Returns: Json
                           },
"mp_connection_status":
{ Args: { "p_studio_id": string }; Returns: {
              "connected": boolean,"expires_at": string,"live_mode": boolean,"mp_user_id": string
            }[]
                           },
"record_manual_payment":
{ Args: { "p_amount_cents"?: number,"p_method": Database["public"]['Enums']["payment_method"],"p_notes"?: string,"p_pack_product_id": string,"p_partner_student_id"?: string,"p_student_id": string }; Returns: Json
                           },
"remove_schedule":
{ Args: { "p_schedule_id": string }; Returns: number
                           },
"studio_accepts_online_payments":
{ Args: { "p_studio_id": string }; Returns: boolean
                           },
"studio_has_feature":
{ Args: { "p_feature": string,"p_studio_id": string }; Returns: boolean
                           },
"studio_usage":
{ Args: { "p_studio_id": string }; Returns: Json
                           },
"update_my_student_profile":
{ Args: { "p_default_role"?: Database["public"]['Enums']["dance_role"],"p_full_name": string,"p_phone"?: string,"p_student_id": string }; Returns: {
              "created_at": string,
"default_role": Database["public"]['Enums']["dance_role"] | null,
"email": string | null,
"full_name": string,
"id": string,
"is_active": boolean,
"phone": string | null,
"qr_token": string,
"studio_id": string,
"updated_at": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "students"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "billing_cycle": "monthly"|"annual","booking_status": "booked"|"attended"|"cancelled"|"no_show","credit_event_kind": "grant"|"consume"|"refund"|"adjust"|"expire","dance_role": "leader"|"follower","member_role": "owner"|"admin"|"teacher","offering_kind": "regular"|"special"|"formation","pack_status": "active"|"frozen"|"expired"|"cancelled","payment_method": "mercadopago"|"cash"|"transfer","payment_purpose": "pack","payment_status": "pending"|"approved"|"rejected"|"refunded"|"cancelled","session_status": "scheduled"|"cancelled","studio_plan": "profe"|"inicial"|"estudio"|"pro","subscription_status": "trialing"|"active"|"past_due"|"cancelled"
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
            "billing_cycle": ["monthly", "annual"],"booking_status": ["booked", "attended", "cancelled", "no_show"],"credit_event_kind": ["grant", "consume", "refund", "adjust", "expire"],"dance_role": ["leader", "follower"],"member_role": ["owner", "admin", "teacher"],"offering_kind": ["regular", "special", "formation"],"pack_status": ["active", "frozen", "expired", "cancelled"],"payment_method": ["mercadopago", "cash", "transfer"],"payment_purpose": ["pack"],"payment_status": ["pending", "approved", "rejected", "refunded", "cancelled"],"session_status": ["scheduled", "cancelled"],"studio_plan": ["profe", "inicial", "estudio", "pro"],"subscription_status": ["trialing", "active", "past_due", "cancelled"]
          }
        }
} as const
