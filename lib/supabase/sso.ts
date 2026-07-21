// SSO placeholder — real wiring lands in Phase 3 (Prompt 3.3: SSO/SAML/SCIM).
// Supabase Auth supports SAML SSO natively (auth.signInWithSSO); this just
// reserves the per-org provider id config until that phase.
export const SSO_PROVIDER_ID = process.env.SUPABASE_SSO_PROVIDER_ID || null;
