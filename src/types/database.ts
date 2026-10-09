
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
            "announcement_dismissals": {
                  Row: {
                    "announcement_id": string,"dismissed_at": string,"student_id": string,"studio_id": string
                  }
                  Insert: {
                    "announcement_id": string,"dismissed_at"?: string,"student_id": string,"studio_id": string
                  }
                  Update: {
                    "announcement_id"?: string,"dismissed_at"?: string,"student_id"?: string,"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_dismissals_studio_id_announcement_id_fkey"
      columns: ["studio_id","announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "announcement_dismissals_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_dismissals_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "audience": string,"body": string,"created_at": string,"created_by": string | null,"emailed_count": number,"formation_id": string | null,"id": string,"offering_id": string | null,"send_email": boolean,"studio_id": string,"title": string,"visible_until": string | null
                  }
                  Insert: {
                    "audience": string,"body": string,"created_at"?: string,"created_by"?: string | null,"emailed_count"?: number,"formation_id"?: string | null,"id"?: string,"offering_id"?: string | null,"send_email"?: boolean,"studio_id": string,"title": string,"visible_until"?: string | null
                  }
                  Update: {
                    "audience"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"emailed_count"?: number,"formation_id"?: string | null,"id"?: string,"offering_id"?: string | null,"send_email"?: boolean,"studio_id"?: string,"title"?: string,"visible_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_studio_id_formation_id_fkey"
      columns: ["studio_id","formation_id"]
isOneToOne: false
      referencedRelation: "formations"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "announcements_studio_id_offering_id_fkey"
      columns: ["studio_id","offering_id"]
isOneToOne: false
      referencedRelation: "offerings"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"audition_applications": {
                  Row: {
                    "answers": NonNullable<Json>,"audition_id": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"external_reference": string,"fee_cents": number,"formation_id": string,"hold_expires_at": string | null,"id": string,"method": Database["public"]['Enums']["payment_method"] | null,"mp_payment_id": string | null,"mp_preference_id": string | null,"paid_at": string | null,"slot_id": string | null,"staff_notes": string | null,"status": Database["public"]['Enums']["audition_application_status"],"student_id": string,"studio_id": string,"updated_at": string,"video_url": string | null
                  }
                  Insert: {
                    "answers"?: NonNullable<Json>,"audition_id": string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"external_reference"?: string,"fee_cents"?: number,"formation_id": string,"hold_expires_at"?: string | null,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"paid_at"?: string | null,"slot_id"?: string | null,"staff_notes"?: string | null,"status"?: Database["public"]['Enums']["audition_application_status"],"student_id": string,"studio_id": string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"audition_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"external_reference"?: string,"fee_cents"?: number,"formation_id"?: string,"hold_expires_at"?: string | null,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"paid_at"?: string | null,"slot_id"?: string | null,"staff_notes"?: string | null,"status"?: Database["public"]['Enums']["audition_application_status"],"student_id"?: string,"studio_id"?: string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audition_applications_studio_id_audition_id_fkey"
      columns: ["studio_id","audition_id"]
isOneToOne: false
      referencedRelation: "auditions"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "audition_applications_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audition_applications_studio_id_formation_id_fkey"
      columns: ["studio_id","formation_id"]
isOneToOne: false
      referencedRelation: "formations"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "audition_applications_studio_id_slot_id_fkey"
      columns: ["studio_id","slot_id"]
isOneToOne: false
      referencedRelation: "audition_slots"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "audition_applications_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"audition_fields": {
                  Row: {
                    "audition_id": string,"id": string,"kind": Database["public"]['Enums']["audition_field_kind"],"label": string,"options": (string)[],"required": boolean,"sort": number,"studio_id": string
                  }
                  Insert: {
                    "audition_id": string,"id"?: string,"kind"?: Database["public"]['Enums']["audition_field_kind"],"label": string,"options"?: (string)[],"required"?: boolean,"sort"?: number,"studio_id": string
                  }
                  Update: {
                    "audition_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["audition_field_kind"],"label"?: string,"options"?: (string)[],"required"?: boolean,"sort"?: number,"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audition_fields_studio_id_audition_id_fkey"
      columns: ["studio_id","audition_id"]
isOneToOne: false
      referencedRelation: "auditions"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "audition_fields_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"audition_slots": {
                  Row: {
                    "audition_id": string,"capacity": number,"ends_at": string,"id": string,"starts_at": string,"studio_id": string
                  }
                  Insert: {
                    "audition_id": string,"capacity"?: number,"ends_at": string,"id"?: string,"starts_at": string,"studio_id": string
                  }
                  Update: {
                    "audition_id"?: string,"capacity"?: number,"ends_at"?: string,"id"?: string,"starts_at"?: string,"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audition_slots_studio_id_audition_id_fkey"
      columns: ["studio_id","audition_id"]
isOneToOne: false
      referencedRelation: "auditions"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "audition_slots_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"auditions": {
                  Row: {
                    "closes_at": string | null,"created_at": string,"description": string | null,"fee_cents": number,"formation_id": string,"id": string,"status": Database["public"]['Enums']["audition_status"],"studio_id": string,"title": string,"updated_at": string,"uses_slots": boolean,"video_mode": string
                  }
                  Insert: {
                    "closes_at"?: string | null,"created_at"?: string,"description"?: string | null,"fee_cents"?: number,"formation_id": string,"id"?: string,"status"?: Database["public"]['Enums']["audition_status"],"studio_id": string,"title": string,"updated_at"?: string,"uses_slots"?: boolean,"video_mode"?: string
                  }
                  Update: {
                    "closes_at"?: string | null,"created_at"?: string,"description"?: string | null,"fee_cents"?: number,"formation_id"?: string,"id"?: string,"status"?: Database["public"]['Enums']["audition_status"],"studio_id"?: string,"title"?: string,"updated_at"?: string,"uses_slots"?: boolean,"video_mode"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "auditions_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "auditions_studio_id_formation_id_fkey"
      columns: ["studio_id","formation_id"]
isOneToOne: false
      referencedRelation: "formations"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "cancelled_at": string | null,"cancelled_by": string | null,"checked_in_at": string | null,"created_at": string,"created_by": string | null,"credit_refunded": boolean,"dance_role": Database["public"]['Enums']["dance_role"] | null,"id": string,"is_trial": boolean,"session_id": string,"status": Database["public"]['Enums']["booking_status"],"student_id": string,"student_pack_id": string | null,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "cancelled_at"?: string | null,"cancelled_by"?: string | null,"checked_in_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"credit_refunded"?: boolean,"dance_role"?: Database["public"]['Enums']["dance_role"] | null,"id"?: string,"is_trial"?: boolean,"session_id": string,"status"?: Database["public"]['Enums']["booking_status"],"student_id": string,"student_pack_id"?: string | null,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"cancelled_by"?: string | null,"checked_in_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"credit_refunded"?: boolean,"dance_role"?: Database["public"]['Enums']["dance_role"] | null,"id"?: string,"is_trial"?: boolean,"session_id"?: string,"status"?: Database["public"]['Enums']["booking_status"],"student_id"?: string,"student_pack_id"?: string | null,"studio_id"?: string,"updated_at"?: string
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
                },"class_purchases": {
                  Row: {
                    "amount_cents": number,"booking_id": string | null,"created_at": string,"created_by": string | null,"external_reference": string,"hold_expires_at": string | null,"id": string,"method": Database["public"]['Enums']["payment_method"] | null,"mp_payment_id": string | null,"mp_preference_id": string | null,"notes": string | null,"paid_at": string | null,"session_id": string,"status": string,"student_id": string,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_cents": number,"booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"external_reference"?: string,"hold_expires_at"?: string | null,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"paid_at"?: string | null,"session_id": string,"status"?: string,"student_id": string,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"external_reference"?: string,"hold_expires_at"?: string | null,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"paid_at"?: string | null,"session_id"?: string,"status"?: string,"student_id"?: string,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_purchases_studio_id_booking_id_fkey"
      columns: ["studio_id","booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "class_purchases_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_purchases_studio_id_session_id_fkey"
      columns: ["studio_id","session_id"]
isOneToOne: false
      referencedRelation: "session_occupancy"
      referencedColumns: ["studio_id","session_id"]
    },{
      foreignKeyName: "class_purchases_studio_id_session_id_fkey"
      columns: ["studio_id","session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "class_purchases_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
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
                },"coupon_redemptions": {
                  Row: {
                    "coupon_id": string,"created_at": string,"discount_cents": number,"email": string | null,"event_order_id": string | null,"id": string,"payment_id": string | null,"status": Database["public"]['Enums']["coupon_redemption_status"],"student_id": string | null,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "coupon_id": string,"created_at"?: string,"discount_cents": number,"email"?: string | null,"event_order_id"?: string | null,"id"?: string,"payment_id"?: string | null,"status"?: Database["public"]['Enums']["coupon_redemption_status"],"student_id"?: string | null,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "coupon_id"?: string,"created_at"?: string,"discount_cents"?: number,"email"?: string | null,"event_order_id"?: string | null,"id"?: string,"payment_id"?: string | null,"status"?: Database["public"]['Enums']["coupon_redemption_status"],"student_id"?: string | null,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_studio_id_coupon_id_fkey"
      columns: ["studio_id","coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "coupon_redemptions_studio_id_event_order_id_fkey"
      columns: ["studio_id","event_order_id"]
isOneToOne: false
      referencedRelation: "event_orders"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "coupon_redemptions_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_studio_id_payment_id_fkey"
      columns: ["studio_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "coupon_redemptions_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "applies_to": Database["public"]['Enums']["coupon_target"],"code": string,"created_at": string,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["coupon_kind"],"max_uses": number | null,"once_per_person": boolean,"studio_id": string,"updated_at": string,"valid_until": string | null,"value": number
                  }
                  Insert: {
                    "applies_to"?: Database["public"]['Enums']["coupon_target"],"code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["coupon_kind"],"max_uses"?: number | null,"once_per_person"?: boolean,"studio_id": string,"updated_at"?: string,"valid_until"?: string | null,"value": number
                  }
                  Update: {
                    "applies_to"?: Database["public"]['Enums']["coupon_target"],"code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["coupon_kind"],"max_uses"?: number | null,"once_per_person"?: boolean,"studio_id"?: string,"updated_at"?: string,"valid_until"?: string | null,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupons_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
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
                },"event_orders": {
                  Row: {
                    "access_token": string,"amount_cents": number,"buyer_email": string | null,"buyer_name": string,"buyer_phone": string | null,"coupon_id": string | null,"created_at": string,"created_by": string | null,"discount_cents": number,"event_id": string,"external_reference": string,"hold_expires_at": string | null,"id": string,"marketplace_fee_cents": number,"method": Database["public"]['Enums']["payment_method"] | null,"mp_payment_id": string | null,"mp_preference_id": string | null,"notes": string | null,"paid_at": string | null,"quantity": number,"status": Database["public"]['Enums']["event_order_status"],"student_id": string | null,"studio_id": string,"ticket_type_id": string,"unit_price_cents": number,"updated_at": string
                  }
                  Insert: {
                    "access_token"?: string,"amount_cents": number,"buyer_email"?: string | null,"buyer_name": string,"buyer_phone"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"discount_cents"?: number,"event_id": string,"external_reference"?: string,"hold_expires_at"?: string | null,"id"?: string,"marketplace_fee_cents"?: number,"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"paid_at"?: string | null,"quantity": number,"status"?: Database["public"]['Enums']["event_order_status"],"student_id"?: string | null,"studio_id": string,"ticket_type_id": string,"unit_price_cents": number,"updated_at"?: string
                  }
                  Update: {
                    "access_token"?: string,"amount_cents"?: number,"buyer_email"?: string | null,"buyer_name"?: string,"buyer_phone"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"discount_cents"?: number,"event_id"?: string,"external_reference"?: string,"hold_expires_at"?: string | null,"id"?: string,"marketplace_fee_cents"?: number,"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"paid_at"?: string | null,"quantity"?: number,"status"?: Database["public"]['Enums']["event_order_status"],"student_id"?: string | null,"studio_id"?: string,"ticket_type_id"?: string,"unit_price_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_orders_coupon_fk"
      columns: ["studio_id","coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "event_orders_studio_id_event_id_fkey"
      columns: ["studio_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "event_orders_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_orders_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "event_orders_studio_id_ticket_type_id_fkey"
      columns: ["studio_id","ticket_type_id"]
isOneToOne: false
      referencedRelation: "event_ticket_types"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"event_ticket_types": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"is_active": boolean,"max_per_order": number,"name": string,"price_cents": number,"quantity": number | null,"sales_end_at": string | null,"sort": number,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"is_active"?: boolean,"max_per_order"?: number,"name": string,"price_cents": number,"quantity"?: number | null,"sales_end_at"?: string | null,"sort"?: number,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"is_active"?: boolean,"max_per_order"?: number,"name"?: string,"price_cents"?: number,"quantity"?: number | null,"sales_end_at"?: string | null,"sort"?: number,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_ticket_types_studio_id_event_id_fkey"
      columns: ["studio_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "event_ticket_types_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"event_tickets": {
                  Row: {
                    "checked_in_at": string | null,"checked_in_by": string | null,"created_at": string,"event_id": string,"id": string,"number": number,"order_id": string,"qr_token": string,"status": Database["public"]['Enums']["event_ticket_status"],"studio_id": string,"ticket_type_id": string
                  }
                  Insert: {
                    "checked_in_at"?: string | null,"checked_in_by"?: string | null,"created_at"?: string,"event_id": string,"id"?: string,"number": number,"order_id": string,"qr_token"?: string,"status"?: Database["public"]['Enums']["event_ticket_status"],"studio_id": string,"ticket_type_id": string
                  }
                  Update: {
                    "checked_in_at"?: string | null,"checked_in_by"?: string | null,"created_at"?: string,"event_id"?: string,"id"?: string,"number"?: number,"order_id"?: string,"qr_token"?: string,"status"?: Database["public"]['Enums']["event_ticket_status"],"studio_id"?: string,"ticket_type_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_tickets_studio_id_event_id_fkey"
      columns: ["studio_id","event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "event_tickets_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_tickets_studio_id_order_id_fkey"
      columns: ["studio_id","order_id"]
isOneToOne: false
      referencedRelation: "event_orders"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "event_tickets_studio_id_ticket_type_id_fkey"
      columns: ["studio_id","ticket_type_id"]
isOneToOne: false
      referencedRelation: "event_ticket_types"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"description": string | null,"ends_at": string | null,"id": string,"starts_at": string,"status": Database["public"]['Enums']["event_status"],"studio_id": string,"title": string,"updated_at": string,"venue": string | null
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"starts_at": string,"status"?: Database["public"]['Enums']["event_status"],"studio_id": string,"title": string,"updated_at"?: string,"venue"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["event_status"],"studio_id"?: string,"title"?: string,"updated_at"?: string,"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"formation_assessments": {
                  Row: {
                    "created_at": string,"due_on": string | null,"formation_id": string,"id": string,"kind": Database["public"]['Enums']["assessment_kind"],"studio_id": string,"title": string
                  }
                  Insert: {
                    "created_at"?: string,"due_on"?: string | null,"formation_id": string,"id"?: string,"kind"?: Database["public"]['Enums']["assessment_kind"],"studio_id": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"due_on"?: string | null,"formation_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["assessment_kind"],"studio_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "formation_assessments_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "formation_assessments_studio_id_formation_id_fkey"
      columns: ["studio_id","formation_id"]
isOneToOne: false
      referencedRelation: "formations"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"formation_attendance": {
                  Row: {
                    "checked_in_at": string,"checked_in_by": string | null,"enrollment_id": string,"formation_session_id": string,"studio_id": string
                  }
                  Insert: {
                    "checked_in_at"?: string,"checked_in_by"?: string | null,"enrollment_id": string,"formation_session_id": string,"studio_id": string
                  }
                  Update: {
                    "checked_in_at"?: string,"checked_in_by"?: string | null,"enrollment_id"?: string,"formation_session_id"?: string,"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "formation_attendance_studio_id_enrollment_id_fkey"
      columns: ["studio_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "formation_enrollments"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "formation_attendance_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "formation_attendance_studio_id_formation_session_id_fkey"
      columns: ["studio_id","formation_session_id"]
isOneToOne: false
      referencedRelation: "formation_sessions"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"formation_charges": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string | null,"due_on": string,"enrollment_id": string,"external_reference": string,"formation_id": string,"id": string,"kind": Database["public"]['Enums']["formation_charge_kind"],"method": Database["public"]['Enums']["payment_method"] | null,"mp_payment_id": string | null,"mp_preference_id": string | null,"notes": string | null,"number": number,"paid_at": string | null,"status": Database["public"]['Enums']["formation_charge_status"],"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string | null,"due_on": string,"enrollment_id": string,"external_reference"?: string,"formation_id": string,"id"?: string,"kind": Database["public"]['Enums']["formation_charge_kind"],"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"number"?: number,"paid_at"?: string | null,"status"?: Database["public"]['Enums']["formation_charge_status"],"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string | null,"due_on"?: string,"enrollment_id"?: string,"external_reference"?: string,"formation_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["formation_charge_kind"],"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"number"?: number,"paid_at"?: string | null,"status"?: Database["public"]['Enums']["formation_charge_status"],"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "formation_charges_studio_id_enrollment_id_fkey"
      columns: ["studio_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "formation_enrollments"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "formation_charges_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "formation_charges_studio_id_formation_id_fkey"
      columns: ["studio_id","formation_id"]
isOneToOne: false
      referencedRelation: "formations"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"formation_enrollments": {
                  Row: {
                    "application_message": string | null,"applied_at": string,"created_at": string,"decided_at": string | null,"decided_by": string | null,"enrolled_at": string | null,"formation_id": string,"id": string,"staff_notes": string | null,"status": Database["public"]['Enums']["enrollment_status"],"student_id": string,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "application_message"?: string | null,"applied_at"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"enrolled_at"?: string | null,"formation_id": string,"id"?: string,"staff_notes"?: string | null,"status"?: Database["public"]['Enums']["enrollment_status"],"student_id": string,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "application_message"?: string | null,"applied_at"?: string,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"enrolled_at"?: string | null,"formation_id"?: string,"id"?: string,"staff_notes"?: string | null,"status"?: Database["public"]['Enums']["enrollment_status"],"student_id"?: string,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "formation_enrollments_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "formation_enrollments_studio_id_formation_id_fkey"
      columns: ["studio_id","formation_id"]
isOneToOne: false
      referencedRelation: "formations"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "formation_enrollments_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"formation_grades": {
                  Row: {
                    "assessment_id": string,"enrollment_id": string,"feedback": string | null,"grade": number | null,"passed": boolean | null,"studio_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "assessment_id": string,"enrollment_id": string,"feedback"?: string | null,"grade"?: number | null,"passed"?: boolean | null,"studio_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "assessment_id"?: string,"enrollment_id"?: string,"feedback"?: string | null,"grade"?: number | null,"passed"?: boolean | null,"studio_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "formation_grades_studio_id_assessment_id_fkey"
      columns: ["studio_id","assessment_id"]
isOneToOne: false
      referencedRelation: "formation_assessments"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "formation_grades_studio_id_enrollment_id_fkey"
      columns: ["studio_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "formation_enrollments"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "formation_grades_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"formation_materials": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"formation_id": string,"id": string,"kind": string,"mime_type": string | null,"session_id": string | null,"size_bytes": number | null,"storage_path": string | null,"studio_id": string,"title": string,"url": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"formation_id": string,"id"?: string,"kind": string,"mime_type"?: string | null,"session_id"?: string | null,"size_bytes"?: number | null,"storage_path"?: string | null,"studio_id": string,"title": string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"formation_id"?: string,"id"?: string,"kind"?: string,"mime_type"?: string | null,"session_id"?: string | null,"size_bytes"?: number | null,"storage_path"?: string | null,"studio_id"?: string,"title"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "formation_materials_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "formation_materials_studio_id_formation_id_fkey"
      columns: ["studio_id","formation_id"]
isOneToOne: false
      referencedRelation: "formations"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "formation_materials_studio_id_session_id_fkey"
      columns: ["studio_id","session_id"]
isOneToOne: false
      referencedRelation: "formation_sessions"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"formation_sessions": {
                  Row: {
                    "created_at": string,"ends_at": string,"formation_id": string,"id": string,"location": string | null,"notes": string | null,"online_url": string | null,"starts_at": string,"studio_id": string,"teacher_member_id": string | null,"teacher_name": string | null,"title": string
                  }
                  Insert: {
                    "created_at"?: string,"ends_at": string,"formation_id": string,"id"?: string,"location"?: string | null,"notes"?: string | null,"online_url"?: string | null,"starts_at": string,"studio_id": string,"teacher_member_id"?: string | null,"teacher_name"?: string | null,"title": string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"formation_id"?: string,"id"?: string,"location"?: string | null,"notes"?: string | null,"online_url"?: string | null,"starts_at"?: string,"studio_id"?: string,"teacher_member_id"?: string | null,"teacher_name"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "formation_sessions_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "formation_sessions_studio_id_formation_id_fkey"
      columns: ["studio_id","formation_id"]
isOneToOne: false
      referencedRelation: "formations"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "formation_sessions_studio_id_teacher_member_id_fkey"
      columns: ["studio_id","teacher_member_id"]
isOneToOne: false
      referencedRelation: "studio_members"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"formations": {
                  Row: {
                    "capacity": number | null,"created_at": string,"description": string | null,"ends_on": string,"enrollment_fee_cents": number,"enrollment_open": boolean,"first_due_on": string | null,"full_payment_cents": number | null,"id": string,"installment_cents": number,"installments_count": number,"min_attendance_pct": number,"requires_approval": boolean,"starts_on": string,"status": Database["public"]['Enums']["formation_status"],"studio_id": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "capacity"?: number | null,"created_at"?: string,"description"?: string | null,"ends_on": string,"enrollment_fee_cents"?: number,"enrollment_open"?: boolean,"first_due_on"?: string | null,"full_payment_cents"?: number | null,"id"?: string,"installment_cents"?: number,"installments_count"?: number,"min_attendance_pct"?: number,"requires_approval"?: boolean,"starts_on": string,"status"?: Database["public"]['Enums']["formation_status"],"studio_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "capacity"?: number | null,"created_at"?: string,"description"?: string | null,"ends_on"?: string,"enrollment_fee_cents"?: number,"enrollment_open"?: boolean,"first_due_on"?: string | null,"full_payment_cents"?: number | null,"id"?: string,"installment_cents"?: number,"installments_count"?: number,"min_attendance_pct"?: number,"requires_approval"?: boolean,"starts_on"?: string,"status"?: Database["public"]['Enums']["formation_status"],"studio_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "formations_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"founder_leads": {
                  Row: {
                    "created_at": string,"disciplines": string | null,"email": string,"id": number,"kind": string,"message": string | null,"name": string,"phone": string | null,"students_count": string | null,"studio_name": string | null
                  }
                  Insert: {
                    "created_at"?: string,"disciplines"?: string | null,"email": string,"id"?: never,"kind": string,"message"?: string | null,"name": string,"phone"?: string | null,"students_count"?: string | null,"studio_name"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"disciplines"?: string | null,"email"?: string,"id"?: never,"kind"?: string,"message"?: string | null,"name"?: string,"phone"?: string | null,"students_count"?: string | null,"studio_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"gift_cards": {
                  Row: {
                    "access_token": string,"amount_cents": number,"buyer_email": string | null,"buyer_name": string,"code": string,"created_at": string,"created_by": string | null,"credits": number | null,"expires_at": string | null,"external_reference": string,"id": string,"message": string | null,"method": Database["public"]['Enums']["payment_method"] | null,"mp_payment_id": string | null,"mp_preference_id": string | null,"notes": string | null,"pack_name": string,"pack_product_id": string | null,"paid_at": string | null,"recipient_name": string | null,"redeemed_at": string | null,"redeemed_student_id": string | null,"status": Database["public"]['Enums']["gift_card_status"],"student_pack_id": string | null,"studio_id": string,"updated_at": string,"validity_days": number
                  }
                  Insert: {
                    "access_token"?: string,"amount_cents": number,"buyer_email"?: string | null,"buyer_name": string,"code"?: string,"created_at"?: string,"created_by"?: string | null,"credits"?: number | null,"expires_at"?: string | null,"external_reference"?: string,"id"?: string,"message"?: string | null,"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"pack_name": string,"pack_product_id"?: string | null,"paid_at"?: string | null,"recipient_name"?: string | null,"redeemed_at"?: string | null,"redeemed_student_id"?: string | null,"status"?: Database["public"]['Enums']["gift_card_status"],"student_pack_id"?: string | null,"studio_id": string,"updated_at"?: string,"validity_days": number
                  }
                  Update: {
                    "access_token"?: string,"amount_cents"?: number,"buyer_email"?: string | null,"buyer_name"?: string,"code"?: string,"created_at"?: string,"created_by"?: string | null,"credits"?: number | null,"expires_at"?: string | null,"external_reference"?: string,"id"?: string,"message"?: string | null,"method"?: Database["public"]['Enums']["payment_method"] | null,"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"pack_name"?: string,"pack_product_id"?: string | null,"paid_at"?: string | null,"recipient_name"?: string | null,"redeemed_at"?: string | null,"redeemed_student_id"?: string | null,"status"?: Database["public"]['Enums']["gift_card_status"],"student_pack_id"?: string | null,"studio_id"?: string,"updated_at"?: string,"validity_days"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "gift_cards_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gift_cards_studio_id_pack_product_id_fkey"
      columns: ["studio_id","pack_product_id"]
isOneToOne: false
      referencedRelation: "pack_products"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "gift_cards_studio_id_redeemed_student_id_fkey"
      columns: ["studio_id","redeemed_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "gift_cards_studio_id_student_pack_id_fkey"
      columns: ["studio_id","student_pack_id"]
isOneToOne: false
      referencedRelation: "student_balances"
      referencedColumns: ["studio_id","student_pack_id"]
    },{
      foreignKeyName: "gift_cards_studio_id_student_pack_id_fkey"
      columns: ["studio_id","student_pack_id"]
isOneToOne: false
      referencedRelation: "student_packs"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"giroa_coupons": {
                  Row: {
                    "auto": boolean,"code": string,"created_at": string,"discount_pct": number,"is_active": boolean,"max_uses": number | null,"plan": Database["public"]['Enums']["studio_plan"] | null,"used_count": number
                  }
                  Insert: {
                    "auto"?: boolean,"code": string,"created_at"?: string,"discount_pct": number,"is_active"?: boolean,"max_uses"?: number | null,"plan"?: Database["public"]['Enums']["studio_plan"] | null,"used_count"?: number
                  }
                  Update: {
                    "auto"?: boolean,"code"?: string,"created_at"?: string,"discount_pct"?: number,"is_active"?: boolean,"max_uses"?: number | null,"plan"?: Database["public"]['Enums']["studio_plan"] | null,"used_count"?: number
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
                    "capacity": number,"created_at": string,"description": string | null,"discipline_key": string,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["offering_kind"],"level": string | null,"pack_allowed": boolean,"price_cents": number | null,"role_balance_max_diff": number | null,"studio_id": string,"teacher_member_id": string | null,"teacher_name": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "capacity": number,"created_at"?: string,"description"?: string | null,"discipline_key": string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["offering_kind"],"level"?: string | null,"pack_allowed"?: boolean,"price_cents"?: number | null,"role_balance_max_diff"?: number | null,"studio_id": string,"teacher_member_id"?: string | null,"teacher_name"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "capacity"?: number,"created_at"?: string,"description"?: string | null,"discipline_key"?: string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["offering_kind"],"level"?: string | null,"pack_allowed"?: boolean,"price_cents"?: number | null,"role_balance_max_diff"?: number | null,"studio_id"?: string,"teacher_member_id"?: string | null,"teacher_name"?: string | null,"title"?: string,"updated_at"?: string
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
                    "created_at": string,"credits": number | null,"description": string | null,"id": string,"is_active": boolean,"is_couple": boolean,"is_membership": boolean,"name": string,"price_cents": number,"rules": NonNullable<Json>,"sort": number,"studio_id": string,"updated_at": string,"validity_days": number
                  }
                  Insert: {
                    "created_at"?: string,"credits"?: number | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_couple"?: boolean,"is_membership"?: boolean,"name": string,"price_cents": number,"rules"?: NonNullable<Json>,"sort"?: number,"studio_id": string,"updated_at"?: string,"validity_days": number
                  }
                  Update: {
                    "created_at"?: string,"credits"?: number | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_couple"?: boolean,"is_membership"?: boolean,"name"?: string,"price_cents"?: number,"rules"?: NonNullable<Json>,"sort"?: number,"studio_id"?: string,"updated_at"?: string,"validity_days"?: number
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
                    "amount_cents": number,"coupon_id": string | null,"created_at": string,"created_by": string | null,"currency": string,"discount_cents": number,"external_reference": string,"id": string,"marketplace_fee_cents": number,"method": Database["public"]['Enums']["payment_method"],"mp_payment_id": string | null,"mp_preference_id": string | null,"notes": string | null,"pack_product_id": string | null,"paid_at": string | null,"partner_student_id": string | null,"purpose": Database["public"]['Enums']["payment_purpose"],"status": Database["public"]['Enums']["payment_status"],"student_id": string,"studio_id": string,"subscription_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount_cents": number,"coupon_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"discount_cents"?: number,"external_reference"?: string,"id"?: string,"marketplace_fee_cents"?: number,"method": Database["public"]['Enums']["payment_method"],"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"pack_product_id"?: string | null,"paid_at"?: string | null,"partner_student_id"?: string | null,"purpose"?: Database["public"]['Enums']["payment_purpose"],"status"?: Database["public"]['Enums']["payment_status"],"student_id": string,"studio_id": string,"subscription_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"coupon_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"discount_cents"?: number,"external_reference"?: string,"id"?: string,"marketplace_fee_cents"?: number,"method"?: Database["public"]['Enums']["payment_method"],"mp_payment_id"?: string | null,"mp_preference_id"?: string | null,"notes"?: string | null,"pack_product_id"?: string | null,"paid_at"?: string | null,"partner_student_id"?: string | null,"purpose"?: Database["public"]['Enums']["payment_purpose"],"status"?: Database["public"]['Enums']["payment_status"],"student_id"?: string,"studio_id"?: string,"subscription_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_coupon_fk"
      columns: ["studio_id","coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["studio_id","id"]
    },{
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
    },{
      foreignKeyName: "payments_studio_id_subscription_id_fkey"
      columns: ["studio_id","subscription_id"]
isOneToOne: false
      referencedRelation: "student_subscriptions"
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
                },"referrals": {
                  Row: {
                    "created_at": string,"credits": number | null,"id": string,"referred_student_id": string,"referrer_student_id": string,"rewarded_at": string | null,"status": Database["public"]['Enums']["referral_status"],"studio_id": string
                  }
                  Insert: {
                    "created_at"?: string,"credits"?: number | null,"id"?: string,"referred_student_id": string,"referrer_student_id": string,"rewarded_at"?: string | null,"status"?: Database["public"]['Enums']["referral_status"],"studio_id": string
                  }
                  Update: {
                    "created_at"?: string,"credits"?: number | null,"id"?: string,"referred_student_id"?: string,"referrer_student_id"?: string,"rewarded_at"?: string | null,"status"?: Database["public"]['Enums']["referral_status"],"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "referrals_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "referrals_studio_id_referred_student_id_fkey"
      columns: ["studio_id","referred_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "referrals_studio_id_referrer_student_id_fkey"
      columns: ["studio_id","referrer_student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"session_waitlist": {
                  Row: {
                    "created_at": string,"dance_role": Database["public"]['Enums']["dance_role"] | null,"id": string,"notified_at": string | null,"session_id": string,"status": Database["public"]['Enums']["waitlist_status"],"student_id": string,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"dance_role"?: Database["public"]['Enums']["dance_role"] | null,"id"?: string,"notified_at"?: string | null,"session_id": string,"status"?: Database["public"]['Enums']["waitlist_status"],"student_id": string,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"dance_role"?: Database["public"]['Enums']["dance_role"] | null,"id"?: string,"notified_at"?: string | null,"session_id"?: string,"status"?: Database["public"]['Enums']["waitlist_status"],"student_id"?: string,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_waitlist_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_waitlist_studio_id_session_id_fkey"
      columns: ["studio_id","session_id"]
isOneToOne: false
      referencedRelation: "session_occupancy"
      referencedColumns: ["studio_id","session_id"]
    },{
      foreignKeyName: "session_waitlist_studio_id_session_id_fkey"
      columns: ["studio_id","session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "session_waitlist_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
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
                    "created_at": string,"credits_total": number | null,"credits_used": number,"expires_at": string,"frozen_at": string | null,"id": string,"name": string,"pack_product_id": string | null,"partner_student_id": string | null,"payment_id": string | null,"rules": NonNullable<Json>,"starts_at": string,"status": Database["public"]['Enums']["pack_status"],"student_id": string,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"credits_total"?: number | null,"credits_used"?: number,"expires_at": string,"frozen_at"?: string | null,"id"?: string,"name": string,"pack_product_id"?: string | null,"partner_student_id"?: string | null,"payment_id"?: string | null,"rules"?: NonNullable<Json>,"starts_at"?: string,"status"?: Database["public"]['Enums']["pack_status"],"student_id": string,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"credits_total"?: number | null,"credits_used"?: number,"expires_at"?: string,"frozen_at"?: string | null,"id"?: string,"name"?: string,"pack_product_id"?: string | null,"partner_student_id"?: string | null,"payment_id"?: string | null,"rules"?: NonNullable<Json>,"starts_at"?: string,"status"?: Database["public"]['Enums']["pack_status"],"student_id"?: string,"studio_id"?: string,"updated_at"?: string
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
                },"student_subscriptions": {
                  Row: {
                    "amount_cents": number,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"failed_at": string | null,"id": string,"last_charge_at": string | null,"last_error": string | null,"mp_preapproval_id": string | null,"name": string,"next_charge_at": string | null,"pack_product_id": string,"status": Database["public"]['Enums']["membership_status"],"student_id": string,"studio_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_cents": number,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"failed_at"?: string | null,"id"?: string,"last_charge_at"?: string | null,"last_error"?: string | null,"mp_preapproval_id"?: string | null,"name": string,"next_charge_at"?: string | null,"pack_product_id": string,"status"?: Database["public"]['Enums']["membership_status"],"student_id": string,"studio_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"failed_at"?: string | null,"id"?: string,"last_charge_at"?: string | null,"last_error"?: string | null,"mp_preapproval_id"?: string | null,"name"?: string,"next_charge_at"?: string | null,"pack_product_id"?: string,"status"?: Database["public"]['Enums']["membership_status"],"student_id"?: string,"studio_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_subscriptions_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_subscriptions_studio_id_pack_product_id_fkey"
      columns: ["studio_id","pack_product_id"]
isOneToOne: false
      referencedRelation: "pack_products"
      referencedColumns: ["studio_id","id"]
    },{
      foreignKeyName: "student_subscriptions_studio_id_student_id_fkey"
      columns: ["studio_id","student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["studio_id","id"]
    }
                  ]
                },"students": {
                  Row: {
                    "created_at": string,"default_role": Database["public"]['Enums']["dance_role"] | null,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"phone": string | null,"qr_token": string,"referral_code": string,"studio_id": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"default_role"?: Database["public"]['Enums']["dance_role"] | null,"email"?: string | null,"full_name": string,"id"?: string,"is_active"?: boolean,"phone"?: string | null,"qr_token"?: string,"referral_code"?: string,"studio_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"default_role"?: Database["public"]['Enums']["dance_role"] | null,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"phone"?: string | null,"qr_token"?: string,"referral_code"?: string,"studio_id"?: string,"updated_at"?: string,"user_id"?: string | null
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
                },"studio_checkin_codes": {
                  Row: {
                    "code": string,"rotated_at": string,"studio_id": string
                  }
                  Insert: {
                    "code"?: string,"rotated_at"?: string,"studio_id": string
                  }
                  Update: {
                    "code"?: string,"rotated_at"?: string,"studio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studio_checkin_codes_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: true
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"studio_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"can_take_payments": boolean,"cancelled_at": string | null,"created_at": string,"display_name": string | null,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["member_role"],"studio_id": string,"token": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"can_take_payments"?: boolean,"cancelled_at"?: string | null,"created_at"?: string,"display_name"?: string | null,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role": Database["public"]['Enums']["member_role"],"studio_id": string,"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"can_take_payments"?: boolean,"cancelled_at"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"studio_id"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "studio_invites_studio_id_fkey"
      columns: ["studio_id"]
isOneToOne: false
      referencedRelation: "studios"
      referencedColumns: ["id"]
    }
                  ]
                },"studio_members": {
                  Row: {
                    "can_take_payments": boolean,"created_at": string,"display_name": string | null,"id": string,"role": Database["public"]['Enums']["member_role"],"studio_id": string,"user_id": string
                  }
                  Insert: {
                    "can_take_payments"?: boolean,"created_at"?: string,"display_name"?: string | null,"id"?: string,"role": Database["public"]['Enums']["member_role"],"studio_id": string,"user_id": string
                  }
                  Update: {
                    "can_take_payments"?: boolean,"created_at"?: string,"display_name"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"studio_id"?: string,"user_id"?: string
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
                    "amount_cents": number | null,"billing_cycle": Database["public"]['Enums']["billing_cycle"],"cancelled_at": string | null,"coupon_code": string | null,"created_at": string,"current_period_end": string | null,"discount_pct": number,"founder_discount_pct": number,"grace_until": string | null,"last_payment_at": string | null,"mp_preapproval_id": string | null,"notes": string | null,"payment_method": string,"plan": Database["public"]['Enums']["studio_plan"] | null,"status": Database["public"]['Enums']["subscription_status"],"studio_id": string,"trial_ends_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount_cents"?: number | null,"billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"cancelled_at"?: string | null,"coupon_code"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"discount_pct"?: number,"founder_discount_pct"?: number,"grace_until"?: string | null,"last_payment_at"?: string | null,"mp_preapproval_id"?: string | null,"notes"?: string | null,"payment_method"?: string,"plan"?: Database["public"]['Enums']["studio_plan"] | null,"status"?: Database["public"]['Enums']["subscription_status"],"studio_id": string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number | null,"billing_cycle"?: Database["public"]['Enums']["billing_cycle"],"cancelled_at"?: string | null,"coupon_code"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"discount_pct"?: number,"founder_discount_pct"?: number,"grace_until"?: string | null,"last_payment_at"?: string | null,"mp_preapproval_id"?: string | null,"notes"?: string | null,"payment_method"?: string,"plan"?: Database["public"]['Enums']["studio_plan"] | null,"status"?: Database["public"]['Enums']["subscription_status"],"studio_id"?: string,"trial_ends_at"?: string | null,"updated_at"?: string
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
                    "brand_color": string,"cancel_window_hours": number,"cover_path": string | null,"created_at": string,"id": string,"is_active": boolean,"logo_path": string | null,"name": string,"plan": Database["public"]['Enums']["studio_plan"],"referral_credits": number,"slug": string,"timezone": string,"trial_class_enabled": boolean,"updated_at": string
                  }
                  Insert: {
                    "brand_color"?: string,"cancel_window_hours"?: number,"cover_path"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"logo_path"?: string | null,"name": string,"plan"?: Database["public"]['Enums']["studio_plan"],"referral_credits"?: number,"slug": string,"timezone"?: string,"trial_class_enabled"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "brand_color"?: string,"cancel_window_hours"?: number,"cover_path"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"logo_path"?: string | null,"name"?: string,"plan"?: Database["public"]['Enums']["studio_plan"],"referral_credits"?: number,"slug"?: string,"timezone"?: string,"trial_class_enabled"?: boolean,"updated_at"?: string
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
            "accept_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"active_students_count":
{ Args: { "p_studio_id": string }; Returns: number
                           },
"apply_to_audition":
{ Args: { "p_answers": Json,"p_audition_id": string,"p_slot_id"?: string,"p_video_url"?: string }; Returns: {
              "answers": NonNullable<Json>,
"audition_id": string,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"external_reference": string,
"fee_cents": number,
"formation_id": string,
"hold_expires_at": string | null,
"id": string,
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"paid_at": string | null,
"slot_id": string | null,
"staff_notes": string | null,
"status": Database["public"]['Enums']["audition_application_status"],
"student_id": string,
"studio_id": string,
"updated_at": string,
"video_url": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "audition_applications"
        isOneToOne: true
        isSetofReturn: false
      } },
"apply_to_formation":
{ Args: { "p_formation_id": string,"p_message"?: string }; Returns: {
              "application_message": string | null,
"applied_at": string,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"enrolled_at": string | null,
"formation_id": string,
"id": string,
"staff_notes": string | null,
"status": Database["public"]['Enums']["enrollment_status"],
"student_id": string,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "formation_enrollments"
        isOneToOne: true
        isSetofReturn: false
      } },
"audition_slot_availability":
{ Args: { "p_audition_id": string }; Returns: {
              "ends_at": string,"remaining": number,"slot_id": string,"starts_at": string
            }[]
                           },
"book_session":
{ Args: { "p_role"?: Database["public"]['Enums']["dance_role"],"p_session_id": string,"p_student_id"?: string,"p_trial"?: boolean }; Returns: {
              "cancelled_at": string | null,
"cancelled_by": string | null,
"checked_in_at": string | null,
"created_at": string,
"created_by": string | null,
"credit_refunded": boolean,
"dance_role": Database["public"]['Enums']["dance_role"] | null,
"id": string,
"is_trial": boolean,
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
"book_session_paid":
{ Args: { "p_role"?: Database["public"]['Enums']["dance_role"],"p_session_id": string }; Returns: Json
                           },
"cancel_audition_application":
{ Args: { "p_application_id": string }; Returns: undefined
                           },
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
"is_trial": boolean,
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
"cancel_event_order":
{ Args: { "p_order_id": string,"p_reason"?: string }; Returns: {
              "access_token": string,
"amount_cents": number,
"buyer_email": string | null,
"buyer_name": string,
"buyer_phone": string | null,
"coupon_id": string | null,
"created_at": string,
"created_by": string | null,
"discount_cents": number,
"event_id": string,
"external_reference": string,
"hold_expires_at": string | null,
"id": string,
"marketplace_fee_cents": number,
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"notes": string | null,
"paid_at": string | null,
"quantity": number,
"status": Database["public"]['Enums']["event_order_status"],
"student_id": string | null,
"studio_id": string,
"ticket_type_id": string,
"unit_price_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "event_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_gift_card":
{ Args: { "p_gift_card_id": string,"p_reason"?: string }; Returns: undefined
                           },
"cancel_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"cancel_membership":
{ Args: { "p_subscription_id": string }; Returns: {
              "amount_cents": number,
"cancelled_at": string | null,
"cancelled_by": string | null,
"created_at": string,
"failed_at": string | null,
"id": string,
"last_charge_at": string | null,
"last_error": string | null,
"mp_preapproval_id": string | null,
"name": string,
"next_charge_at": string | null,
"pack_product_id": string,
"status": Database["public"]['Enums']["membership_status"],
"student_id": string,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "student_subscriptions"
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
"is_trial": boolean,
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
"check_in_ticket":
{ Args: { "p_event_id": string,"p_qr_token": string }; Returns: Json
                           },
"check_slug":
{ Args: { "p_slug": string }; Returns: string
                           },
"choose_full_payment":
{ Args: { "p_enrollment_id": string }; Returns: {
              "amount_cents": number,
"created_at": string,
"created_by": string | null,
"due_on": string,
"enrollment_id": string,
"external_reference": string,
"formation_id": string,
"id": string,
"kind": Database["public"]['Enums']["formation_charge_kind"],
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"notes": string | null,
"number": number,
"paid_at": string | null,
"status": Database["public"]['Enums']["formation_charge_status"],
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "formation_charges"
        isOneToOne: true
        isSetofReturn: false
      } },
"choose_trial_plan":
{ Args: { "p_plan": Database["public"]['Enums']["studio_plan"],"p_studio_id": string }; Returns: undefined
                           },
"claim_notifications":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,"id": number,"payload": Json,"student_name": string,"studio_name": string,"studio_slug": string,"studio_timezone": string,"template": string,"to_address": string
            }[]
                           },
"claim_referral":
{ Args: { "p_code": string,"p_studio_id": string }; Returns: boolean
                           },
"create_event_order":
{ Args: { "p_buyer_email": string,"p_buyer_name": string,"p_buyer_phone"?: string,"p_coupon"?: string,"p_quantity": number,"p_ticket_type_id": string }; Returns: {
              "access_token": string,
"amount_cents": number,
"buyer_email": string | null,
"buyer_name": string,
"buyer_phone": string | null,
"coupon_id": string | null,
"created_at": string,
"created_by": string | null,
"discount_cents": number,
"event_id": string,
"external_reference": string,
"hold_expires_at": string | null,
"id": string,
"marketplace_fee_cents": number,
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"notes": string | null,
"paid_at": string | null,
"quantity": number,
"status": Database["public"]['Enums']["event_order_status"],
"student_id": string | null,
"studio_id": string,
"ticket_type_id": string,
"unit_price_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "event_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_gift_card_order":
{ Args: { "p_buyer_email": string,"p_buyer_name": string,"p_message"?: string,"p_pack_product_id": string,"p_recipient_name"?: string }; Returns: {
              "access_token": string,
"amount_cents": number,
"buyer_email": string | null,
"buyer_name": string,
"code": string,
"created_at": string,
"created_by": string | null,
"credits": number | null,
"expires_at": string | null,
"external_reference": string,
"id": string,
"message": string | null,
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"notes": string | null,
"pack_name": string,
"pack_product_id": string | null,
"paid_at": string | null,
"recipient_name": string | null,
"redeemed_at": string | null,
"redeemed_student_id": string | null,
"status": Database["public"]['Enums']["gift_card_status"],
"student_pack_id": string | null,
"studio_id": string,
"updated_at": string,
"validity_days": number
            }
                          SetofOptions: {
        from: "*"
        to: "gift_cards"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_pack_payment":
{ Args: { "p_coupon"?: string,"p_pack_product_id": string }; Returns: {
              "amount_cents": number,
"coupon_id": string | null,
"created_at": string,
"created_by": string | null,
"currency": string,
"discount_cents": number,
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
"subscription_id": string | null,
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
"cover_path": string | null,
"created_at": string,
"id": string,
"is_active": boolean,
"logo_path": string | null,
"name": string,
"plan": Database["public"]['Enums']["studio_plan"],
"referral_credits": number,
"slug": string,
"timezone": string,
"trial_class_enabled": boolean,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "studios"
        isOneToOne: true
        isSetofReturn: false
      } },
"decide_enrollment":
{ Args: { "p_approve": boolean,"p_enrollment_id": string,"p_notes"?: string }; Returns: {
              "application_message": string | null,
"applied_at": string,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"enrolled_at": string | null,
"formation_id": string,
"id": string,
"staff_notes": string | null,
"status": Database["public"]['Enums']["enrollment_status"],
"student_id": string,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "formation_enrollments"
        isOneToOne: true
        isSetofReturn: false
      } },
"dismiss_announcement":
{ Args: { "p_announcement_id": string }; Returns: undefined
                           },
"enrollment_progress":
{ Args: { "p_enrollment_id": string }; Returns: Json
                           },
"event_availability":
{ Args: { "p_event_id": string }; Returns: {
              "on_sale": boolean,"remaining": number,"ticket_type_id": string
            }[]
                           },
"expire_class_purchases":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"expire_event_orders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"expire_gift_cards":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"expire_packs":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finish_notification":
{ Args: { "p_error"?: string,"p_id": number,"p_ok": boolean }; Returns: undefined
                           },
"formation_check_in":
{ Args: { "p_enrollment_id"?: string,"p_qr_token"?: string,"p_session_id": string }; Returns: Json
                           },
"formation_set_grade":
{ Args: { "p_assessment_id": string,"p_enrollment_id": string,"p_feedback"?: string,"p_grade": number,"p_passed": boolean }; Returns: undefined
                           },
"generate_sessions":
{ Args: { "p_from"?: string,"p_studio_id": string,"p_weeks"?: number }; Returns: number
                           },
"get_event_order":
{ Args: { "p_access_token": string }; Returns: Json
                           },
"get_gift_card":
{ Args: { "p_access_token": string }; Returns: Json
                           },
"get_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"giroa_apply_preapproval":
{ Args: { "p_amount_cents": number,"p_coupon": string,"p_cycle": Database["public"]['Enums']["billing_cycle"],"p_discount_pct": number,"p_next_payment_at"?: string,"p_plan": Database["public"]['Enums']["studio_plan"],"p_preapproval_id": string,"p_status": string,"p_studio_id": string }; Returns: Json
                           },
"giroa_apply_subscription_charge":
{ Args: { "p_approved": boolean,"p_next_payment_at"?: string,"p_preapproval_id": string }; Returns: undefined
                           },
"giroa_founder_spots":
{ Args: Record<PropertyKey, never>; Returns: {
              "discount_pct": number,"plan": Database["public"]['Enums']["studio_plan"],"spots_left": number
            }[]
                           },
"giroa_quote":
{ Args: { "p_coupon"?: string,"p_cycle": Database["public"]['Enums']["billing_cycle"],"p_plan": Database["public"]['Enums']["studio_plan"] }; Returns: Json
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
"rules": NonNullable<Json>,
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
"invite_member":
{ Args: { "p_can_take_payments"?: boolean,"p_display_name"?: string,"p_email": string,"p_role": Database["public"]['Enums']["member_role"],"p_studio_id": string }; Returns: {
              "accepted_at": string | null,
"accepted_by": string | null,
"can_take_payments": boolean,
"cancelled_at": string | null,
"created_at": string,
"display_name": string | null,
"email": string,
"expires_at": string,
"id": string,
"invited_by": string | null,
"role": Database["public"]['Enums']["member_role"],
"studio_id": string,
"token": string
            }
                          SetofOptions: {
        from: "*"
        to: "studio_invites"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"referral_code": string,
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
"join_waitlist":
{ Args: { "p_role"?: Database["public"]['Enums']["dance_role"],"p_session_id": string }; Returns: {
              "created_at": string,
"dance_role": Database["public"]['Enums']["dance_role"] | null,
"id": string,
"notified_at": string | null,
"session_id": string,
"status": Database["public"]['Enums']["waitlist_status"],
"student_id": string,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "session_waitlist"
        isOneToOne: true
        isSetofReturn: false
      } },
"leave_waitlist":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"list_public_sessions":
{ Args: { "p_from": string,"p_slug": string,"p_to": string }; Returns: {
              "booked_count": number,"capacity": number,"description": string,"discipline_key": string,"discipline_name": string,"ends_at": string,"follower_count": number,"kind": Database["public"]['Enums']["offering_kind"],"leader_count": number,"level": string,"offering_id": string,"pack_allowed": boolean,"price_cents": number,"role_balance": boolean,"role_balance_max_diff": number,"session_id": string,"spots_left": number,"starts_at": string,"status": Database["public"]['Enums']["session_status"],"teacher_name": string,"title": string
            }[]
                           },
"mp_apply_audition_payment":
{ Args: { "p_amount_cents": number,"p_external_reference": string,"p_mp_payment_id": string,"p_mp_status": string }; Returns: Json
                           },
"mp_apply_class_payment":
{ Args: { "p_amount_cents": number,"p_external_reference": string,"p_mp_payment_id": string,"p_mp_status": string }; Returns: Json
                           },
"mp_apply_event_payment":
{ Args: { "p_amount_cents": number,"p_external_reference": string,"p_mp_payment_id": string,"p_mp_status": string,"p_paid_at"?: string }; Returns: Json
                           },
"mp_apply_formation_payment":
{ Args: { "p_amount_cents": number,"p_external_reference": string,"p_mp_payment_id": string,"p_mp_status": string }; Returns: Json
                           },
"mp_apply_gift_payment":
{ Args: { "p_amount_cents": number,"p_external_reference": string,"p_mp_payment_id": string,"p_mp_status": string }; Returns: Json
                           },
"mp_apply_membership":
{ Args: { "p_next_charge_at"?: string,"p_preapproval_id": string,"p_status": string,"p_subscription_id": string }; Returns: Json
                           },
"mp_apply_membership_charge":
{ Args: { "p_amount_cents": number,"p_approved": boolean,"p_error"?: string,"p_mp_payment_id": string,"p_next_charge_at"?: string,"p_paid_at"?: string,"p_preapproval_id": string }; Returns: Json
                           },
"mp_apply_payment":
{ Args: { "p_amount_cents": number,"p_external_reference": string,"p_mp_payment_id": string,"p_mp_status": string,"p_paid_at"?: string }; Returns: Json
                           },
"mp_connection_status":
{ Args: { "p_studio_id": string }; Returns: {
              "connected": boolean,"expires_at": string,"live_mode": boolean,"mp_user_id": string
            }[]
                           },
"mp_link_membership":
{ Args: { "p_preapproval_id": string,"p_subscription_id": string }; Returns: undefined
                           },
"my_trial_available":
{ Args: { "p_studio_id": string }; Returns: boolean
                           },
"my_waitlist":
{ Args: { "p_studio_id": string }; Returns: {
              "dance_role": Database["public"]['Enums']["dance_role"],"position": number,"session_id": string
            }[]
                           },
"preview_coupon":
{ Args: { "p_base_cents": number,"p_code": string,"p_studio_id": string,"p_target": Database["public"]['Enums']["coupon_target"] }; Returns: Json
                           },
"publish_announcement":
{ Args: { "p_audience"?: string,"p_body": string,"p_formation_id"?: string,"p_offering_id"?: string,"p_send_email"?: boolean,"p_studio_id": string,"p_title": string,"p_visible_until"?: string }; Returns: Json
                           },
"record_audition_payment":
{ Args: { "p_application_id": string,"p_method": Database["public"]['Enums']["payment_method"] }; Returns: undefined
                           },
"record_class_payment":
{ Args: { "p_method": Database["public"]['Enums']["payment_method"],"p_purchase_id": string }; Returns: Json
                           },
"record_formation_payment":
{ Args: { "p_charge_id": string,"p_method": Database["public"]['Enums']["payment_method"] }; Returns: {
              "amount_cents": number,
"created_at": string,
"created_by": string | null,
"due_on": string,
"enrollment_id": string,
"external_reference": string,
"formation_id": string,
"id": string,
"kind": Database["public"]['Enums']["formation_charge_kind"],
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"notes": string | null,
"number": number,
"paid_at": string | null,
"status": Database["public"]['Enums']["formation_charge_status"],
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "formation_charges"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_manual_payment":
{ Args: { "p_amount_cents"?: number,"p_method": Database["public"]['Enums']["payment_method"],"p_notes"?: string,"p_pack_product_id": string,"p_partner_student_id"?: string,"p_student_id": string }; Returns: Json
                           },
"redeem_gift_card":
{ Args: { "p_code": string,"p_student_id"?: string }; Returns: Json
                           },
"remove_member":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"remove_schedule":
{ Args: { "p_schedule_id": string }; Returns: number
                           },
"rotate_checkin_code":
{ Args: { "p_studio_id": string }; Returns: string
                           },
"self_check_in":
{ Args: { "p_code": string,"p_role"?: Database["public"]['Enums']["dance_role"],"p_session_id"?: string }; Returns: Json
                           },
"sell_class_manual":
{ Args: { "p_method": Database["public"]['Enums']["payment_method"],"p_role"?: Database["public"]['Enums']["dance_role"],"p_session_id": string,"p_student_id": string }; Returns: Json
                           },
"sell_event_tickets_manual":
{ Args: { "p_buyer_email"?: string,"p_buyer_name": string,"p_method": Database["public"]['Enums']["payment_method"],"p_notes"?: string,"p_quantity": number,"p_ticket_type_id": string }; Returns: {
              "access_token": string,
"amount_cents": number,
"buyer_email": string | null,
"buyer_name": string,
"buyer_phone": string | null,
"coupon_id": string | null,
"created_at": string,
"created_by": string | null,
"discount_cents": number,
"event_id": string,
"external_reference": string,
"hold_expires_at": string | null,
"id": string,
"marketplace_fee_cents": number,
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"notes": string | null,
"paid_at": string | null,
"quantity": number,
"status": Database["public"]['Enums']["event_order_status"],
"student_id": string | null,
"studio_id": string,
"ticket_type_id": string,
"unit_price_cents": number,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "event_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"sell_gift_card_manual":
{ Args: { "p_buyer_email"?: string,"p_buyer_name": string,"p_message"?: string,"p_method": Database["public"]['Enums']["payment_method"],"p_pack_product_id": string,"p_recipient_name"?: string }; Returns: {
              "access_token": string,
"amount_cents": number,
"buyer_email": string | null,
"buyer_name": string,
"code": string,
"created_at": string,
"created_by": string | null,
"credits": number | null,
"expires_at": string | null,
"external_reference": string,
"id": string,
"message": string | null,
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"notes": string | null,
"pack_name": string,
"pack_product_id": string | null,
"paid_at": string | null,
"recipient_name": string | null,
"redeemed_at": string | null,
"redeemed_student_id": string | null,
"status": Database["public"]['Enums']["gift_card_status"],
"student_pack_id": string | null,
"studio_id": string,
"updated_at": string,
"validity_days": number
            }
                          SetofOptions: {
        from: "*"
        to: "gift_cards"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_audition_result":
{ Args: { "p_application_id": string,"p_notes"?: string,"p_result": Database["public"]['Enums']["audition_application_status"] }; Returns: {
              "answers": NonNullable<Json>,
"audition_id": string,
"created_at": string,
"decided_at": string | null,
"decided_by": string | null,
"external_reference": string,
"fee_cents": number,
"formation_id": string,
"hold_expires_at": string | null,
"id": string,
"method": Database["public"]['Enums']["payment_method"] | null,
"mp_payment_id": string | null,
"mp_preference_id": string | null,
"paid_at": string | null,
"slot_id": string | null,
"staff_notes": string | null,
"status": Database["public"]['Enums']["audition_application_status"],
"student_id": string,
"studio_id": string,
"updated_at": string,
"video_url": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "audition_applications"
        isOneToOne: true
        isSetofReturn: false
      } },
"start_membership":
{ Args: { "p_pack_product_id": string }; Returns: {
              "amount_cents": number,
"cancelled_at": string | null,
"cancelled_by": string | null,
"created_at": string,
"failed_at": string | null,
"id": string,
"last_charge_at": string | null,
"last_error": string | null,
"mp_preapproval_id": string | null,
"name": string,
"next_charge_at": string | null,
"pack_product_id": string,
"status": Database["public"]['Enums']["membership_status"],
"student_id": string,
"studio_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "student_subscriptions"
        isOneToOne: true
        isSetofReturn: false
      } },
"studio_accepts_online_payments":
{ Args: { "p_studio_id": string }; Returns: boolean
                           },
"studio_access":
{ Args: { "p_studio_id": string }; Returns: Json
                           },
"studio_has_feature":
{ Args: { "p_feature": string,"p_studio_id": string }; Returns: boolean
                           },
"studio_usage":
{ Args: { "p_studio_id": string }; Returns: Json
                           },
"update_member":
{ Args: { "p_can_take_payments": boolean,"p_member_id": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: {
              "can_take_payments": boolean,
"created_at": string,
"display_name": string | null,
"id": string,
"role": Database["public"]['Enums']["member_role"],
"studio_id": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "studio_members"
        isOneToOne: true
        isSetofReturn: false
      } },
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
"referral_code": string,
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
"withdraw_enrollment":
{ Args: { "p_enrollment_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "assessment_kind": "grade"|"pass_fail","audition_application_status": "pending_payment"|"submitted"|"admitted"|"waitlisted"|"rejected"|"cancelled","audition_field_kind": "short_text"|"long_text"|"choice"|"yes_no","audition_status": "draft"|"open"|"closed","billing_cycle": "monthly"|"annual","booking_status": "booked"|"attended"|"cancelled"|"no_show","coupon_kind": "percent"|"amount","coupon_redemption_status": "pending"|"confirmed"|"void","coupon_target": "all"|"packs"|"events","credit_event_kind": "grant"|"consume"|"refund"|"adjust"|"expire","dance_role": "leader"|"follower","enrollment_status": "applied"|"approved"|"enrolled"|"rejected"|"withdrawn","event_order_status": "pending"|"paid"|"expired"|"cancelled"|"refunded","event_status": "draft"|"published"|"cancelled","event_ticket_status": "valid"|"cancelled","formation_charge_kind": "enrollment"|"installment"|"full","formation_charge_status": "pending"|"paid"|"cancelled","formation_status": "draft"|"published"|"archived","gift_card_status": "pending"|"active"|"redeemed"|"cancelled"|"expired","member_role": "owner"|"admin"|"teacher","membership_status": "pending"|"active"|"past_due"|"cancelled","offering_kind": "regular"|"special"|"formation","pack_status": "active"|"frozen"|"expired"|"cancelled","payment_method": "mercadopago"|"cash"|"transfer","payment_purpose": "pack","payment_status": "pending"|"approved"|"rejected"|"refunded"|"cancelled","referral_status": "pending"|"rewarded"|"void","session_status": "scheduled"|"cancelled","studio_plan": "profe"|"inicial"|"estudio"|"pro","subscription_status": "trialing"|"active"|"past_due"|"cancelled","waitlist_status": "waiting"|"booked"|"left"
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
            "assessment_kind": ["grade", "pass_fail"],"audition_application_status": ["pending_payment", "submitted", "admitted", "waitlisted", "rejected", "cancelled"],"audition_field_kind": ["short_text", "long_text", "choice", "yes_no"],"audition_status": ["draft", "open", "closed"],"billing_cycle": ["monthly", "annual"],"booking_status": ["booked", "attended", "cancelled", "no_show"],"coupon_kind": ["percent", "amount"],"coupon_redemption_status": ["pending", "confirmed", "void"],"coupon_target": ["all", "packs", "events"],"credit_event_kind": ["grant", "consume", "refund", "adjust", "expire"],"dance_role": ["leader", "follower"],"enrollment_status": ["applied", "approved", "enrolled", "rejected", "withdrawn"],"event_order_status": ["pending", "paid", "expired", "cancelled", "refunded"],"event_status": ["draft", "published", "cancelled"],"event_ticket_status": ["valid", "cancelled"],"formation_charge_kind": ["enrollment", "installment", "full"],"formation_charge_status": ["pending", "paid", "cancelled"],"formation_status": ["draft", "published", "archived"],"gift_card_status": ["pending", "active", "redeemed", "cancelled", "expired"],"member_role": ["owner", "admin", "teacher"],"membership_status": ["pending", "active", "past_due", "cancelled"],"offering_kind": ["regular", "special", "formation"],"pack_status": ["active", "frozen", "expired", "cancelled"],"payment_method": ["mercadopago", "cash", "transfer"],"payment_purpose": ["pack"],"payment_status": ["pending", "approved", "rejected", "refunded", "cancelled"],"referral_status": ["pending", "rewarded", "void"],"session_status": ["scheduled", "cancelled"],"studio_plan": ["profe", "inicial", "estudio", "pro"],"subscription_status": ["trialing", "active", "past_due", "cancelled"],"waitlist_status": ["waiting", "booked", "left"]
          }
        }
} as const
