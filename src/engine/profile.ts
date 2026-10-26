export interface BusinessProfile {
  business_name: string;
  business_type?: string;
  tone?: string;
  signature?: string;
  /** The only phone, email or link a draft may contain. */
  contact?: string;
  policies: string[];
  never_say: string[];
  languages: string[];
}
