export interface NutritionistSignup {
  name: string;
  email: string;
  password: string;
  /** Ex.: "CRN-3 34910" (região + número do registro). */
  crn: string;
}

export type AuthStatus = 'authenticated' | 'unauthenticated';
