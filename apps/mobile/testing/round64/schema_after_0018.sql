-- schema_after_0018 (information_schema fallback, post-apply)
-- tables: 29, columns: 194, functions: 131

== TABLES ==
admin_audit_log
agent_messages
artifact_state
artifacts
chats
coupon_redemptions
coupons
folders
memory_items
messages
profiles
prompts
referral_audit
referral_clicks
referrals
request_logs
reward_events
routing_global_usage
routing_usage
studio_items
subscriptions
system_config
system_error_logs
telemetry_events
token_usage
user_brain
user_limits
user_preferences
user_settings

== COLUMNS ==
admin_audit_log.action
admin_audit_log.admin_id
admin_audit_log.created_at
admin_audit_log.detail
admin_audit_log.id
admin_audit_log.target_user_id
agent_messages.agent_id
agent_messages.chat_id
agent_messages.content
agent_messages.created_at
agent_messages.id
agent_messages.role
agent_messages.turn
agent_messages.user_id
artifact_state.chat_id
artifact_state.key
artifact_state.updated_at
artifact_state.user_id
artifact_state.value
artifacts.chat_id
artifacts.content
artifacts.created_at
artifacts.file_path
artifacts.id
artifacts.language
artifacts.message_index
artifacts.title
artifacts.type
artifacts.user_id
chats.config
chats.created_at
chats.folder_id
chats.id
chats.title
chats.title_set
chats.updated_at
chats.user_id
coupon_redemptions.code
coupon_redemptions.id
coupon_redemptions.redeemed_at
coupon_redemptions.user_id
coupons.code
coupons.created_at
coupons.discount_pct
coupons.expires_at
coupons.max_redemptions
coupons.months
coupons.plan
coupons.redeemed_count
folders.color
folders.created_at
folders.expanded
folders.id
folders.name
folders.order
folders.user_id
memory_items.chat_id
memory_items.content
memory_items.created_at
memory_items.embedding
memory_items.id
memory_items.source
memory_items.user_id
messages.chat_id
messages.content
messages.created_at
messages.id
messages.image
messages.position
messages.role
profiles.bonus_voice_seconds
profiles.created_at
profiles.device_fingerprint
profiles.email
profiles.email_verified
profiles.id
profiles.is_flagged
profiles.name
profiles.referral_code
profiles.referred_by
profiles.role
profiles.signup_ip_hash
profiles.tokens_reset_at
profiles.tokens_used_today
profiles.updated_at
profiles.voice_sessions_completed
prompts.content
prompts.created_at
prompts.id
prompts.title
prompts.user_id
referral_audit.created_at
referral_audit.event
referral_audit.id
referral_audit.reason
referral_audit.referral_id
referral_audit.referred_id
referral_audit.referrer_id
referral_audit.result
referral_clicks.created_at
referral_clicks.id
referral_clicks.referrer_id
referrals.completed_at
referrals.created_at
referrals.disqualify_reason
referrals.id
referrals.referred_id
referrals.referrer_id
referrals.reward_seconds
referrals.status
request_logs.completion_tokens
request_logs.cost_usd
request_logs.created_at
request_logs.feature
request_logs.feedback_text
request_logs.id
request_logs.intent_tag
request_logs.mode
request_logs.prompt_tokens
request_logs.rated
request_logs.user_id
reward_events.amount
reward_events.created_at
reward_events.id
reward_events.kind
reward_events.meta
reward_events.user_id
routing_global_usage.count
routing_global_usage.day
routing_global_usage.mode
routing_usage.count
routing_usage.day
routing_usage.mode
routing_usage.user_id
studio_items.aspect_ratio
studio_items.created_at
studio_items.error
studio_items.id
studio_items.image_path
studio_items.mime_type
studio_items.prompt
studio_items.provider
studio_items.status
studio_items.user_id
subscriptions.expires_at
subscriptions.plan
subscriptions.updated_at
subscriptions.user_id
system_config.key
system_config.updated_at
system_config.value
system_error_logs.context
system_error_logs.created_at
system_error_logs.id
system_error_logs.message
system_error_logs.source
system_error_logs.stack
system_error_logs.user_id
telemetry_events.created_at
telemetry_events.event
telemetry_events.id
telemetry_events.props
telemetry_events.user_id
token_usage.completion_tokens
token_usage.model
token_usage.prompt_tokens
token_usage.user_id
user_brain.items
user_brain.updated_at
user_brain.user_id
user_limits.daily_token_cap
user_limits.flag_reason
user_limits.flagged
user_limits.status
user_limits.updated_at
user_limits.user_id
user_preferences.theme
user_preferences.updated_at
user_preferences.user_id
user_settings.advanced_mode
user_settings.api_endpoint
user_settings.auto_title
user_settings.count_total_tokens
user_settings.default_chat_config
user_settings.default_system_message
user_settings.enter_to_submit
user_settings.first_visit
user_settings.hide_menu_options
user_settings.hide_side_menu
user_settings.inline_latex
user_settings.markdown_mode
user_settings.theme
user_settings.updated_at
user_settings.user_id

== FUNCTIONS ==
array_to_halfvec(double precision[], integer, boolean)
array_to_halfvec(integer[], integer, boolean)
array_to_halfvec(numeric[], integer, boolean)
array_to_halfvec(real[], integer, boolean)
array_to_sparsevec(double precision[], integer, boolean)
array_to_sparsevec(integer[], integer, boolean)
array_to_sparsevec(numeric[], integer, boolean)
array_to_sparsevec(real[], integer, boolean)
array_to_vector(double precision[], integer, boolean)
array_to_vector(integer[], integer, boolean)
array_to_vector(numeric[], integer, boolean)
array_to_vector(real[], integer, boolean)
avg(halfvec)
avg(vector)
binary_quantize(halfvec)
binary_quantize(vector)
claim_referral(p_user_id uuid, p_code text)
complete_referral_reward(p_user_id uuid, p_trigger text)
consume_routing_mode(p_user_id uuid, p_mode text, p_user_limit integer, p_global_cap integer)
cosine_distance(halfvec, halfvec)
cosine_distance(sparsevec, sparsevec)
cosine_distance(vector, vector)
halfvec(halfvec, integer, boolean)
halfvec_accum(double precision[], halfvec)
halfvec_add(halfvec, halfvec)
halfvec_avg(double precision[])
halfvec_cmp(halfvec, halfvec)
halfvec_combine(double precision[], double precision[])
halfvec_concat(halfvec, halfvec)
halfvec_eq(halfvec, halfvec)
halfvec_ge(halfvec, halfvec)
halfvec_gt(halfvec, halfvec)
halfvec_in(cstring, oid, integer)
halfvec_l2_squared_distance(halfvec, halfvec)
halfvec_le(halfvec, halfvec)
halfvec_lt(halfvec, halfvec)
halfvec_mul(halfvec, halfvec)
halfvec_ne(halfvec, halfvec)
halfvec_negative_inner_product(halfvec, halfvec)
halfvec_out(halfvec)
halfvec_recv(internal, oid, integer)
halfvec_send(halfvec)
halfvec_spherical_distance(halfvec, halfvec)
halfvec_sub(halfvec, halfvec)
halfvec_to_float4(halfvec, integer, boolean)
halfvec_to_sparsevec(halfvec, integer, boolean)
halfvec_to_vector(halfvec, integer, boolean)
halfvec_typmod_in(cstring[])
hamming_distance(bit, bit)
handle_email_verified()
hnsw_bit_support(internal)
hnsw_halfvec_support(internal)
hnsw_sparsevec_support(internal)
hnswhandler(internal)
inner_product(halfvec, halfvec)
inner_product(sparsevec, sparsevec)
inner_product(vector, vector)
is_admin()
ivfflat_bit_support(internal)
ivfflat_halfvec_support(internal)
ivfflathandler(internal)
jaccard_distance(bit, bit)
l1_distance(halfvec, halfvec)
l1_distance(sparsevec, sparsevec)
l1_distance(vector, vector)
l2_distance(halfvec, halfvec)
l2_distance(sparsevec, sparsevec)
l2_distance(vector, vector)
l2_norm(halfvec)
l2_norm(sparsevec)
l2_normalize(halfvec)
l2_normalize(sparsevec)
l2_normalize(vector)
log_request(p_user_id uuid, p_mode text, p_feature text, p_prompt_tokens integer, p_completion_tokens integer, p_cost_usd numeric)
log_request(p_user_id uuid, p_mode text, p_feature text, p_prompt_tokens integer, p_completion_tokens integer, p_cost_usd numeric, p_intent_tag text)
match_memory_items(p_user_id uuid, p_query vector, p_threshold double precision, p_count integer)
purge_inactive_guests()
record_referral_click(p_code text)
redeem_coupon(p_user_id uuid, p_code text)
referral_reward_text_units()
roll_daily_tokens(p_user_id uuid)
sparsevec(sparsevec, integer, boolean)
sparsevec_cmp(sparsevec, sparsevec)
sparsevec_eq(sparsevec, sparsevec)
sparsevec_ge(sparsevec, sparsevec)
sparsevec_gt(sparsevec, sparsevec)
sparsevec_in(cstring, oid, integer)
sparsevec_l2_squared_distance(sparsevec, sparsevec)
sparsevec_le(sparsevec, sparsevec)
sparsevec_lt(sparsevec, sparsevec)
sparsevec_ne(sparsevec, sparsevec)
sparsevec_negative_inner_product(sparsevec, sparsevec)
sparsevec_out(sparsevec)
sparsevec_recv(internal, oid, integer)
sparsevec_send(sparsevec)
sparsevec_to_halfvec(sparsevec, integer, boolean)
sparsevec_to_vector(sparsevec, integer, boolean)
sparsevec_typmod_in(cstring[])
subvector(halfvec, integer, integer)
subvector(vector, integer, integer)
sum(halfvec)
sum(vector)
vector(vector, integer, boolean)
vector_accum(double precision[], vector)
vector_add(vector, vector)
vector_avg(double precision[])
vector_cmp(vector, vector)
vector_combine(double precision[], double precision[])
vector_concat(vector, vector)
vector_dims(halfvec)
vector_dims(vector)
vector_eq(vector, vector)
vector_ge(vector, vector)
vector_gt(vector, vector)
vector_in(cstring, oid, integer)
vector_l2_squared_distance(vector, vector)
vector_le(vector, vector)
vector_lt(vector, vector)
vector_mul(vector, vector)
vector_ne(vector, vector)
vector_negative_inner_product(vector, vector)
vector_norm(vector)
vector_out(vector)
vector_recv(internal, oid, integer)
vector_send(vector)
vector_spherical_distance(vector, vector)
vector_sub(vector, vector)
vector_to_float4(vector, integer, boolean)
vector_to_halfvec(vector, integer, boolean)
vector_to_sparsevec(vector, integer, boolean)
vector_typmod_in(cstring[])